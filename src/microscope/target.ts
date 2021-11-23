import { Vector2 } from "three";
import { getTextSize } from "../utils/draw";

// @ts-ignore
import TargetVertexShader from "../shaders/target-vertex.shader";
// @ts-ignore
import TargetFragmentShader from "../shaders/target-fragment.shader";
import { TargetElement } from "../world/types";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";

export interface Target {
    follow(): Vector2;
    size(): number;
    color: string;
    top?: string;
    bottom?: string;
    start: number;
    hideTarget?: boolean;
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

function createTextBlock(x: number, bottomY: number | null, topY: number | null, text: string, color: string | null, fontSize: number, padding: number) {
    const groupElement = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const size = getTextSize(text, fontSize);
    const bottom = bottomY != null ? -bottomY + size.height + 2 * padding : -topY;
    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", `${x + padding}`);
    textElement.setAttribute("y", `${bottom - size.height}`);
    if (color != null) {
        textElement.setAttribute("stroke", "black");
    } else {
        textElement.setAttribute("fill", "white");
    }
    textElement.setAttribute("style", `font-size: ${fontSize}pt`);
    textElement.setAttribute("class", "flicker");
    textElement.innerHTML = text;
    if (color != null) {
        const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rectElement.setAttribute("class", "flicker");
        rectElement.setAttribute("fill", color);
        rectElement.setAttribute("x", `${x}`);
        rectElement.setAttribute("y", `${bottom - size.height - 2 * padding}`);
        rectElement.setAttribute("width", `${size.width + 2 * padding}`);
        rectElement.setAttribute("height", `${size.height + 2 * padding}`);
        groupElement.appendChild(rectElement);
    }
    groupElement.appendChild(textElement);
    return groupElement;
}

export function createTarget({ follow, color, size, top, bottom, start, hideTarget }: Target): TargetElement {
    const initialSize = size();
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    let targetElement = null;
    if (!hideTarget) {
        targetElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        targetElement.setAttribute("class", "flicker");
        targetElement.setAttribute("d", createSvgPath(createSquare(initialSize)));
        targetElement.setAttribute("stroke", color || "white");
        targetElement.setAttribute("fill", "transparent");
    }
    let topElement = null;
    if (top != null) {
        topElement = createTextBlock(-initialSize / 2, null, initialSize / 2 + 16, top, color, 20, color != null ? 8 : 0);
    }
    let bottomElement = null;
    if (bottom != null) {
        bottomElement = createTextBlock(-initialSize / 2, -initialSize / 2 - 16, null, bottom, color, 16, color != null ? 8 : 0);
    }

    let position = follow();
    root.setAttribute("transform", `translate(${position.x}, ${position.y})`);

    let inserted = false;
    return {
        multiverse: root,
        position: () => position,
        tick: (time: number) => {
            if (time > start && !inserted) {
                if (targetElement != null) {
                    root.appendChild(targetElement);
                }
                if (topElement != null) {
                    root.appendChild(topElement);
                }
                if (bottomElement != null) {
                    root.appendChild(bottomElement);
                }
                inserted = true;
            }
            position = follow();
            root.setAttribute("transform", `translate(${position.x}, ${-position.y})`);
            return true;
        },
    };
}
