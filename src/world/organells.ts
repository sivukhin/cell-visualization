import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, Vector2 } from "three";
import { getFlatComponents3D } from "../utils/draw";
import { zero2 } from "../utils/geometry";

// @ts-ignore
import OrganellsVertexShader from "../shaders/organells-vertex.shader";
// @ts-ignore
import OrganellsFragmentShader from "../shaders/organells-fragment.shader";
import { lastTick } from "../utils/tick";

export function createOrganells(points: Vector2[]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3));
    const index = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        index.push(0, i + 1, ((i + 1) % n) + 1);
    }
    geometry.setIndex(index);

    const material = new ShaderMaterial({
        vertexShader: OrganellsVertexShader,
        fragmentShader: OrganellsFragmentShader,
        transparent: true,
    });
    const organells = new Mesh(geometry, material);
    return {
        multiverse: organells,
    };
}
