import { Vector2 } from "three";
import { lastTick } from "../utils/tick";
import { zero2 } from "../utils/geometry";

interface Details {
    follow: () => Vector2[];
    center: () => Vector2;
    innerRadius: number;
    outerRadius: number;
    texts: string[];
}

function createDetail() {
    const detailGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const detailPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    detailPath.setAttribute("class", "detail");
    const detailCenter = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    detailCenter.setAttribute("r", "5");
    detailCenter.setAttribute("cx", "0");
    detailCenter.setAttribute("cy", "0");
    detailCenter.setAttribute("class", "detail");
    const detailText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    detailText.setAttribute("class", "detail");
    detailGroup.appendChild(detailPath);
    detailGroup.appendChild(detailCenter);
    detailGroup.appendChild(detailText);
    return {
        element: detailGroup,
        setPath: (path: string) => {
            detailPath.setAttribute("d", path);
        },
        setText: (text: string, x: number, y: number) => {
            detailText.setAttribute("x", `${x}`);
            detailText.setAttribute("y", `${y}`);
            detailText.textContent = text;
        },
        move: (position: Vector2) => {
            detailGroup.setAttribute("transform", `translate(${position.x}, ${position.y})`);
        },
    };
}

function getPivots(positions: Vector2[], center: Vector2, innerRadius: number, outerRadius: number) {
    const sectors = [];
    const sectorWideness = Math.PI / 2 / 8;
    for (let i = -4; i < 4; i++) {
        sectors.push(i * sectorWideness + sectorWideness / 2);
    }
    for (let i = -4; i < 4; i++) {
        sectors.push(Math.PI + i * sectorWideness + sectorWideness / 2);
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
        pivots.push({ inner: innerPoint.add(center), outer: outerPoint.add(center), side: outerPoint.x < 0 ? "left" : "right" });
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

export function createDetails({ follow, center, innerRadius, outerRadius, texts }: Details) {
    const display = document.getElementById("display");
    const detailsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const details = texts.map((_) => createDetail());
    const initial = getPivots(follow(), center(), innerRadius, outerRadius);
    const sizes = texts.map((t) => getTextSize(t));
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
            if (time > startTime + 100000) {
                display.removeChild(detailsGroup);
                return false;
            }
            const positions = follow();
            const lineAlpha = Math.min(1.0, (time - startTime) / 500.0);
            const textAlpha = Math.min(1.0, Math.max(0.0, (time - startTime - 500.0) / 500.0));
            for (let i = 0; i < positions.length; i++) {
                details[i].move(positions[i]);
                const inner = new Vector2().subVectors(initial[i].inner, positions[i]);
                const outer = new Vector2().subVectors(initial[i].outer, positions[i]);
                details[i].setPath(getSvgPath(getPath([zero2, inner, outer], lineAlpha)));
                details[i].setText(getText(texts[i], textAlpha), initial[i].side === "left" ? outer.x - sizes[i].width : outer.x, outer.y);
            }
            return true;
        },
    };
}
