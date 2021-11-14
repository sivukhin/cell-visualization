import { createAliveMembrane, AliveMembrane } from "./alive-membrane";
import { OrganellConfiguration, Unwrap } from "../configuration";
import { BufferAttribute, Color, Mesh, ShaderMaterial, TextureLoader, Uniform, Vector2, Vector3 } from "three";
import { interpolateLinear1D, interpolateLinearColor, randomChoice, randomFrom } from "../utils/math";
import { getHSLVector } from "../utils/draw";
import { OrganellElement } from "./types";

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
    visibility: number;
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

export function createAliveOrganell(organell: Organell, membrane: AliveMembrane, config: Unwrap<OrganellConfiguration>): OrganellElement {
    const { geometry, tick: membraneTick, update: membraneUpdate } = createAliveMembrane({ points: membrane.points }, config.membrane);

    const updateAll = () => {
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        if (bbox != null) {
            bbox.expandByScalar(10);
            const uv = [];
            const dimensions = new Vector3();
            bbox.getSize(dimensions);
            const d = Math.max(dimensions.x, dimensions.y);
            for (let i = 0; i < geometry.attributes.position.count; i++) {
                const current = new Vector3(geometry.attributes.position.array[3 * i], geometry.attributes.position.array[3 * i + 1], geometry.attributes.position.array[3 * i + 2]);
                current.sub(bbox.min);
                uv.push(current.x / d, current.y / d);
            }
            geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
        }
        const vertices = [0];
        for (let i = 1; i < geometry.attributes.position.count; i++) {
            vertices.push(1);
        }
        geometry.setAttribute("edge", new BufferAttribute(new Float32Array(vertices), 1));
        geometry.attributes.edge.needsUpdate = true;
    };

    updateAll();

    const texture = randomChoice(textures);
    const skeleton = new Mesh(geometry, createMaterial(organell.color, texture, organell.visibility));
    skeleton.renderOrder = 1;

    let [startGlow, finishGlow] = [0, 0];
    let transition: Organell | null = null;
    let transitionStart = 0;
    let transitionFinish = 0;

    const current = (time: number) => {
        if (transition == null) {
            return organell;
        }
        const color = interpolateLinearColor(organell.color, transition.color, transitionStart, transitionFinish, time);
        const visibility = interpolateLinear1D(organell.visibility, transition.visibility, transitionStart, transitionFinish, time);
        return { color: color, visibility: visibility };
    };

    const update = (nextOrganell: Organell | null, nextMembrane: AliveMembrane | null) => {
        if (nextOrganell != null) {
            organell = current(lastTick());
            transition = nextOrganell;
            transitionStart = lastTick();
            transitionFinish = lastTick() + config.transitionDuration;
        }
        if (nextMembrane != null) {
            membraneUpdate(nextMembrane);
        }
        updateAll();
    };

    return {
        multiverse: skeleton,
        tick: (time: number) => {
            const currentOrganell = current(time);
            if (transition != null) {
                skeleton.material.uniforms.u_visibility.value = currentOrganell.visibility;
                skeleton.material.uniforms.u_color.value = getHSLVector(currentOrganell.color);
                skeleton.material.needsUpdate = true;
            }
            if (transition != null && time > transitionFinish) {
                organell = currentOrganell;
                transition = null;
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
            return true;
        },
        update: update,
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
