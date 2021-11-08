import { Color, Mesh, ShaderMaterial, Uniform, Vector2, Vector3 } from "three";
import { CellConfiguration, FlagellumConfiguration, Unwrap } from "../configuration";
import { findDeformationAngleTime } from "./deformation";
import { createFlagellum } from "./flagellum";
import { createAliveMembrane } from "./membrane";

import GlowFragmentShader from "../shaders/cell-fragment.shader";
import GlowVertexShader from "../shaders/cell-vertex.shader";
import { createAliveOrganell } from "./organell";
import { Timings } from "../utils/timings";

export function createAliveCell(cellConfig: Unwrap<CellConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>) {
    const { geometry, membrane, tick: membraneTick } = createAliveMembrane(cellConfig.membrane);
    const cellColor = new Color(cellConfig.membrane.color);
    const cellColorHsl = { h: 0, s: 0, l: 0 };
    cellColor.getHSL(cellColorHsl);
    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(new Vector3(cellColorHsl.h, cellColorHsl.s, cellColorHsl.l)),
            start: new Uniform(cellConfig.glowStart),
        },
        vertexShader: GlowVertexShader,
        fragmentShader: GlowFragmentShader,
        transparent: true,
    });

    const curve = new Mesh(geometry, material);
    const organell = createAliveOrganell(cellConfig.organell);
    curve.add(organell.object);
    let trees = [];
    let lastTime = 0;
    return {
        // maxR: r + dr,
        // minR: r - dr,
        object: curve,
        organell: organell,
        tick: (time: number) => {
            lastTime = time;
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].finish < time) {
                    curve.remove(trees[i].object);
                }
            }
            trees = trees.filter((t) => t.finish > time);
            for (let i = 0; i < trees.length; i++) {
                trees[i].tick(time);
            }
            organell.tick(time);
            membraneTick(time);
            // curve.rotateZ(angular);
        },
        attack: (targets: Vector2[]) => {
            const timings = [];
            const t = lastTime * cellConfig.membrane.frequency;
            for (let i = 0; i < targets.length; i++) {
                const { point, id } = membrane.getSector(targets[i]);
                const attach = new Vector2().copy(point).multiplyScalar(0.9);
                const start1 = findDeformationAngleTime(membrane.deformations[id], t, -Math.abs(membrane.deformations[id].angle));
                const start2 = findDeformationAngleTime(membrane.deformations[id], t, Math.abs(membrane.deformations[id].angle));
                const finish1 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + 2000 * cellConfig.membrane.frequency, -Math.abs(membrane.deformations[id].angle));
                const finish2 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + 2000 * cellConfig.membrane.frequency, Math.abs(membrane.deformations[id].angle));
                membrane.locks[id].out = { start: start1, finish: finish1 };
                membrane.locks[id].in = { start: start2, finish: finish2 };
                const start = Math.max(start1, start2);
                const timing = {
                    startIn: start / cellConfig.membrane.frequency,
                    finishIn: start / cellConfig.membrane.frequency + 600,
                    startOut: start / cellConfig.membrane.frequency + 1000,
                    finishOut: start / cellConfig.membrane.frequency + 2000,
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
                curve.add(flagellum.object);
                trees.push(flagellum);
            }
            return timings;
        },
        glow: (timing: Timings) => {
            organell.glow(timing.finishIn - 100, timing.finishOut);
        },
    };
}
