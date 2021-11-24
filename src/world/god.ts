import { GodElement, MicroscopeElement, WorldElement } from "./types";
import { State, subscribeApi, Team, TeamService } from "../api";
import { randomChoice, randomFrom } from "../utils/math";
import { Vector2 } from "three";
import { stopTime } from "../utils/tick";
import { createTerminal } from "../microscope/terminal";
import { Unwrap, WorldConfiguration } from "../configuration";

type WorldEvent =
    | {
          kind: "attack";
          round: number;
          attacker: number;
          amount: number;
          firstBlood: boolean;
          to: {
              victim: number;
              service: number;
          };
      }
    | {
          kind: "stat";
          team: number;
      };

interface WorldStat {
    top(k: number): number[];
    getPosition(id: number): number;
    getScore(id: number): number;
    getServices(id: number): TeamService[];
    state(): State;
    update(state: State);
    showStat(team: number, time: number);
    isFirstBlood(service: number);
    attack(from: number, to: number, time: number);
    getProbability(e: WorldEvent, time: number): number;
}

function calculateDelta(a: number[], b: number[]) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        sum += Math.abs(a[i] - b[i]);
    }
    return sum;
}

function createWorldStat(): WorldStat {
    const roundsBuffer: State[] = [];
    const teamStat = new Map<number, Team>();

    let bleedingInitialized = false;
    const bleeding = new Map<number, boolean>();

    let statShowTime = -Infinity;
    const teamStatShowTime = new Map<number, number>();
    const teamAttackShowTime = new Map<number, number>();

    let statDelta = 0;
    const teamStatDelta = new Map<number, number>();

    let deltaStolenFlags = 0;
    const serviceDeltaStolenFlags = new Map<number, number>();
    const serviceStolenFlags = new Map<number, number>();
    return {
        top: (k: number) => {
            if (roundsBuffer.length == 0) {
                return [];
            }
            const last = roundsBuffer[roundsBuffer.length - 1];
            const order = last.scoreboard
                .map((x) => ({ id: x.team_id, name: x.name, position: x.n, score: x.score }))
                .sort((a, b) => a.position - b.position)
                .filter((x) => x.score > 0);
            return order.slice(0, k).map((x) => x.id);
        },
        state: () => (roundsBuffer.length > 0 ? roundsBuffer[roundsBuffer.length - 1] : null),
        getPosition(id: number) {
            return teamStat.get(id).n;
        },
        getScore(id: number) {
            return teamStat.get(id).score;
        },
        isFirstBlood(service: number) {
            if (bleeding.has(service) && bleeding.get(service)) {
                return false;
            }
            bleeding.set(service, true);
            return true;
        },
        getServices(id: number) {
            return teamStat.get(id).services;
        },
        update: (state: State) => {
            for (let i = 0; i < state.scoreboard.length; i++) {
                teamStat.set(state.scoreboard[i].team_id, state.scoreboard[i]);
            }

            if (!bleedingInitialized) {
                bleedingInitialized = true;
                for (let i = 0; i < state.scoreboard.length; i++) {
                    for (let s = 0; s < state.scoreboard[i].services.length; s++) {
                        if (state.scoreboard[i].services[s].sflags > 0) {
                            bleeding.set(state.scoreboard[i].services[s].id, true);
                        }
                    }
                }
            }

            statDelta = 0;
            deltaStolenFlags = 0;
            teamStatDelta.clear();
            serviceDeltaStolenFlags.clear();
            serviceStolenFlags.clear();

            for (let i = 0; i < state.scoreboard.length; i++) {
                const current = [state.scoreboard[i].score, ...state.scoreboard[i].services.map((s) => s.fp)];
                const previous = roundsBuffer.length > 0 ? [roundsBuffer[0].scoreboard[i].score, ...roundsBuffer[0].scoreboard[i].services.map((s) => s.fp)] : current.map((_) => 0);
                const delta = calculateDelta(current, previous);
                teamStatDelta.set(state.scoreboard[i].team_id, delta);
                statDelta += delta;
            }

            for (let i = 0; i < state.scoreboard.length; i++) {
                for (let s = 0; s < state.scoreboard[i].services.length; s++) {
                    const service = state.scoreboard[i].services[s];
                    deltaStolenFlags += service.sflags;
                    if (!serviceDeltaStolenFlags.has(service.id)) {
                        serviceDeltaStolenFlags.set(service.id, 0);
                    }
                    if (!serviceStolenFlags.has(service.id)) {
                        serviceStolenFlags.set(service.id, 0);
                    }
                    serviceStolenFlags.set(service.id, serviceStolenFlags.get(service.id) + service.sflags);
                    serviceDeltaStolenFlags.set(service.id, serviceDeltaStolenFlags.get(service.id) + service.sflags);
                }
            }

            if (roundsBuffer.length > 0) {
                for (let i = 0; i < roundsBuffer[0].scoreboard.length; i++) {
                    for (let s = 0; s < roundsBuffer[0].scoreboard[i].services.length; s++) {
                        const service = roundsBuffer[0].scoreboard[i].services[s];
                        deltaStolenFlags -= service.sflags;
                        if (!serviceDeltaStolenFlags.has(service.id)) {
                            serviceDeltaStolenFlags.set(service.id, 0);
                        }
                        serviceDeltaStolenFlags.set(service.id, serviceDeltaStolenFlags.get(service.id) - service.sflags);
                    }
                }
            }

            roundsBuffer.push(state);
            if (roundsBuffer.length > 10) {
                roundsBuffer.splice(0, 1);
            }
        },
        showStat(team: number, time: number) {
            statShowTime = time;
            teamStatShowTime.set(team, time);
        },
        attack(from: number, to: number, time: number) {
            teamAttackShowTime.set(from, from);
        },
        getProbability(e: WorldEvent, time: number): number {
            let p = 1.0;
            if (e.kind === "attack" && !e.firstBlood) {
                const victimAlpha = 1 / 4;
                const attackerAlpha = 1 / 2;
                // p *= victimAlpha + (1 - victimAlpha) * (1 / teamRank.get(e.to.victim));
                // p *= attackerAlpha + (1 - attackerAlpha) * (1 / teamRank.get(e.attacker));
                p *= Math.min(1.0, Math.max(0.0, time - (teamAttackShowTime.get(e.attacker) || 0) / (10 * 1000)));
                let k = 1.0;
                k *= 1 - serviceDeltaStolenFlags.get(e.to.service) / deltaStolenFlags;
                k *= 1 - Math.min(1, e.amount / Math.max(1, serviceStolenFlags.get(e.to.service)));
                p *= 1 - k;
            } else if (e.kind === "stat") {
                p *= Math.min(1.0, Math.max(0.0, (time - statShowTime) / (10 * 60 * 1000)));
                p *= Math.min(0.99, (teamStatDelta.get(e.team) || 0) / Math.max(1, statDelta));
                p *= Math.min(0.99, Math.max(0.0, (time - (teamStatShowTime.get(e.team) || -Infinity)) / (10 * 60 * 1000)));
            }
            return p;
        },
    };
}

