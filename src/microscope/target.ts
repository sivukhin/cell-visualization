import {
    BufferAttribute,
    BufferGeometry,
    Color,
    ColorRepresentation,
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
import { getFlatComponents3D, getHSLVector, getTextSize } from "../utils/draw";
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
    color: string;
    size: number;
    top?: string;
    bottom?: string;
    start: number;
}

function createSquare(size: number) {
    const length = 20;
    return [
        [new Vector2(-size / 2, -size / 2 + length), new Vector2(-size / 2, -size / 2), new Vector2(-size / 2 + length, -size / 2)],
        [new Vector2(-size / 2, size / 2 - length), new Vector2(-size / 2, size / 2), new Vector2(-size / 2 + length, size / 2)],
        [new Vector2(size / 2, -size / 2 + length), new Vector2(size / 2, -size / 2), new Vector2(size / 2 - length, -size / 2)],
        [new Vector2(size / 2, size / 2 - length), new Vector2(size / 2, size / 2), new Vector2(size / 2 - length, size / 2)],
    ];
}

function createSvgPath(path: Vector2[][]) {
    const result = [];
    for (const segment of path) {
        result.push(`M ${segment[0].x} ${segment[0].y}`);
        for (let i = 1; i < segment.length; i++) {
            result.push(`L ${segment[i].x} ${segment[i].y}`);
        }
    }
    return result.join(" ");
}

function createTextBlock(x: number, bottomY: number | null, topY: number | null, text: string, color: string, fontSize: number, padding: number) {
    const groupElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const size = getTextSize(text, fontSize);
    const bottom = bottomY != null ? -bottomY + size.height + 2 * padding : -topY;
    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", `${x + padding + size.width / 2}`);
    textElement.setAttribute("y", `${bottom - size.height / 2}`);
    textElement.setAttribute("stroke", "black");
    textElement.setAttribute("style", `font-size: ${fontSize}pt`);
    textElement.setAttribute("text-anchor", "middle");
    textElement.setAttribute("alignment-baseline", "middle");
    textElement.innerHTML = text;
    const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectElement.setAttribute("fill", color);
    rectElement.setAttribute("x", `${x}`);
    rectElement.setAttribute("y", `${bottom - size.height - 2 * padding}`);
    rectElement.setAttribute("width", `${size.width + 2 * padding}`);
    rectElement.setAttribute("height", `${size.height + 2 * padding}`);
    groupElement.appendChild(rectElement);
    groupElement.appendChild(textElement);
    return groupElement;
}

export function createTarget({ follow, color, size, top, bottom, start }: Target): TargetElement {
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const targetElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
    targetElement.setAttribute("d", createSvgPath(createSquare(size)));
    targetElement.setAttribute("stroke", color);
    targetElement.setAttribute("fill", "transparent");
    if (top != null) {
        const topElement = createTextBlock(-size / 2, null, size / 2 + 16, top, color, 20, 8);
        root.appendChild(topElement);
    }
    if (bottom != null) {
        const bottomElement = createTextBlock(-size / 2, -size / 2 - 16, null, bottom, color, 16, 8);
        root.appendChild(bottomElement);
    }

    root.appendChild(targetElement);

    return {
        multiverse: root,
        tick: (time: number) => {
            return true;
        },
    };
}
