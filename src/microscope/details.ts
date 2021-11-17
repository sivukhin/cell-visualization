import { Vector2 } from "three";
import { lastTick } from "../utils/tick";
import { zero2 } from "../utils/geometry";
import { DetailsElement } from "../world/types";

interface Detail {
    title: string;
    attribute: string;
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
    detailCenter.setAttribute("width", "8");
    detailCenter.setAttribute("height", "8");
    detailCenter.setAttribute("x", "-4");
    detailCenter.setAttribute("y", "-4");
    detailCenter.setAttribute("class", "detail");
    const detailText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    detailText.setAttribute("class", "detail");
    detailGroup.appendChild(detailOverlay);
    detailGroup.appendChild(detailPath);
    detailGroup.appendChild(detailCenter);
    detailGroup.appendChild(detailText);
    return {
        element: detailGroup,
        setPath: (path: string) => {
            detailPath.setAttribute("d", path);
        },
        setOverlay: (x: number, y: number, width: number, height: number, color?: string) => {
            detailOverlay.setAttribute("width", `${width}`);
            detailOverlay.setAttribute("height", `${height}`);
            detailOverlay.setAttribute("x", `${x}`);
            detailOverlay.setAttribute("y", `${y}`);
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
    const sectorWideness = Math.PI / 2 / 6;
    for (let i = -3; i < 3; i++) {
        sectors.push(Math.asin((i + 0.5) / 4));
    }
    for (let i = -3; i < 3; i++) {
        sectors.push(Math.PI + Math.asin((i + 0.5) / 4));
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
        const outerX = Math.sqrt(outerRadius * outerRadius - innerPoint.y * innerPoint.y);
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
    result.push(`M ${Math.round(path[0].x)} ${Math.round(path[0].y)}`);
    for (let i = 1; i < path.length; i++) {
        result.push(`L ${Math.round(path[i].x)} ${Math.round(path[i].y)}`);
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
    const sizes = captions.map((t) => getTextSize(t.title + " " + t.attribute));
    const padding = 10;
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
                const inner = new Vector2().subVectors(initial[i].inner, initialPosition[i]);
                inner.y = -inner.y;
                const outer = new Vector2().subVectors(initial[i].outer, initialPosition[i]);
                outer.y = -outer.y;
                details[i].setPath(getSvgPath(getPath([zero2, inner, outer], lineAlpha)));
                const cx = initial[i].side == "left" ? outer.x - sizes[i].width / 2 - padding : outer.x + sizes[i].width / 2 + padding;
                const cy = outer.y - sizes[i].height / 2 - padding / 2;
                if (textAlpha > 0) {
                    const text = initial[i].side == "left" ? `${captions[i].attribute}ё${captions[i].title}` : `${captions[i].title}ё${captions[i].attribute}`;
                    const prefix = getText(text, textAlpha);
                    const tokens = prefix.split("ё");
                    const segments = tokens.map((t) => ({ value: t, color: undefined }));
                    if (initial[i].side == "left") {
                        segments[0].color = captions[i].color;
                    } else if (tokens.length > 1) {
                        segments[1].color = captions[i].color;
                    }
                    details[i].setText(segments, cx - sizes[i].width / 2 - 1, cy + sizes[i].height);
                    details[i].setOverlay(cx - sizes[i].width / 2 - padding, cy, sizes[i].width + 2 * padding, sizes[i].height + padding);
                }
            }
            return true;
        },
    };
}
