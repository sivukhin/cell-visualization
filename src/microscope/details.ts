import { Vector2 } from "three";
import { lastTick } from "../utils/tick";
import { zero2 } from "../utils/geometry";
import { DetailsElement } from "../world/types";
import { interpolateMany } from "../utils/math";

interface Detail {
    title: string;
    value: number;
    color?: string;
}

interface Details {
    follow: () => Vector2[];
    center: () => Vector2;
    innerRadius: number;
    outerRadius: number;
    captions: Detail[];
}

interface TextSegment {
    value: string;
    color?: string;
}

function createDetail() {
    const detailGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const detailPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    detailPath.setAttribute("class", "detail");
    const detailOverlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    detailOverlay.setAttribute("class", "overlay");
    const detailOverlayStatus = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const detailCenter = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    detailCenter.setAttribute("transform", "rotate(45)");
    detailCenter.setAttribute("width", "4");
    detailCenter.setAttribute("height", "4");
    detailCenter.setAttribute("x", "-2");
    detailCenter.setAttribute("y", "-2");
    detailCenter.setAttribute("class", "detail");
    const detailText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    detailText.setAttribute("class", "detail");
    const detailAnchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    detailAnchor.setAttribute("class", "anchor");
    detailAnchor.setAttribute("x", "0");
    detailAnchor.setAttribute("y", "0");
    detailAnchor.setAttribute("width", "0");
    detailAnchor.setAttribute("height", "0");
    detailGroup.appendChild(detailOverlay);
    detailGroup.appendChild(detailPath);
    detailGroup.appendChild(detailCenter);
    detailGroup.appendChild(detailText);
    detailGroup.appendChild(detailAnchor);

    return {
        element: detailGroup,
        setPath: (path: string) => {
            detailPath.setAttribute("d", path);
        },
        setOverlay: (x: number, y: number, width: number, height: number) => {
            detailOverlay.setAttribute("width", `${width}`);
            detailOverlay.setAttribute("height", `${height}`);
            detailOverlay.setAttribute("x", `${x}`);
            detailOverlay.setAttribute("y", `${y}`);
        },
        setAnchor: (x: number, y: number, widht: number, height: number, color: string) => {
            detailAnchor.setAttribute("style", `fill: ${color}`);
            detailAnchor.setAttribute("x", `${x}`);
            detailAnchor.setAttribute("y", `${y}`);
            detailAnchor.setAttribute("width", `${widht}`);
            detailAnchor.setAttribute("height", `${height}`);
        },
        setText: (text: TextSegment[], x: number, y: number) => {
            detailText.setAttribute("x", `${x}`);
            detailText.setAttribute("y", `${y}`);
            detailText.innerHTML = text.map((t) => `<tspan ${t.color != null ? `style="fill: ${t.color}"` : ""}>${t.value}</tspan>`).join(" ");
        },
        move: (x: number, y: number) => {
            detailGroup.setAttribute("transform", `translate(${x}, ${y})`);
        },
    };
}

function getPivots(positions: Vector2[], center: Vector2, innerRadius: number, outerRadius: number) {
    const sectors = [];
    for (let i = 1; i <= 4; i++) {
        sectors.push(Math.asin(i / 4.1));
        sectors.push(Math.PI - Math.asin(i / 4.1));
    }
    for (let i = 1; i <= 2; i++) {
        sectors.push(-Math.asin(i / 4));
        sectors.push(Math.PI + Math.asin(i / 4));
    }
    const pivots: Array<{ inner: Vector2; outer: Vector2; side: "left" | "right" }> = [];
    const occupied = sectors.map((_) => false);
    for (const position of positions) {
        const angle = new Vector2().subVectors(position, center).angle();
        let best = -1;
        let bestDistance = Infinity;
        for (let i = 0; i < sectors.length; i++) {
            if (occupied[i]) {
                continue;
            }
            let distance = (2 * Math.PI + angle - sectors[i]) % (2 * Math.PI);
            distance = Math.min(distance, 2 * Math.PI - distance);
            if (distance < bestDistance) {
                best = i;
                bestDistance = distance;
            }
        }
        const innerPoint = new Vector2(innerRadius).rotateAround(zero2, sectors[best]);
        const outerX = outerRadius;
        const outerPoint = new Vector2(innerPoint.x < 0 ? -outerX : outerX, innerPoint.y);
        const side = outerPoint.x < 0 ? "left" : "right";
        pivots.push({ inner: innerPoint.add(center), outer: outerPoint.add(center), side: side });
        occupied[best] = true;
    }
    return pivots;
}

