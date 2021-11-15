import { BufferAttribute, BufferGeometry, Color, LineSegments, Mesh, Object3D, ShaderMaterial, Uniform, Vector2, WireframeGeometry } from "three";
import { CellConfiguration, FlagellumConfiguration, Unwrap } from "../configuration";
import { findDeformationAngleTime } from "./deformation";
import { createFlagellum } from "./flagellum";
import { createAliveMembrane } from "./alive-membrane";
import { createAliveOrganell } from "./organell";
import { getHSLVector } from "../utils/draw";

// @ts-ignore
import GlowFragmentShader from "../shaders/cell-fragment.shader";
// @ts-ignore
import GlowVertexShader from "../shaders/cell-vertex.shader";
import { lastTick, tickAll } from "../utils/tick";
import { randomChoice, randomFrom } from "../utils/math";
import { Timings } from "../utils/timings";
import { convexHull, getRegularPolygon, getSectorIn, scalePoints, simplifyShape, zero2 } from "../utils/geometry";
import { CellElement, FlagellumElement, OrganellElement } from "./types";

const directions = [
    new Vector2(1, 0).normalize(),
    new Vector2(-1, 0).normalize(),
    new Vector2(0, 1).normalize(),
    new Vector2(0, -1).normalize(),
    new Vector2(1, 1).normalize(),
    new Vector2(-1, -1).normalize(),
    new Vector2(-1, 1).normalize(),
    new Vector2(1, -1).normalize(),
];

interface OrganellState {
    id: number;
    center: Vector2;
    velocity: Vector2;
}

function calculateOrganell(id: number, center: Vector2, organells: OrganellState[], radius: number) {
    const rStep = radius / 20;
    const nearest = [];
    for (let x = -radius; x < radius; x += rStep) {
        for (let y = -radius; y < radius; y += rStep) {
            const p = new Vector2(x, y);
            if (p.length() > radius) {
                continue;
            }
            let current = center.distanceTo(p);
            let changed = false;
            for (let s = 0; s < organells.length; s++) {
                if (organells[s].id === id) {
                    continue;
                }
                if (organells[s].center.distanceTo(p) < current) {
                    changed = true;
                    break;
                }
            }
            if (!changed) {
                nearest.push(p);
            }
        }
    }
    return simplifyShape(convexHull(nearest), 10);
}

export function createAliveCell(cellConfig: Unwrap<CellConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>): CellElement {
    const slots: Vector2[] = [];
    const padding = cellConfig.glowing * 0.9;
    const step = 1 / 3;
    for (let i = -3; i <= 3; i++) {
        for (let s = -3; s <= 3; s++) {
            const dx = randomFrom(0.4, 0.6);
            const dy = randomFrom(0.4, 0.6);
            const p = new Vector2((i + dx) * step, (s + dy) * step);
            if (p.length() >= padding) {
                continue;
            }
            slots.push(p);
        }
    }
    const occupied = new Array(slots.length).fill(false);

    const r = cellConfig.radius / Math.cos(Math.PI / cellConfig.segments);
    const membrane = { points: getRegularPolygon(cellConfig.segments, r) };
    const { geometry, thorn: membraneThorn, tick: membraneTick, update: membraneUpdate } = createAliveMembrane(membrane, cellConfig.membrane);
    const colors = Object.values(cellConfig.organell.colors);
    let flagellums: FlagellumElement[] = [];
    let organells: OrganellElement[] = [];
    let state: OrganellState[] = [];

    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(getHSLVector(cellConfig.color)),
            u_start: new Uniform(cellConfig.glowing),
        },
        vertexShader: GlowVertexShader,
        fragmentShader: GlowFragmentShader,
        transparent: true,
    });
    const multiverse = {
        organell: new Object3D(),
        membrane: new Mesh(geometry, material),
    };
    return {
        multiverse: multiverse,
        tick: (time: number) => {
            flagellums = tickAll(flagellums, time, (f) => multiverse.membrane.remove(f.multiverse));
            organells = tickAll(organells, time, (o) => multiverse.organell.remove(o.multiverse));
            membraneTick(time);
            return true;
        },
        get: (id: number) => {
            for (let i = 0; i < state.length; i++) {
                if (state[i].id === id) {
                    return organells[i];
                }
            }
            throw new Error("organell not found");
        },
        glow(id: number, start: number, finish: number) {
            for (let i = 0; i < state.length; i++) {
                if (state[i].id === id) {
                    organells[i].glow(start, finish);
                    break;
                }
            }
        },
        spawn: (id: number) => {
            const color = colors[id % colors.length];
            const spawned = state.some((x) => x.id == id);
            if (!spawned) {
                const { p: center, id: slotId } = randomChoice(slots.map((p, id) => ({ p: new Vector2().copy(p).multiplyScalar(cellConfig.radius), id })).filter((t) => !occupied[t.id]));
                occupied[slotId] = true;

                const hull = calculateOrganell(id, center, state, cellConfig.radius * padding);
                const spawnedOrganell = { color: new Color(color), visibility: 1.0 };
                const spawnedMembrane = {
                    points: scalePoints(
                        hull.map((p) => p.sub(center)),
                        0.95
                    ),
                };
                const spawned = createAliveOrganell(spawnedOrganell, spawnedMembrane, cellConfig.organell);
                spawned.multiverse.position.set(center.x, center.y, 0);
                multiverse.organell.add(spawned.multiverse);
                organells.push(spawned);
                state.push({ center: center, velocity: zero2, id: id });
                for (let i = 0; i < organells.length - 1; i++) {
                    const update = calculateOrganell(state[i].id, state[i].center, state, cellConfig.radius * padding);
                    organells[i].update(null, {
                        points: scalePoints(
                            update.map((p) => p.sub(state[i].center)),
                            0.95
                        ),
                    });
                }
            }
        },
        attack: (targets: Vector2[], duration: number): Timings[] => {
            const timings = [];
            const t = lastTick() * cellConfig.membrane.frequency;
            for (let i = 0; i < targets.length; i++) {
                const { point, id } = getSectorIn(targets[i], membrane.points);
                const attach = new Vector2().copy(point).multiplyScalar(0.9);
                const start = membraneThorn(id, duration);
                const timing = {
                    startIn: start / cellConfig.membrane.frequency,
                    finishIn: start / cellConfig.membrane.frequency + duration * 0.3,
                    startOut: start / cellConfig.membrane.frequency + duration * 0.5,
                    finishOut: start / cellConfig.membrane.frequency + duration,
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