const palette = [
    "rgba(255, 136, 123, 1)",
    "rgba(225, 187, 90, 1)",
    "rgba(211, 143, 64, 1)",
    "rgba(150, 200, 64, 1)",
    "rgba(70, 205, 104, 1)",
    "rgba(79, 216, 195, 1)",
    "rgba(81, 173, 255, 1)",
    "rgba(97, 138, 255, 1)",
    "rgba(171, 132, 255, 1)",
    "rgba(197, 111, 218, 1)",
    "rgba(222, 99, 136, 1)",
    "rgba(170, 129, 100, 1)",
];
function getHashCode(s: string) {
    let hash = 0;
    if (s.length === 0) return hash;
    for (let i = 0; i < s.length; i++) {
        let char = s.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return hash;
}

function getEnding(n: number) {
    if (n == 11 || n == 12 || n == 13) {
        return "th";
    }
    if (n % 10 == 1) {
        return "st";
    }
    if (n % 10 == 2) {
        return "nd";
    }
    if (n % 10 == 3) {
        return "rd";
    }
    return "th";
}

export function createGod(config: Unwrap<WorldConfiguration>, world: WorldElement, microscope: MicroscopeElement): GodElement {
    const terminal = createTerminal();
    const teams = new Map<number, string>();
    const services = new Map<number, { internalId: number; name: string; color: string }>();
    let top = [];
    let attacks: WorldEvent[] = [];
    const worldStat = createWorldStat();

    let lastTime = 0;
    subscribeApi((r) => {
        console.info("api data", r);
        if (r.type == "state") {
            worldStat.update(r.value);
            services.clear();
            let serviceId = 0;
            for (const [id, service] of Object.entries(r.value.services)) {
                if (service.active) {
                    services.set(parseInt(id), { internalId: serviceId, name: service.name, color: palette[serviceId % palette.length] });
                    serviceId++;
                }
            }
            microscope.setServices([...services.keys()].map((k) => ({ id: k, ...services.get(k) })).sort((a, b) => a.name.localeCompare(b.name)));
            for (const team of r.value.scoreboard) {
                teams.set(team.team_id, team.name);

                if (team.d != 0) {
                    terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] Δrank ${team.d > 0 ? "+" : ""}${team.d}`);
                } else if (team.score != team.old_score) {
                    terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] Δscore ${Math.round(team.score - team.old_score)}`);
                } else {
                    terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] score ${Math.round(team.score)}`);
                }
                const s = randomChoice(team.services);
                if (services.has(s.id)) {
                    if (s.status == 101) {
                        terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] ${services.get(s.id).name} up`);
                    } else if (s.status == 102) {
                        terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] ${services.get(s.id).name} corrupt`);
                    } else if (s.status == 103) {
                        terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] ${services.get(s.id).name} mumble`);
                    } else if (s.status == 104) {
                        terminal.sendCommand(lastTime + randomFrom(0, 30000), `[${team.name}] ${services.get(s.id).name} down`);
                    }
                }
            }
            world.update(
                r.value.scoreboard.map((team) => ({
                    id: team.team_id,
                    size: team.score,
                    caption: team.name,
                    organells: team.services
                        .filter((s) => services.has(s.id))
                        .map((s) => ({ id: services.get(s.id).internalId, size: s.fp, active: s.status == 101, color: services.get(s.id).color })),
                }))
            );
        } else if (r.type == "attack") {
            terminal.sendCommand(lastTime + randomFrom(0, 10000), `[${teams.get(r.value.attacker_id)}] attacks [${teams.get(r.value.victim_id)}]`);
            attacks.push({
                kind: "attack",
                round: r.value.round,
                attacker: r.value.attacker_id,
                amount: 1,
                to: { victim: r.value.victim_id, service: r.value.service_id },
                firstBlood: worldStat.isFirstBlood(r.value.service_id),
            });
            if (attacks.length > 1000) {
                attacks.splice(0, attacks.length - 1000);
            }
            if (worldStat.state() != null) {
                attacks = attacks.filter((x) => x.kind == "attack" && x.round >= worldStat.state().round - 1);
            }
        }
    });

    let lastTick = -Infinity;
    let actionFinish = -Infinity;
    let showStats = false;
    let showFirstBlood = false;
    const targets = new Map<number, () => void>();
    let alarms = [];
    let setAttentionTime = Infinity;
    const clearTargets = () => {
        const keys = [...targets.keys()];
        for (const id of keys) {
            targets.get(id)();
            targets.delete(id);
        }
    };
    let lastStatTime = -Infinity;
    let showedTeams = new Set<number>();
    return {
        tick: (time: number) => {
            lastTime = time;
            terminal.tick(time);
            if (time < lastTick + 100 || worldStat.state() == null) {
                return;
            }
            if (time < lastTick + 100) {
                return;
            }
            if (time > setAttentionTime) {
                microscope.setMode("attention");
                setAttentionTime = Infinity;
            }
            if (time < actionFinish) {
                return;
            }
            if (showFirstBlood) {
                showFirstBlood = false;
                for (const alarm of alarms) {
                    alarm();
                }
                alarms = [];
                microscope.setMode("live");
                clearTargets();
                actionFinish = time + 1000;
                return;
            }
            showStats = false;

            if (!showStats && !showFirstBlood) {
                let initialize = false;
                if (targets.size == 0) {
                    initialize = true;
                    actionFinish = time + 5000;
                }
                const currentTop = worldStat.top(5);
                const keys = [...targets.keys()];
                for (const id of keys) {
                    if (currentTop.every((x) => x != id)) {
                        targets.get(id)();
                        targets.delete(id);
                    }
                }
                for (const id of currentTop) {
                    if (!targets.has(id)) {
                        targets.set(
                            id,
                            microscope.addTarget(
                                () => world.getCell(id).center,
                                () => 2 * world.getCell(id).radius,
                                null,
                                teams.get(id),
                                null,
                                time
                            )
                        );
                    }
                }
                top = currentTop;
                if (initialize) {
                    return;
                }
            }

            lastTick = time;

            let eventsToShow: WorldEvent[] = [];
            attacks = attacks.filter((x) => x.kind === "attack" && services.has(x.to.service));
            const firstBloodIndex = attacks.findIndex((x) => x.kind === "attack" && x.firstBlood);
            if (firstBloodIndex != -1) {
                eventsToShow.push(attacks[firstBloodIndex]);
                attacks.splice(firstBloodIndex, 1);
            } else {
                const state = worldStat.state();
                if ((lastStatTime < time - 120_000 || attacks.length == 0) && state != null && state.scoreboard.some((x) => x.score > 0)) {
                    lastStatTime = time;
                    if (showedTeams.size == teams.size) {
                        showedTeams.clear();
                    }
                    for (const team of teams.keys()) {
                        if (showedTeams.has(team)) {
                            continue;
                        }
                        showedTeams.add(team);
                        eventsToShow.push({ kind: "stat", team: team });
                        if (eventsToShow.length > 5) {
                            break;
                        }
                    }
                } else {
                    const counts = new Map<number, number>();
                    for (const attack of attacks) {
                        if (attack.kind !== "attack") {
                            continue;
                        }
                        if (!counts.has(attack.attacker)) {
                            counts.set(attack.attacker, 0);
                        }
                        counts.set(attack.attacker, counts.get(attack.attacker) + 1);
                    }
                    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
                    const top = sorted.slice(0, 3);
                    const next = [];
                    const duplicates = new Set<string>();
                    const randomProb = Math.min(0.5, 10 / attacks.length);
                    for (const attack of attacks) {
                        if (attack.kind !== "attack") {
                            continue;
                        }
                        const serialized = `${attack.attacker}-${attack.to.victim}-${attack.to.service}`;
                        if (duplicates.has(serialized)) {
                            continue;
                        }
                        duplicates.add(serialized);
                        const choose = randomFrom(0, 1) < randomProb;
                        if ((!choose && !top.map((x) => x[0]).includes(attack.attacker)) || eventsToShow.length >= 50) {
                            next.push(attack);
                            continue;
                        }
                        eventsToShow.push(attack);
                    }
                    attacks = next;
                }
            }
            if (eventsToShow.length == 0) {
                return;
            }
            for (let i = 0; i < eventsToShow.length; i++) {
                const lucker = eventsToShow[i];
                if (lucker.kind === "stat") {
                    showStats = true;
                    actionFinish = Math.max(actionFinish, time + 6000 * i + 6000);
                    const current = worldStat.getServices(lucker.team).filter((x) => services.has(x.id));
                    const name = teams.get(lucker.team);
                    const place = worldStat.getPosition(lucker.team);
                    microscope.addDetails({
                        main: {
                            prefix: `${place}${getEnding(place)}`,
                            title: name,
                            value: worldStat.getScore(lucker.team),
                        },
                        center: () => world.getCell(lucker.team),
                        follow: () =>
                            world.getOrganells(
                                lucker.team,
                                current.map((x) => (services.has(x.id) ? services.get(x.id).internalId : -1))
                            ),
                        captions: current.map((x) => ({ title: services.get(x.id).name, color: services.get(x.id).color, highlight: x.status == 101, value: x.fp })),
                        start: time + 6000 * i,
                        finish: time + 6000 * i + 6000,
                        sideX: 160,
                    });
                    worldStat.showStat(lucker.team, time + 6000 * i);
                } else if (lucker.kind === "attack" && !lucker.firstBlood) {
                    actionFinish = Math.max(actionFinish, time + (2000 / 25) * i + 2000);
                    world.attack(lucker.attacker, [{ cell: lucker.to.victim, organell: services.get(lucker.to.service).internalId }], time + (2000 / 25) * i, time + (2000 / 25) * i + 2000);
                    worldStat.attack(lucker.attacker, lucker.to.victim, time + (2000 / 25) * i);
                } else if (lucker.kind === "attack" && lucker.firstBlood) {
                    actionFinish = Math.max(actionFinish, time + 5000);
                    world.attack(lucker.attacker, [{ cell: lucker.to.victim, organell: services.get(lucker.to.service).internalId }], time, time + 5000);

                    showFirstBlood = true;
                    clearTargets();

                    microscope.addDetails({
                        center: () => world.getCell(lucker.to.victim),
                        follow: () => [world.getOrganell(lucker.to.victim, services.has(lucker.to.service) ? services.get(lucker.to.service).internalId : -1)],
                        captions: [{ title: services.get(lucker.to.service).name, color: services.get(lucker.to.service).color, highlight: true, value: null }],
                        start: time + 1500,
                        finish: time + 5000,
                        sideX: 160,
                    });
                    targets.set(
                        lucker.attacker,
                        microscope.addTarget(
                            () => world.getCell(lucker.attacker).center,
                            () => 2 * world.getCell(lucker.attacker).radius,
                            "white",
                            teams.get(lucker.attacker),
                            "AGGRESSOR",
                            time + 2500
                        )
                    );

                    targets.set(
                        lucker.to.victim,
                        microscope.addTarget(
                            () => world.getCell(lucker.to.victim).center,
                            () => 2 * world.getCell(lucker.to.victim).radius,
                            "#FF5A49",
                            teams.get(lucker.to.victim),
                            "VICTIM",
                            time + 2500
                        )
                    );

                    stopTime(2501, 20000);
                    setAttentionTime = time + 2500;

                    alarms.push(microscope.addAlarm(lucker.to.service, time + 2500));

                    worldStat.attack(lucker.attacker, lucker.to.victim, time);
                }
            }
            if (showStats && targets.size > 0) {
                clearTargets();
            }
        },
    };
}
