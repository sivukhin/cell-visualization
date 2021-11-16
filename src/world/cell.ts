import { Color, Mesh, MeshBasicMaterial, Object3D, ShaderMaterial, Uniform, Vector2 } from "three";
import { CellConfiguration, FlagellumConfiguration, Unwrap } from "../configuration";
import { createFlagellum } from "./flagellum";
import { createAliveMembrane } from "./alive-membrane";
import { createAliveOrganell } from "./organell";
import { getHSLVector } from "../utils/draw";
import { lastTick, tickAll } from "../utils/tick";
import { randomChoice, randomFrom } from "../utils/math";
import { Timings } from "../utils/timings";
import { getRegularPolygon, getSectorIn, scalePoints, zero2 } from "../utils/geometry";
import { CellElement, FlagellumElement, OrganellElement } from "./types";
import { createOrganells } from "./organells";

export function createAliveCell(cellConfig: Unwrap<CellConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>): CellElement {
    const r = cellConfig.radius / Math.cos(Math.PI / cellConfig.segments);
    const membrane = { points: getRegularPolygon(cellConfig.segments, r) };
    const { geometry, thorn: membraneThorn, tick: membraneTick, update: membraneUpdate } = createAliveMembrane(membrane, cellConfig.membrane);
    let flagellums: FlagellumElement[] = [];
    let organells = createOrganells(membrane.points);

    const color = new Color(cellConfig.color);
    const material = new MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
    const multiverse = {
        organell: new Object3D(),
        membrane: new Mesh(geometry, material),
    };
    multiverse.organell.add(organells.multiverse);
    return {
        multiverse: multiverse,
        tick: (time: number) => {
            flagellums = tickAll(flagellums, time, (f) => multiverse.membrane.remove(f.multiverse));
            membraneTick(time);
            organells.tick(time);
            return true;
        },
        get: (id: number) => {
            return organells.get(id);
        },
        irritate(id: number, start: number, finish: number) {
            organells.irritate(id, start, finish);
            // for (let i = 0; i < state.length; i++) {
            //     if (state[i].id === id) {
            //         organells[i].glow(start, finish);
            //         break;
            //     }
            // }
        },
        spawn: (id: number, weight: number) => {
            organells.spawn(id, weight);
        },
        attack: (targets: Vector2[], duration: number): Timings[] => {
            const timings = [];
            const t = lastTick() * cellConfig.membrane.frequency;
            for (let i = 0; i < targets.length; i++) {
                const { point, id } = getSectorIn(targets[i], membrane.points);
                const attach = new Vector2().copy(point).multiplyScalar(0.9);
                // const start = membraneThorn(id, duration);
                const timing = {
                    startIn: lastTick(),
                    finishIn: lastTick() + duration * 0.3,
                    startOut: lastTick() + duration * 0.5,
                    finishOut: lastTick() + duration,
                };
                timings.push(timing);
                const flagellum = createFlagellum(
                    {
                        startDirection: new Vector2().copy(point),
                        finishDirection: new Vector2().subVectors(targets[i], attach),
                        target: new Vector2().subVectors(targets[i], attach),
                        timings: timing,
                    },
                    flagellumConfig
                );
                flagellum.multiverse.position.set(attach.x, attach.y, 0);
                multiverse.membrane.add(flagellum.multiverse);
                flagellums.push(flagellum);
            }
            return timings;
        },
    };
}
