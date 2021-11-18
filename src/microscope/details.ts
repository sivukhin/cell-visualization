import { Vector2 } from "three";
import { lastTick } from "../utils/tick";
import { tryIntersectLines, zero2 } from "../utils/geometry";
import { DetailsElement } from "../world/types";
import { interpolateMany, randomChoiceNonRepeat } from "../utils/math";

interface Detail {
    title: string;
    value: number;
    color?: string;
}

interface Details {
    follow: () => Vector2[];
    center: () => Vector2;
    sideX: number;
    captions: Detail[];
    start: number;
    finish: number;
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

function diagonalIntersect(a: Vector2, b: Vector2): Vector2 {
    const deltaY = Math.abs(a.y - b.y);
    const deltaX = Math.min(deltaY, Math.abs(b.x - a.x) - 10);
    return a.x < b.x ? new Vector2(a.x + deltaX, b.y) : new Vector2(a.x - deltaX, b.y);
}

function getPivots(positions: Vector2[], center: Vector2, sideX: number) {
    const sectors = [];
    for (let i = -3; i <= 3; i++) {
        sectors.push(new Vector2(-sideX, i * 40));
        sectors.push(new Vector2(sideX, i * 40));
    }
    const occupied = sectors.map((_) => false);
    const distances = [];
    for (let p = 0; p < positions.length; p++) {
        const position = positions[p];
        const current = new Vector2().subVectors(position, center);
        for (let i = 0; i < sectors.length; i++) {
            if (occupied[i]) {
                continue;
            }
            const currentDistance = Math.abs(sectors[i].y - current.y) + Math.abs(sectors[i].x - current.x);
            distances.push({ p: p, sector: i, distance: currentDistance });
        }
    }
    distances.sort((a, b) => a.distance - b.distance);
    const pivots: Array<{ inner: Vector2; outer: Vector2; side: "left" | "right" }> = new Array(positions.length).fill(null);
    for (const distance of distances) {
        if (occupied[distance.sector] || pivots[distance.p] != null) {
            continue;
        }
        const inner = diagonalIntersect(positions[distance.p], new Vector2().addVectors(sectors[distance.sector], center));
        const side = sectors[distance.sector].x < 0 ? "left" : "right";
        pivots[distance.p] = { inner: inner, outer: new Vector2().copy(sectors[distance.sector]).add(center), side: side };
        occupied[distance.sector] = true;
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

export function createDetails({ follow, center, sideX, captions, start, finish }: Details): DetailsElement {
    const display = document.getElementById("display");
    const detailsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const details = captions.map((_) => createDetail());
    const initialPosition = follow();
    const initialCenter = center();
    const initial = getPivots(initialPosition, initialCenter, sideX);
    const textSizes = captions.map((t) => getTextSize(t.title + " " + Math.round(t.value)));
    const hPadding = 4;
    const vPadding = 8;
    for (const detail of details) {
        detailsGroup.appendChild(detail.element);
    }
    let appended = false;
    return {
        tick: (time: number) => {
            if (time < start) {
                return true;
            }
            if (!appended) {
                display.appendChild(detailsGroup);
            }
            if (time > finish) {
                display.removeChild(detailsGroup);
                return false;
            }
            const positions = follow();
            const currentCenter = center();
            const lineAlpha = Math.min(1.0, (time - start) / 500.0);
            const textAlpha = Math.min(1.0, Math.max(0.0, (time - start - 500.0) / Math.min(finish - start - 3000, 500)));
            for (let i = 0; i < positions.length; i++) {
                details[i].move(positions[i].x, -positions[i].y);
                const outer = new Vector2().subVectors(initial[i].outer, positions[i]).add(new Vector2().subVectors(currentCenter, initialCenter));
                const inner = diagonalIntersect(zero2, outer);
                outer.y = -outer.y;
                inner.y = -inner.y;
                details[i].setPath(getSvgPath(getPath([zero2, inner, outer], lineAlpha)));
                const cx = initial[i].side == "left" ? outer.x - textSizes[i].width / 2 - vPadding : outer.x + textSizes[i].width / 2 + vPadding;
                const cy = outer.y - textSizes[i].height / 2 - hPadding;
                if (textAlpha > 0) {
                    const text = initial[i].side == "left" ? `${Math.round(captions[i].value)}ё${captions[i].title}` : `${captions[i].title}ё${Math.round(captions[i].value)}`;
                    const prefix = getText(text, textAlpha);
                    const tokens = prefix.split("ё");
                    const segments = tokens.map((t) => ({ value: t, color: undefined }));
                    if (initial[i].side == "right") {
                        segments[0].color = captions[i].color || "gray";
                    } else if (tokens.length > 1) {
                        segments[1].color = captions[i].color || "gray";
                    }
                    details[i].setText(segments, cx - textSizes[i].width / 2, cy + textSizes[i].height / 2 - hPadding);
                    details[i].setOverlay(cx - textSizes[i].width / 2 - vPadding, cy, textSizes[i].width + 2 * vPadding, textSizes[i].height + 2 * hPadding);
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
