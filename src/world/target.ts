import {
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    ShaderMaterial,
    Side,
    Uniform,
    Vector2,
    Vector3,
    WireframeGeometry,
} from "three";
import { getFlatComponents3D, getHSLVector } from "../utils/draw";
import { randomChoice } from "../utils/math";

// @ts-ignore
import TargetVertexShader from "../shaders/target-vertex.shader";
// @ts-ignore
import TargetFragmentShader from "../shaders/target-fragment.shader";
import { lastTick } from "../utils/tick";

export interface Target {
    center: Vector2;
    size: number;
    color: Color;
    appearDuration: number;
    selectDuration: number;
    scan: boolean;
}

export function createTarget({ size, color, center, appearDuration, selectDuration, scan }: Target) {
    const root = new Object3D();

    const geometry = new BufferGeometry();
    const positions = getFlatComponents3D([new Vector2(0, 0), new Vector2(0, size), new Vector2(size, 0), new Vector2(size, size)]);
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex([0, 3, 1, 0, 2, 3]);

    const material = new ShaderMaterial({
        uniforms: {
            u_scan: new Uniform(-1.0),
            u_resolution: new Uniform(new Vector2(size, size)),
            u_size: new Uniform(0.0),
            u_color: new Uniform(new Vector3(color.r, color.g, color.b)),
            u_thickness: new Uniform(0.01),
        },
        vertexShader: TargetVertexShader,
        fragmentShader: TargetFragmentShader,
        transparent: true,
    });
    const skeleton = new Mesh(geometry, material);
    skeleton.position.set(center.x - size / 2, center.y - size / 2, 0);
    skeleton.renderOrder = 1;
    root.add(skeleton);
    const appearTime = lastTick() + appearDuration;
    const finishTime = lastTick() + appearDuration + selectDuration;
    let alive = true;
    return {
        object: root,
        alive: () => alive,
        tick: (time: number) => {
            if (time > finishTime) {
                alive = false;
                return;
            }
            if (time > appearTime && scan) {
                material.uniforms.u_scan.value = (time - appearTime) / selectDuration;
            }
            const alpha = 1 - Math.max(0, (appearTime - time) / appearDuration);
            material.uniforms.u_size.value = 0.1 * alpha;
            material.needsUpdate = true;
        },
    };
}
