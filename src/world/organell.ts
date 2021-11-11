import { createAliveMembrane } from "./membrane";
import { OrganellConfiguration, Unwrap } from "../configuration";
import { BufferAttribute, Color, Mesh, ShaderMaterial, TextureLoader, Uniform, Vector3 } from "three";
import { randomChoice, randomFrom } from "../utils/math";
import { getHSLVector } from "../utils/draw";
import { Element } from "./types";

// @ts-ignore
import OrganellVertexShader from "../shaders/organell-vertex.shader";
// @ts-ignore
import OrganellFragmentShader from "../shaders/organell-fragment.shader";
import { lastTick } from "../utils/tick";

const loader = new TextureLoader();
const textures = [
    loader.load("assets/org-texture-01.png"),
    loader.load("assets/org-texture-02.png"),
    loader.load("assets/org-texture-03.png"),
    loader.load("assets/org-texture-04.png"),
    loader.load("assets/org-texture-05.png"),
    loader.load("assets/org-texture-06.png"),
];

export interface Organell {
    color: Color;
    radius: number;
    angular: number;
    visibility: number;
}

export interface OrganellElement extends Element {
    glow(start: number, finish: number): void;
    update(data: Organell): void;
    kill(): void;
}

function createMaterial(color: Color, texture: any, visibility: number) {
    return new ShaderMaterial({
        uniforms: {
            u_texture: new Uniform(randomChoice(textures)),
            u_color: new Uniform(getHSLVector(color)),
            u_start: new Uniform(0.9),
            u_glow: new Uniform(0.0),
            u_visibility: new Uniform(visibility),
        },

        vertexShader: OrganellVertexShader,
        fragmentShader: OrganellFragmentShader,
        transparent: true,
    });
}

export function createAliveOrganell(organell: Organell, config: Unwrap<OrganellConfiguration>): OrganellElement {
    const { geometry, tick: membraneTick } = createAliveMembrane({ radius: organell.radius }, config.membrane);

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

    const texture = randomChoice(textures);
    const skeleton = new Mesh(geometry, createMaterial(organell.color, texture, organell.visibility));
    skeleton.renderOrder = 0;
    skeleton.rotateZ(randomFrom(0, Math.PI * 2));

    let [startGlow, finishGlow] = [0, 0];
    let current = organell;
    let nextTransition = 0;
    let next: Organell | null = null;
    return {
        object: skeleton,
        alive: () => true,
        tick: (time: number) => {
            if (next != null && (current.visibility != next.visibility || !current.color.equals(next.color))) {
                const alpha = 1 - Math.max(0, (nextTransition - time) / config.transitionDuration);
                const color = new Color(
                    current.color.r * (1 - alpha) + next.color.r * alpha,
                    current.color.g * (1 - alpha) + next.color.g * alpha,
                    current.color.b * (1 - alpha) + next.color.b * alpha
                );
                skeleton.material.uniforms.u_visibility.value = current.visibility * (1 - alpha) + next.visibility * alpha;
                skeleton.material.uniforms.u_color.value = getHSLVector(color);
                skeleton.material.needsUpdate = true;
                if (alpha == 1) {
                    next = null;
                }
            }
            if (startGlow < time && time < finishGlow) {
                const d = time - startGlow;
                const delta = finishGlow - startGlow;
                if (d < delta / 4) {
                    skeleton.material.uniforms.u_glow.value = d / (delta / 4);
                } else {
                    skeleton.material.uniforms.u_glow.value = 1 - (d - delta / 4) / ((3 * delta) / 4);
                }
            } else if (time > finishGlow) {
                startGlow = finishGlow = 0;
            }
            membraneTick(time);
            skeleton.rotateZ(organell.angular);
        },
        update(data: Organell) {
            next = data;
            nextTransition = lastTick() + config.transitionDuration;
        },
        kill() {
            next = { ...current, visibility: 0 };
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
