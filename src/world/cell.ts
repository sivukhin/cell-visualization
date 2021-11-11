import { Color, Mesh, ShaderMaterial, Uniform, Vector2 } from "three";
import { CellConfiguration, FlagellumConfiguration, Unwrap } from "../configuration";
import { findDeformationAngleTime } from "./deformation";
import { createFlagellum } from "./flagellum";
import { createAliveMembrane } from "./membrane";
import { createAliveOrganell, OrganellElement } from "./organell";
import { getHSLVector } from "../utils/draw";

// @ts-ignore
import GlowFragmentShader from "../shaders/cell-fragment.shader";
// @ts-ignore
import GlowVertexShader from "../shaders/cell-vertex.shader";
import { lastTick } from "../utils/tick";
import { Element } from "./types";
import { randomFrom } from "../utils/math";
import { Timings } from "../utils/timings";

export interface CellElement extends Element {
    spawn(id: number, radius: number): void;
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

export function createAliveCell(cellConfig: Unwrap<CellConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>): CellElement {
    const offset = Math.floor(randomFrom(0, 3));

    const { geometry, membrane, tick: membraneTick } = createAliveMembrane({ radius: cellConfig.radius }, cellConfig.membrane);
    const colors = Object.values(cellConfig.organell.colors);
    let flagellums: Element[] = [];
    let organells: Array<{ id: number; element: OrganellElement }> = [];

    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(getHSLVector(cellConfig.color)),
            u_start: new Uniform(cellConfig.glowing),
        },
        vertexShader: GlowVertexShader,
        fragmentShader: GlowFragmentShader,
        transparent: true,
    });
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
        spawn: (id: number, radius: number) => {
            const item = organells.find((t) => t.id == id);
            const color = colors[id % colors.length];
            if (item == null) {
                const invisible = { color: new Color(color), radius: radius, visibility: 0.0, angular: 0.001 };
                const position = new Vector2().copy(directions[id % directions.length]).setLength(0.8 * cellConfig.radius - radius);
                const spawned = createAliveOrganell(invisible, {
                    ...cellConfig.organell,
                    membrane: { ...cellConfig.organell.membrane, segments: cellConfig.organell.membrane.segments + ((offset + id) % 3) },
                });
                spawned.object.position.set(position.x, position.y, 0);
                spawned.update({ ...invisible, visibility: 1.0 });
                organells.push({ id: id, element: spawned });
                cell.add(spawned.object);
            } else {
                const visible = { color: new Color(color), radius: radius, visibility: 1.0, angular: 0.001 };
                item.element.update(visible);
            }
        },
        kill: (id: number) => {
            const item = organells.find((t) => t.id == id);
            if (item == null) {
                return;
            }
            item.element.kill();
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
