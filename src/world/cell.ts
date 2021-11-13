import { BufferAttribute, BufferGeometry, Color, LineSegments, Mesh, ShaderMaterial, Uniform, Vector2, WireframeGeometry } from "three";
import { CellConfiguration, FlagellumConfiguration, Unwrap } from "../configuration";
import { findDeformationAngleTime } from "./deformation";
import { createFlagellum } from "./flagellum";
import { createAliveMembrane } from "./alive-membrane";
import { createAliveOrganell, OrganellElement } from "./organell";
import { getFlatComponents3D, getHSLVector, to2 } from "../utils/draw";

// @ts-ignore
import GlowFragmentShader from "../shaders/cell-fragment.shader";
// @ts-ignore
import GlowVertexShader from "../shaders/cell-vertex.shader";
import { lastTick } from "../utils/tick";
import { Element } from "./types";
import { randomChoice, randomFrom } from "../utils/math";
import { Timings } from "../utils/timings";
import { convexHull, getComponents, getRadiusForPoints, getRegularPolygon, scalePoints, simplifyShape, zero2 } from "../utils/geometry";
import { ConvexHull } from "three/examples/jsm/math/ConvexHull";

export interface CellElement extends Element {
    spawn(id: number): void;
    kill(id: number): void;
    glow(id: number, start: number, finish: number): void;
    attack(targets: Vector2[], duration: number): Timings[];
    get(id: number): OrganellElement;
}

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

interface OrganellDescription {
    id: number;
    element: OrganellElement;
    center: Vector2;
    velocity: Vector2;
}

