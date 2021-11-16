import { BufferAttribute, BufferGeometry, Color, LineSegments, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, ShaderMaterial, Side, Uniform, Vector2, Vector3, WireframeGeometry } from "three";
import { getFlatComponents3D, getHSLVector } from "../utils/draw";
import { interpolateLinear1D, randomChoice } from "../utils/math";

// @ts-ignore
import TargetVertexShader from "../shaders/target-vertex.shader";
// @ts-ignore
import TargetFragmentShader from "../shaders/target-fragment.shader";
import { lastTick } from "../utils/tick";
import { TargetElement } from "../world/types";

export interface Target {
    follow(): Vector2;
    size: number;
    color: Color;
    appearDuration: number;
    selectDuration: number;
}

export function createTarget({ size, color, follow, appearDuration, selectDuration }: Target): TargetElement {
    const root = new Object3D();

    const geometry = new BufferGeometry();
    const positions = getFlatComponents3D([new Vector2(0, 0), new Vector2(0, size), new Vector2(size, 0), new Vector2(size, size)]);
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex([0, 3, 1, 0, 2, 3]);

    const material = new ShaderMaterial({
        uniforms: {
            u_resolution: new Uniform(new Vector2(size, size)),
            u_size: new Uniform(0.0),
            u_color: new Uniform(new Vector3(color.r, color.g, color.b)),
            u_scale: new Uniform(1.0),
            u_thickness: new Uniform(0.01),
        },
        vertexShader: TargetVertexShader,
        fragmentShader: TargetFragmentShader,
        transparent: true,
    });
    const skeleton = new Mesh(geometry, material);
    skeleton.position.set(follow().x - size * 1.2 / 2, follow().y - size * 1.2 / 2, 0);
    skeleton.renderOrder = 1;
    root.add(skeleton);
    const startTime = lastTick();
    const appearTime = lastTick() + appearDuration;
    const finishTime = lastTick() + appearDuration + selectDuration;
    return {
        multiverse: root,
        tick: (time: number) => {
            if (time > finishTime) {
                return false;
            }
            skeleton.position.set(follow().x - size / 2, follow().y - size / 2, 0);
            const alpha = 1 - Math.max(0, (appearTime - time) / appearDuration);
            material.uniforms.u_scale.value = interpolateLinear1D(1, 1.2, startTime, appearTime, time);
            material.uniforms.u_size.value = 0.1;
            material.needsUpdate = true;
            return true;
        },
    };
}
