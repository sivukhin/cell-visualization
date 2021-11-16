import { BufferAttribute, BufferGeometry, Color, Mesh, ShaderMaterial, Uniform, Vector2, TextureLoader } from "three";
import { getFlatComponents3D } from "../utils/draw";
import { zero2 } from "../utils/geometry";
import { randomFrom, randomChoice } from "../utils/math";

// @ts-ignore
import OrganellsVertexShader from "../shaders/organells-vertex.shader";
// @ts-ignore
import OrganellsFragmentShader from "../shaders/organells-fragment.shader";
import { lastTick } from "../utils/tick";

const loader = new TextureLoader();
const textures = [
    loader.load("assets/org-texture-clip-01.png"),
];

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

    const slots: Vector2[] = [];
    const padding = 0.9;
    const step = 1 / 2;
    for (let i = 0; i < 6; i++) {
      const dx = randomFrom(-0.1, 0.1);
      const dy = randomFrom(-0.1, 0.1);
      const p = new Vector2(r / 4 * (Math.cos(offset + i * Math.PI / 3) + dx), r / 3 * (Math.sin(offset + i * Math.PI / 3) + dy))
      slots.push(p);
    }
    for (let i = 0; i < 8; i++) {
      const dx = randomFrom(-0.05, 0.05);
      const dy = randomFrom(-0.05, 0.05);
      const p = new Vector2(3 * r / 5 * (Math.cos(offset2 + i * Math.PI / 4) + dx), 2 * r / 3 * (Math.sin(offset2 + i * Math.PI / 3) + dy))
      slots.push(p);
    }
    const occupied = new Array(slots.length).fill(false);

    const centers = new Array(15).fill(new Vector2(100000, 0));
    for (let i = 0; i < 10; i++) {
      while (true) {
        const slotId = Math.min(slots.length - 1, Math.floor(randomFrom(0, slots.length)));
        if (occupied[slotId]) {
          continue;
        }
        occupied[slotId] = true;
        centers[slotId] = slots[slotId];
        break;
      }
    }
    const weights = new Array(15).fill(1);
    weights[0] = 1.0;
    weights[1] = 1.0;
    weights[2] = 1.0;
    const colors = new Array(15).fill(new Color("red"));
    for (let i = 0; i < 10; i++) {
      colors[i] = new Color(["red", "yellow", "green"][i % 3]);
    }
    const material = new ShaderMaterial({
        uniforms: {
            u_time: new Uniform(0),
            u_texture: new Uniform(textures[0]),
            u_r: new Uniform(r),
            u_centers: new Uniform(centers),
            u_weights: new Uniform(weights),
            u_colors: new Uniform(colors),
        },
        vertexShader: OrganellsVertexShader,
        fragmentShader: OrganellsFragmentShader,
        transparent: true,
    });
    const organells = new Mesh(geometry, material);
    return {
        multiverse: organells,
        tick: (time: number) => {
            material.uniforms.u_time.value = time;
            material.needsUpdate = true;
        },
    };
}
