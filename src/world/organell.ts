import { createAliveMembrane } from "./membrane";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { Color, Mesh, ShaderMaterial, Uniform, Vector3, TextureLoader, BufferAttribute, Vector2 } from "three";
import OrganellVertexShader from "../shaders/organell-vertex.shader";
import OrganellFragmentShader from "../shaders/organell-fragment.shader";
import {interpolate, randomChoice, randomFrom} from "../utils/math";
import { zero3 } from "../utils/geometry";

const loader = new TextureLoader();
const textures = [
    loader.load("assets/org-texture-01.png"),
    loader.load("assets/org-texture-02.png"),
    loader.load("assets/org-texture-03.png"),
    loader.load("assets/org-texture-04.png"),
    loader.load("assets/org-texture-05.png"),
    loader.load("assets/org-texture-06.png")
];
const checker = loader.load("src/assets/checker-texture.jpg");
export function createAliveOrganell(membraneConfig: Unwrap<MembraneConfiguration>) {
    const { geometry, tick: membraneTick } = createAliveMembrane(membraneConfig);

    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    if (bbox != null) {
        bbox.expandByScalar(10);
        const uv = [];
        const dimensions = new Vector3();
        bbox.getSize(dimensions);
        for (let i = 0; i < geometry.attributes.position.count; i++) {
            const current = new Vector3(geometry.attributes.position.array[3 * i], geometry.attributes.position.array[3 * i + 1], geometry.attributes.position.array[3 * i + 2]);
            current.sub(bbox.min);
            uv.push(current.x / dimensions.x, current.y / dimensions.y);
        }
        geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
    }

    const organellColor = new Color(membraneConfig.color);
    const organellColorHsl = { h: 0, s: 0, l: 0 };
    organellColor.getHSL(organellColorHsl);
    const material = new ShaderMaterial({
        uniforms: {
            u_texture: new Uniform(randomChoice(textures)),
            u_color: new Uniform(new Vector3(organellColorHsl.h, organellColorHsl.s, organellColorHsl.l)),
            u_start: new Uniform(0.9),
            u_glow: new Uniform(0.0),
        },

        vertexShader: OrganellVertexShader,
        fragmentShader: OrganellFragmentShader,
        transparent: true,
    });

    const organell = new Mesh(geometry, material);
    const position = new Vector2(randomFrom(-50, 50), randomFrom(-50, 50));
    organell.position.set(position.x, position.y, 0);
    organell.renderOrder = 0;
    let startGlow = 0;
    let finishGlow = 0;
    let lastTime = 0;
    return {
        object: organell,
        position: position,
        tick: (time: number) => {
            lastTime = time;
            if (startGlow < time && time < finishGlow) {
                const d = time - startGlow;
                const delta = finishGlow - startGlow;
                if (d < delta / 4) {
                    material.uniforms.u_glow.value = d / (delta / 4);
                } else {
                    material.uniforms.u_glow.value = 1 - (d - delta / 4) / ((3 * delta) / 4);
                }
            } else if (time > finishGlow) {
                startGlow = finishGlow = 0;
            }
            membraneTick(time);
        },
        glow: (start: number, finish: number) => {
            if (startGlow != 0) {
                startGlow = Math.min(startGlow, start);
                finishGlow = Math.max(finishGlow, finish);
            } else {
                startGlow = start;
                finishGlow = finish;
            }
        },
    };
}
