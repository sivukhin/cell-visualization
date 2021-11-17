import { BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Uniform, Vector2, TextureLoader } from "three";
import { getFlatComponents3D, getHSLVector } from "../utils/draw";
import { zero2 } from "../utils/geometry";
import { randomFrom, randomChoice, randomChoiceNonRepeat } from "../utils/math";

// @ts-ignore
import OrganellsVertexShader from "../shaders/organells-vertex.shader";
// @ts-ignore
import OrganellsFragmentShader from "../shaders/organells-fragment.shader";
import { lastTick } from "../utils/tick";
import { OrganellInfo } from "./types";

const loader = new TextureLoader();
const textures = [loader.load("assets/org-texture-clip-01.png")];
const colorsPreset = [
    getHSLVector("rgb(158, 186, 16)"),
    getHSLVector("rgb(160, 137, 7)"),
    getHSLVector("rgb(158, 147, 93)"),
    getHSLVector("rgb(101, 154, 1)"),
    getHSLVector("rgb(201, 189, 19)"),
    getHSLVector("rgb(177, 129, 67)"),
    getHSLVector("rgb(214, 224, 109)"),
];

const MaxOrganells = 15;

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
    const centers = new Array(MaxOrganells).fill(new Vector2(100000, 0));
    const weights = new Array(MaxOrganells).fill(1);
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
            u_weights: new Uniform(weights),
            u_trans_start: new Uniform(transitionStart),
            u_trans_finish: new Uniform(transitionFinish),
        },
        vertexShader: OrganellsVertexShader,
        fragmentShader: OrganellsFragmentShader,
        transparent: true,
    });
    const spawn = (id: number, weight: number) => {
        if (original[id] == null) {
            original[id] = randomChoiceNonRepeat(slots, occupied);
            centers[id] = new Vector2().copy(original[id]).multiplyScalar(scale);
            material.needsUpdate = true;
        }
    };
    const kill = (id: number) => {
        original[id] = null;
        material.uniforms.u_centers.value[id] = new Vector2(100000, 0);
        occupied[id] = false;
        material.needsUpdate = true;
    };
    const organells = new Mesh(geometry, material);
    return {
        multiverse: organells,
        scale: (update: number) => {
            scale = update;
            material.uniforms.u_r.value = r * scale;
            for (let i = 0; i < material.uniforms.u_centers.value.length; i++) {
                if (original[i] != null) {
                    centers[i] = new Vector2().copy(original[i]).multiplyScalar(scale);
                }
            }
            material.needsUpdate = true;
        },
        get: (id: number) => {
            return centers[id];
        },
        kill: kill,
        spawnMany: (organellInfos: OrganellInfo[]) => {
            console.info("spawn many organells", organellInfos);
            const spawned = new Set<number>();
            for (const organellInfo of organellInfos) {
                spawned.add(organellInfo.id);
                spawn(organellInfo.id, organellInfo.size);
            }
            for (let i = 0; i < MaxOrganells; i++) {
                if (occupied[i] && !spawned.has(i)) {
                    kill(i);
                }
            }
        },
        spawn: spawn,
        irritate: (id: number, start: number, finish: number) => {
            transitionStart[id] = start;
            transitionFinish[id] = finish;
            material.needsUpdate = true;
        },
        tick: (time: number) => {
            material.uniforms.u_time.value = time;
            material.needsUpdate = true;
        },
    };
}
