import { BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Uniform, Vector2, TextureLoader, ColorRepresentation, Vector3 } from "three";
import { getFlatComponents3D, getHSLVector } from "../utils/draw";
import { zero2 } from "../utils/geometry";
import { randomFrom, randomChoice, randomChoiceNonRepeat, interpolateLinear1D, interpolateLinear2D } from "../utils/math";

// @ts-ignore
import OrganellsVertexShader from "../shaders/organells-vertex.shader";
// @ts-ignore
import OrganellsFragmentShader from "../shaders/organells-fragment.shader";

import { OrganellInfo } from "./types";

const loader = new TextureLoader();
const textures = [loader.load("assets/texture.jpg")];

const MaxOrganells = 15;

const InnerInf = new Vector2(200, 0);
const OuterInf = new Vector2(100000, 0);

export function createOrganells(points: Vector2[]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3));
    const index = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        index.push(0, i + 1, ((i + 1) % n) + 1);
    }
    geometry.setIndex(index);

    const r = points[0].length();
    const offset = randomFrom(-1, 1);
    const offset2 = randomFrom(-1, 1);

    const slots: Vector2[] = [new Vector2(randomFrom(-r / 6, r / 6), randomFrom(-r / 6, r / 6))];
    for (let i = 0; i < 5; i++) {
        const dx = randomFrom(-0.1, 0.1);
        const dy = randomFrom(-0.1, 0.1);
        const p = new Vector2((r / 3) * (Math.cos(offset + (i * Math.PI) / 3) + dx), (r / 3) * (Math.sin(offset + (i * Math.PI) / 3) + dy));
        slots.push(p);
    }
    for (let i = 0; i < 6; i++) {
        const dx = randomFrom(-0.1, 0.1);
        const dy = randomFrom(-0.1, 0.1);
        const p = new Vector2(((3 * r) / 5) * (Math.cos(offset2 + (i * Math.PI) / 4) + dx), ((3 * r) / 5) * (Math.sin(offset2 + (i * Math.PI) / 4) + dy));
        slots.push(p);
    }
    const occupied = new Array(slots.length).fill(false);
    const original = new Array(MaxOrganells).fill(null);
    const prevCenters = new Array(MaxOrganells).fill(InnerInf);
    const nextCenters = new Array(MaxOrganells).fill(InnerInf);
    const centers = new Array(MaxOrganells).fill(InnerInf);
    const activityTransition = new Array(MaxOrganells).fill(null);
    const moveTransition = new Array(MaxOrganells).fill(null);
    const activity = new Array(MaxOrganells).fill(1);
    const nextActivity = new Array(MaxOrganells).fill(1);
    const weights = new Array(MaxOrganells).fill(1);
    const originalColors = new Array(MaxOrganells).fill(null).map((_) => new Color());
    const colors = new Array(MaxOrganells).fill(null).map((_) => new Vector3());
    const transitionStart = new Array(MaxOrganells).fill(-1);
    const transitionFinish = new Array(MaxOrganells).fill(-1);
    let scale: number = 1.0;
    const material = new ShaderMaterial({
        uniforms: {
            u_time: new Uniform(0),
            u_curvature: new Uniform(3),
            u_texture: new Uniform(textures[0]),
            u_r: new Uniform(r),
            u_centers: new Uniform(centers),
            u_activity: new Uniform(activity),
            u_weights: new Uniform(weights),
            u_colors: new Uniform(colors),
            u_trans_start: new Uniform(transitionStart),
            u_trans_finish: new Uniform(transitionFinish),
        },
        vertexShader: OrganellsVertexShader,
        fragmentShader: OrganellsFragmentShader,
        transparent: true,
    });
    const spawn = (id: number, weight: number, active: boolean, color: ColorRepresentation) => {
        if (original[id] == null) {
            original[id] = randomChoiceNonRepeat(slots, occupied);
            prevCenters[id] = new Vector2().copy(original[id]).setLength(200);
            nextCenters[id] = original[id];
            // centers[id] = new Vector2().copy(original[id]).multiplyScalar(scale);
        }
        originalColors[id] = new Color(color);
        colors[id] = getHSLVector(color);
        nextActivity[id] = active ? 1 : 0;
        activityTransition[id] = null;
        weights[id] = weight;
        material.needsUpdate = true;
    };
    const kill = (id: number) => {
        const slotId = slots.indexOf(original[id]);
        original[id] = null;
        prevCenters[id] = centers[id];
        nextCenters[id] = new Vector2().copy(centers[id]).setLength(200);
        occupied[slotId] = false;
        material.needsUpdate = true;
    };
    const organells = new Mesh(geometry, material);
    return {
        multiverse: organells,
        getAll: () => {
            const result: Array<{ id: number; center: Vector2; weight: number; active: boolean; color: Color }> = [];
            for (let i = 0; i < MaxOrganells; i++) {
                if (original[i] != null) {
                    result.push({ id: i, center: centers[i], weight: weights[i], active: activity[i] == 1, color: originalColors[i] });
                }
            }
            return result;
        },
        get: (id: number) => {
            return { center: original[id] == null ? OuterInf : original[id], weight: weights[id] };
        },
        kill: kill,
        spawnMany: (organellInfos: OrganellInfo[]) => {
            const spawned = new Set<number>();
            for (const organellInfo of organellInfos) {
                spawned.add(organellInfo.id);
                spawn(organellInfo.id, organellInfo.size, organellInfo.active, organellInfo.color);
            }
            for (let i = 0; i < MaxOrganells; i++) {
                if (original[i] != null && !spawned.has(i)) {
                    kill(i);
                }
            }
        },
        spawn: spawn,
        irritate: (id: number, start: number, finish: number) => {
            transitionStart[id] = start;
            transitionFinish[id] = Math.max(transitionFinish[id], finish);
            material.needsUpdate = true;
        },
        tick: (time: number) => {
            material.uniforms.u_time.value = time;
            for (let i = 0; i < MaxOrganells; i++) {
                if (activity[i] != nextActivity[i]) {
                    activityTransition[i] = activityTransition[i] == null ? time : activityTransition[i];
                    activity[i] = interpolateLinear1D(1 - nextActivity[i], nextActivity[i], activityTransition[i], activityTransition[i] + 1000, time);
                }
                if (!centers[i].equals(nextCenters[i])) {
                    moveTransition[i] = moveTransition[i] == null ? time : moveTransition[i];
                    centers[i] = interpolateLinear2D(prevCenters[i], nextCenters[i], moveTransition[i], moveTransition[i] + 2000, time);
                } else {
                    moveTransition[i] = null;
                }
            }
            material.needsUpdate = true;
        },
    };
}