function getPath(path: Vector2[], alpha: number) {
    let length = 0;
    for (let i = 0; i < path.length - 1; i++) {
        length += path[i].distanceTo(path[i + 1]);
    }
    length *= alpha;
    const result = [path[0]];
    for (let i = 0; i < path.length - 1; i++) {
        const current = path[i].distanceTo(path[i + 1]);
        if (current > length) {
            const p = new Vector2()
                .subVectors(path[i + 1], path[i])
                .multiplyScalar(length / current)
                .add(path[i]);
            result.push(p);
            break;
        } else {
            result.push(path[i + 1]);
        }
        length -= current;
    }
    return result;
}

function getSvgPath(path: Vector2[]) {
    const result = [];
    result.push(`M ${path[0].x} ${path[0].y}`);
    for (let i = 1; i < path.length; i++) {
        result.push(`L ${path[i].x} ${path[i].y}`);
    }
    return result.join(" ");
}

function getText(text: string, alpha: number) {
    const length = Math.ceil(text.length * alpha);
    return text.slice(0, length);
}

const shadow = document.getElementById("shadow-display");

function getTextSize(text: string) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "text");
    element.setAttribute("class", "detail");
    element.textContent = text;
    shadow.appendChild(element);
    const bbox = element.getBBox();
    shadow.removeChild(element);
    return bbox;
}

export function createDetails({ follow, center, innerRadius, outerRadius, captions }: Details): DetailsElement {
    const display = document.getElementById("display");
    const detailsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const details = captions.map((_) => createDetail());
    const initialPosition = follow();
    const initial = getPivots(initialPosition, center(), innerRadius, outerRadius);
    const textSizes = captions.map((t) => getTextSize(t.title + " " + Math.round(t.value)));
    const hPadding = 4;
    const vPadding = 8;
    for (const detail of details) {
        detailsGroup.appendChild(detail.element);
    }
    display.appendChild(detailsGroup);
    let startTime = null;
    return {
        tick: (time: number) => {
            if (startTime == null) {
                startTime = time;
            }
            if (time > startTime + 5000) {
                display.removeChild(detailsGroup);
                return false;
            }
            const positions = follow();
            const lineAlpha = Math.min(1.0, (time - startTime) / 500.0);
            const textAlpha = Math.min(1.0, Math.max(0.0, (time - startTime - 500.0) / 500.0));
            for (let i = 0; i < positions.length; i++) {
                details[i].move(positions[i].x, -positions[i].y);
                const inner = new Vector2().subVectors(initial[i].inner, positions[i]);
                inner.y = -inner.y;
                const outer = new Vector2().subVectors(initial[i].outer, positions[i]);
                outer.y = -outer.y;
                details[i].setPath(getSvgPath(getPath([zero2, inner, outer], lineAlpha)));
                const cx = initial[i].side == "left" ? outer.x - textSizes[i].width / 2 - vPadding : outer.x + textSizes[i].width / 2 + vPadding;
                const cy = outer.y - textSizes[i].height / 2 - hPadding;
                if (textAlpha > 0) {
                    const text = initial[i].side == "left" ? `${Math.round(captions[i].value)}ё${captions[i].title}` : `${captions[i].title}ё${Math.round(captions[i].value)}`;
                    const prefix = getText(text, textAlpha);
                    const tokens = prefix.split("ё");
                    const segments = tokens.map((t) => ({ value: t, color: undefined }));
                    if (initial[i].side == "left") {
                        segments[0].color = captions[i].color;
                    } else if (tokens.length > 1) {
                        segments[1].color = captions[i].color;
                    }
                    details[i].setText(segments, cx - textSizes[i].width / 2, cy + textSizes[i].height / 2 - hPadding);
                    details[i].setOverlay(cx - textSizes[i].width / 2 - vPadding, cy, textSizes[i].width + 2 * vPadding, textSizes[i].height + 2 * hPadding, captions[i].color, captions[i].value);
                    if (captions[i].color) {
                        const height = 18;
                        details[i].setAnchor(
                            initial[i].side == "left" ? cx + textSizes[i].width / 2 + vPadding - 4 : cx - textSizes[i].width / 2 - vPadding,
                            cy + textSizes[i].height / 2 + hPadding - height / 2,
                            4,
                            height,
                            captions[i].color
                        );
                    }
                }
            }
            return true;
        },
    };
}
