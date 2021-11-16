import { BufferAttribute, BufferGeometry, Color, LineSegments, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, ShaderMaterial, Side, Uniform, Vector2, Vector3, WireframeGeometry } from "three";
import { getFlatComponents3D, getHSLVector } from "../utils/draw";
import { interpolateLinear1D, randomChoice } from "../utils/math";

// @ts-ignore
import TargetVertexShader from "../shaders/target-vertex.shader";
// @ts-ignore
import TargetFragmentShader from "../shaders/target-fragment.shader";
import { lastTick } from "../utils/tick";
import { TargetElement } from "../world/types";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";

export interface Target {
    follow(): Vector2;
    width: number;
    height: number;
    size: number;
    caption: string;
    select: boolean;
    typingDuration: number;
    appearDuration: number;
    selectDuration: number;
}

const fontLoader = new FontLoader();

let font: any = null;
fontLoader.load("assets/JetBrainsMono_Regular.json", (f) => (font = f));

let camera = null;
export function setCamera(update: any) {
    camera = update;
}

export function createTarget({ size, caption, select, follow, appearDuration, typingDuration, selectDuration, width, height }: Target): TargetElement {
    const root = new Object3D();

    const geometry = new BufferGeometry();
    const positions = getFlatComponents3D([new Vector2(0, 0), new Vector2(0, size), new Vector2(size, 0), new Vector2(size, size)]);
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setIndex([0, 3, 1, 0, 2, 3]);

    const material = new ShaderMaterial({
        uniforms: {
            u_resolution: new Uniform(new Vector2(size, size)),
            u_size: new Uniform(0.0),
            u_color: new Uniform(new Vector3(1.0, 1.0, 1.0)),
            u_scale: new Uniform(1.0),
            u_thickness: new Uniform(0.01),
        },
        vertexShader: TargetVertexShader,
        fragmentShader: TargetFragmentShader,
        transparent: true,
    });
    const skeleton = new Mesh(geometry, material);
    skeleton.position.set(follow().x - size / 2, follow().y - size / 2, 0);
    skeleton.renderOrder = 1;
    root.add(skeleton);
    const startTime = lastTick();
    const typeTime = lastTick() + typingDuration;
    const appearTime = typeTime + appearDuration;
    const finishTime = appearTime + selectDuration;
    let prefixLength = 0;
    const textElement = document.createElement("div");
    textElement.setAttribute("class", "caption");
    document.body.appendChild(textElement);
    console.info(size);
    return {
        multiverse: root,
        tick: (time: number) => {
            if (time > finishTime) {
                document.body.removeChild(textElement);
                return false;
            }
            const duration = typingDuration / caption.length;
            let currentLength = prefixLength;
            while (currentLength * duration < time - startTime) {
                currentLength++;
            }
            if (currentLength > prefixLength) {
                prefixLength = currentLength;
                textElement.textContent = caption.slice(0, currentLength);
            }
            const position = follow();
            const textPosition = new Vector2().copy(position).sub(camera.position()).multiplyScalar(camera.magnification());
            const k = (1.0 - 1.0 / 1.2) / 2.0;
            const textX = width / 2 + textPosition.x - camera.magnification() * size * (1 / 2 - k);
            const textY = Math.round(height / 2 + textPosition.y - camera.magnification() * size * (1 / 2) - interpolateLinear1D(camera.magnification() * 10, 0, 150, 200, size));
            textElement.setAttribute("style", `left: ${textX}px; bottom: ${textY}px; font-size: ${12 * camera.magnification()}pt`);
            skeleton.position.set(position.x - size / 2, position.y - size / 2, 0);
            if (select) {
                material.uniforms.u_scale.value = interpolateLinear1D(1, 1.2, typeTime, appearTime, time);
                material.uniforms.u_size.value = 0.1;
                material.needsUpdate = true;
            }
            return true;
        },
    };
}