function calculateOrganell(id: number, center: Vector2, organells: OrganellDescription[], radius: number) {
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
    const { geometry, membrane, tick: membraneTick, update: membraneUpdate } = createAliveMembrane({ points: getRegularPolygon(cellConfig.segments, r) }, cellConfig.membrane);
    const colors = Object.values(cellConfig.organell.colors);
    let flagellums: Element[] = [];
    let organells: OrganellDescription[] = [];

    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(getHSLVector(cellConfig.color)),
            u_start: new Uniform(cellConfig.glowing),
        },
        vertexShader: GlowVertexShader,
        fragmentShader: GlowFragmentShader,
        transparent: true,
    });
    const speed = 0.1;
    const cell = new Mesh(geometry, material);
    return {
        object: cell,
        tick: (time: number) => {
            for (let i = 0; i < flagellums.length; i++) {
                if (!flagellums[i].alive()) {
                    cell.remove(flagellums[i].object);
                }
            }
            for (let i = 0; i < organells.length; i++) {
                if (!organells[i].element.alive()) {
                    cell.remove(organells[i].element.object);
                }
            }
            organells = organells.filter((t) => t.element.alive);
            flagellums = flagellums.filter((t) => t.alive);
            for (let i = 0; i < flagellums.length; i++) {
                flagellums[i].tick(time);
            }
            for (let i = 0; i < organells.length; i++) {
                organells[i].element.tick(time);
            }
            // for (let i = 0; i < organells.length; i++) {
            //     organells[i].element.tick(time);
            //     organells[i].element.object.position.x += organells[i].velocity.x;
            //     organells[i].element.object.position.y += organells[i].velocity.y;
            // }
            // for (let i = 0; i < organells.length; i++) {
            //     if (to2(organells[i].element.object.position).length() + organells[i].element.current(time).radius > 0.8 * cellConfig.radius) {
            //         const direction = to2(organells[i].element.object.position).normalize();
            //         const edge = to2(organells[i].element.object.position).length() + organells[i].element.current(time).radius;
            //         organells[i].velocity.addScaledVector(direction, -0.01 / (cellConfig.radius - edge));
            //     }
            //     for (let s = 0; s < organells.length; s++) {
            //         const a = organells[i].element.current(time);
            //         const b = organells[s].element.current(time);
            //         const aPosition = to2(organells[i].element.object.position);
            //         const bPosition = to2(organells[s].element.object.position);
            //         if (i == s || aPosition.distanceTo(bPosition) * 1.1 > a.radius + b.radius) {
            //             continue;
            //         }
            //         const direction = new Vector2().subVectors(bPosition, aPosition).normalize();
            //         const [v, u] = getComponents(organells[i].velocity, direction);
            //         organells[i].velocity = new Vector2().addVectors(v.addScaledVector(direction, -0.005), u);
            //     }
            //     if (organells[i].velocity.length() > speed) {
            //         organells[i].velocity.setLength(speed);
            //     }
            // }
            membraneTick(time);
        },
        get: (id: number) => {
            const item = organells.find((t) => t.id == id);
            if (item == null) {
                throw new Error("organell not found");
            }
            return item.element;
        },
        glow(id: number, start: number, finish: number) {
            const item = organells.find((t) => t.id == id);
            if (item == null) {
                return;
            }
            item.element.glow(start, finish);
        },
        spawn: (id: number) => {
            const item = organells.find((t) => t.id == id);
            const color = colors[id % colors.length];
            if (item == null) {
                const { p: center, id: slotId } = randomChoice(slots.map((p, id) => ({ p: new Vector2().copy(p).multiplyScalar(cellConfig.radius), id })).filter((t) => !occupied[t.id]));
                occupied[slotId] = true;

                const hull = calculateOrganell(id, center, organells, cellConfig.radius * padding);
                const spawnedOrganell = { color: new Color(color), visibility: 1.0 };
                const spawnedMembrane = {
                    points: scalePoints(
                        hull.map((p) => p.sub(center)),
                        0.95
                    ),
                };
                const spawned = createAliveOrganell(spawnedOrganell, spawnedMembrane, cellConfig.organell);
                spawned.object.position.set(center.x, center.y, 0);
                cell.add(spawned.object);
                organells.push({ element: spawned, center: center, velocity: zero2, id: id });
                for (let i = 0; i < organells.length - 1; i++) {
                    const update = calculateOrganell(organells[i].id, organells[i].center, organells, cellConfig.radius * padding);
                    organells[i].element.update(null, {
                        points: scalePoints(
                            update.map((p) => p.sub(organells[i].center)),
                            0.95
                        ),
                    });
                }
            }
            // const item = organells.find((t) => t.id == id);
            // const color = colors[id % colors.length];
            // if (item == null) {
            //     const { p: currentCenter, id: currentId } = randomChoice(slots.map((p, id) => ({ p: new Vector2().copy(p).multiplyScalar(cellConfig.radius), id })).filter((t) => !occupied[t.id]));
            //     occupied[currentId] = true;
            //
            //     const radiuses = getRadiusForPoints([...organells.map((x) => x.center), currentCenter], 0.9 * cellConfig.radius).map((r) => 0.9 * r);
            //     const currentRadius = radiuses[radiuses.length - 1];
            //     const invisible = { color: new Color(color), radius: currentRadius, visibility: 0.0, angular: 0.001 };
            //     const spawned = createAliveOrganell(invisible, {
            //         ...cellConfig.organell,
            //         membrane: { ...cellConfig.organell.membrane, segments: cellConfig.organell.membrane.segments + ((offset + id) % 3) },
            //     });
            //     spawned.object.position.set(currentCenter.x, currentCenter.y, 0);
            //     spawned.update({ ...invisible, visibility: 0.7 });
            //     for (let i = 0; i < organells.length; i++) {
            //         organells[i].element.update({ ...organells[i].element.current(lastTick()), visibility: 0.7, radius: radiuses[i] * 1.2 });
            //     }
            //     organells.push({ id: id, element: spawned, center: currentCenter, velocity: new Vector2(speed, 0).rotateAround(zero2, randomFrom(0, 2 * Math.PI)) });
            //     console.info(organells.map((x) => x.velocity));
            //     cell.add(spawned.object);
            // } else {
            //     const visible = { color: new Color(color), radius: item.element.current(lastTick()).radius, visibility: 0.7, angular: 0.001 };
            //     item.element.update(visible);
            // }
        },
        kill: (id: number) => {
            const item = organells.find((t) => t.id == id);
            if (item == null) {
                return;
            }
            // item.element.kill();
        },
        attack: (targets: Vector2[], duration: number): Timings[] => {
            const timings = [];
            const t = lastTick() * cellConfig.membrane.frequency;
            for (let i = 0; i < targets.length; i++) {
                const { point, id } = membrane.getSector(targets[i]);
                const attach = new Vector2().copy(point).multiplyScalar(0.9);
                const start1 = findDeformationAngleTime(membrane.deformations[id], t, -Math.abs(membrane.deformations[id].angle));
                const start2 = findDeformationAngleTime(membrane.deformations[id], t, Math.abs(membrane.deformations[id].angle));
                const finish1 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + duration * cellConfig.membrane.frequency, -Math.abs(membrane.deformations[id].angle));
                const finish2 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + duration * cellConfig.membrane.frequency, Math.abs(membrane.deformations[id].angle));
                membrane.locks[id].out = { start: start1, finish: finish1 };
                membrane.locks[id].in = { start: start2, finish: finish2 };
                const start = Math.max(start1, start2);
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
                flagellum.object.position.set(attach.x, attach.y, 0);
                cell.add(flagellum.object);
                flagellums.push(flagellum);
            }
            return timings;
        },
    };
}
