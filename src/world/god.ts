import { GodElement, WorldElement } from "./types";
import { State, subscribeApi } from "../api";
import { createTeamIndex } from "../glue";
import { randomFrom } from "../utils/math";

type WorldEvent =
    | {
          kind: "attack";
          attacker: number;
          amount: number;
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
    top(k: number): Array<{ id: number; name: string }>;
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

    let statShowTime = -Infinity;
    const teamStatShowTime = new Map<number, number>();
    const teamAttackShowTime = new Map<number, number>();
    const teamRank = new Map<number, number>();

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
            return order.slice(0, k).map((x) => x);
        },
        state: () => (roundsBuffer.length > 0 ? roundsBuffer[roundsBuffer.length - 1] : null),
        update: (state: State) => {
            for (let i = 0; i < state.scoreboard.length; i++) {
                teamRank.set(i, state.scoreboard[i].n);
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
            if (e.kind === "attack") {
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

const palette = ["#F03B36", "#FC7630", "#64B419", "#26AD50", "#00BEA2", "#2291FF", "#366AF3", "#B750D1"];

export function createGod(world: WorldElement): GodElement {
    const teams = createTeamIndex();
    let top = [];
    const attacks: WorldEvent[] = [];
    const worldStat = createWorldStat();

    subscribeApi((r) => {
        console.info("response", r);
        if (r.type == "state") {
            worldStat.update(r.value);
            for (const [id, service] of Object.entries(r.value.services)) {
                if (service.active) {
                    world.register(parseInt(id), service.name);
                }
            }
            world.update(
                r.value.scoreboard.map((team) => ({
                    id: team.team_id,
                    size: team.score,
                    caption: team.name,
                    organells: team.services.map((s) => ({ id: s.id, size: s.fp, active: s.status == 101, color: palette[s.id % palette.length] })),
                }))
            );
        } else if (r.type == "attack") {
            attacks.push({ kind: "attack", attacker: r.value.attacker_id, amount: 1, to: { victim: r.value.victim_id, service: r.value.service_id } });
            if (attacks.length > 1000) {
                attacks.splice(0, attacks.length - 1000);
            }
        }
    });

    let lastTick = -Infinity;
    let actionFinish = -Infinity;
    let showStats = false;
    return {
        tick: (time: number) => {
            if (time < lastTick + 100 || worldStat.state() == null) {
                return;
            }
            if (!showStats) {
                const currentTop = worldStat.top(5);
                for (const id of top) {
                    if (currentTop.every((x) => x.id != id)) {
                        world.resetAccent(id);
                    }
                }
                for (const team of currentTop) {
                    world.setAccent(team.id, team.name);
                }
                top = currentTop.map((x) => x.id);
            }
            if (time < actionFinish) {
                return;
            }
            showStats = false;

            lastTick = time;
            const events = [...attacks, ...worldStat.state().scoreboard.map((s) => ({ kind: "stat", team: s.team_id } as WorldEvent))];
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
            const luckers: WorldEvent[] = [];
            for (let i = filtered.length - 1; i >= 0 && luckers.length < 4; i--) {
                if (filtered[i].kind == filtered[filtered.length - 1].kind) {
                    luckers.push(filtered[i]);
                }
            }
            if (luckers.length == 0) {
                return;
            }
            for (let i = 0; i < luckers.length; i++) {
                const lucker = luckers[i];
                if (lucker.kind === "stat") {
                    showStats = true;
                    actionFinish = Math.max(actionFinish, time + 6000 * i + 6000);
                    world.inspect(lucker.team, time + 6000 * i, time + 6000 * i + 6000);
                    worldStat.showStat(lucker.team, time + 6000 * i);
                } else if (lucker.kind === "attack") {
                    actionFinish = Math.max(actionFinish, time + (2000 / 3) * i + 2000);
                    world.attack(lucker.attacker, [{ cell: lucker.to.victim, organell: lucker.to.service }], time + (2000 / 3) * i, time + (2000 / 3) * i + 2000);
                    worldStat.attack(lucker.attacker, lucker.to.victim, time + (2000 / 3) * i);
                }
            }
            if (showStats) {
                for (const id of top) {
                    world.resetAccent(id);
                }
                top = [];
            }
        },
    };
}
