import { GodElement, MicroscopeElement, WorldElement } from "./types";
import { State, subscribeApi, Team, TeamService } from "../api";
import { randomFrom } from "../utils/math";
import { Vector2 } from "three";
import { stopTime } from "../utils/tick";

type WorldEvent =
    | {
          kind: "attack";
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
    getServices(id: number): TeamService[];
    state(): State;
    update(state: State);
    showStat(team: number, time: number);
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
            const order = last.scoreboard.map((x) => ({ id: x.team_id, name: x.name, position: x.n })).sort((a, b) => a.position - b.position);
            return order.slice(0, k).map((x) => x.id);
        },
        state: () => (roundsBuffer.length > 0 ? roundsBuffer[roundsBuffer.length - 1] : null),
        getServices(id: number) {
            return teamStat.get(id).services;
        },
        update: (state: State) => {
            for (let i = 0; i < state.scoreboard.length; i++) {
                teamStat.set(state.scoreboard[i].team_id, state.scoreboard[i]);
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
                teamStatDelta.set(i, delta);
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
                p *= 0;
            }
            return p;
        },
    };
}

const palette = ["#F03B36", "#FC7630", "#64B419", "#26AD50", "#00BEA2", "#2291FF", "#366AF3", "#B750D1"];
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

export function createGod(world: WorldElement, microscope: MicroscopeElement): GodElement {
    const teams = new Map<number, string>();
    const services = new Map<number, { name: string; color: string }>();
    let top = [];
    const attacks: WorldEvent[] = [];
    const worldStat = createWorldStat();

    subscribeApi((r) => {
        console.info("response", r);
        if (r.type == "state") {
            worldStat.update(r.value);
            services.clear();
            for (const [id, service] of Object.entries(r.value.services)) {
                if (service.active) {
                    const hash = Math.abs(getHashCode(service.name));
                    services.set(parseInt(id), { name: service.name, color: palette[hash % palette.length] });
                }
            }
            for (const team of r.value.scoreboard) {
                teams.set(team.team_id, team.name);
            }
            world.update(
                r.value.scoreboard.map((team) => ({
                    id: team.team_id,
                    size: team.score,
                    caption: team.name,
                    organells: team.services.filter((s) => services.has(s.id)).map((s) => ({ id: s.id, size: s.fp, active: s.status == 101, color: services.get(s.id).color })),
                }))
            );
        } else if (r.type == "attack") {
            attacks.push({
                kind: "attack",
                attacker: r.value.attacker_id,
                amount: 1,
                to: { victim: r.value.victim_id, service: r.value.service_id },
                firstBlood: false,
            });
            if (attacks.length > 1000) {
                attacks.splice(0, attacks.length - 1000);
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
    return {
        tick: (time: number) => {
            if (time < lastTick + 100 || worldStat.state() == null) {
                return;
            }
            if (time < lastTick + 100) {
                return;
            }
            if (!showStats && !showFirstBlood) {
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
            }
            showStats = false;

            lastTick = time;
            const events = [...attacks.map((x, i) => ({ ...x, firstBlood: true })), ...worldStat.state().scoreboard.map((s) => ({ kind: "stat", team: s.team_id } as WorldEvent))];
            const probabilities = events.map((e) => worldStat.getProbability(e, time));
            let filtered = events.filter((e, i) => randomFrom(0, 1) < probabilities[i]);
            if (filtered.length == 0) {
                const order = [];
                for (let i = 0; i < probabilities.length; i++) {
                    order.push(i);
                }
                order.sort((a, b) => probabilities[a] - probabilities[b]);
                filtered = order.map((x) => events[x]);
            }
            let luckers: WorldEvent[] = [];
            for (let i = filtered.length - 1; i >= 0 && luckers.length < 1; i--) {
                if (filtered[i].kind == filtered[filtered.length - 1].kind) {
                    luckers.push(filtered[i]);
                }
            }
            if (luckers.some((x) => x.kind == "attack" && x.firstBlood)) {
                luckers = luckers.filter((x) => x.kind == "attack" && x.firstBlood);
            }
            if (luckers.length == 0) {
                return;
            }
            for (let i = 0; i < luckers.length; i++) {
                const lucker = luckers[i];
                if (lucker.kind === "stat") {
                    showStats = true;
                    actionFinish = Math.max(actionFinish, time + 6000 * i + 6000);
                    const current = worldStat.getServices(lucker.team).filter((x) => services.has(x.id));
                    microscope.addDetails({
                        center: () => world.getCell(lucker.team).center,
                        follow: () =>
                            world.getOrganells(
                                lucker.team,
                                current.map((x) => x.id)
                            ),
                        captions: current.map((x) => ({ title: services.get(x.id).name, color: services.get(x.id).color, highlight: x.status == 101, value: x.fp })),
                        start: time + 6000 * i,
                        finish: time + 6000 * i + 6000,
                        sideX: 110,
                    });
                    worldStat.showStat(lucker.team, time + 6000 * i);
                } else if (lucker.kind === "attack" && !lucker.firstBlood) {
                    actionFinish = Math.max(actionFinish, time + (2000 / 3) * i + 2000);
                    world.attack(lucker.attacker, [{ cell: lucker.to.victim, organell: lucker.to.service }], time + (2000 / 3) * i, time + (2000 / 3) * i + 2000);
                    worldStat.attack(lucker.attacker, lucker.to.victim, time + (2000 / 3) * i);
                } else if (lucker.kind === "attack" && lucker.firstBlood) {
                    actionFinish = Math.max(actionFinish, time + 5000);
                    world.attack(lucker.attacker, [{ cell: lucker.to.victim, organell: lucker.to.service }], time, time + 5000);

                    showFirstBlood = true;
                    clearTargets();

                    microscope.addDetails({
                        center: () => world.getCell(lucker.to.victim).center,
                        follow: () => [world.getOrganell(lucker.to.victim, lucker.to.service)],
                        captions: [{ title: services.get(lucker.to.service).name, color: services.get(lucker.to.service).color, highlight: true, value: null }],
                        start: time + 1500,
                        finish: time + 5000,
                        sideX: 110,
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

                    stopTime(2600, 20000);
                    setAttentionTime = time + 2500;

                    alarms.push(microscope.addAlarm(time + 2500));

                    worldStat.attack(lucker.attacker, lucker.to.victim, time);
                }
            }
            if (showStats) {
                clearTargets();
            }
        },
    };
}
