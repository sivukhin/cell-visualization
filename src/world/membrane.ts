import { getRegularPolygon, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, ColorRepresentation, DynamicDrawUsage, Line, LineBasicMaterial, Object3D, Path, Vector2 } from "three";
import { interpolate, randomFrom } from "../utils/math";

function generateAliveMembrane(n: number, r: number, dr: number): any {
    const skeleton = getRegularPolygon(n, r / Math.cos(Math.PI / n));
    const edges = [];
    const centers = [];
    for (let i = 0; i < n; i++) {
        const edge = new Vector2().subVectors(skeleton[(i + 1) % n], skeleton[i]);
        edges.push(edge);
        centers.push(new Vector2().copy(skeleton[i]).addScaledVector(edge, 0.5));
    }

    const limits = [];
    let sign = 1;
    for (let i = 0; i < n; i++) {
        const angle = ((1 + Math.random()) * Math.PI) / 6;
        const intersectionOuter = tryIntersectLineCircle(centers[i], new Vector2().copy(edges[i]).rotateAround(zero2, -angle), zero2, r + dr);
        const intersectionInner = tryIntersectLineCircle(centers[i], new Vector2().copy(edges[i]).rotateAround(zero2, angle), zero2, r - dr);
        if (intersectionOuter == null && intersectionInner == null) {
            throw new Error("invalid operation");
        }
        const outer = intersectionOuter == null ? Infinity : intersectionOuter.distanceTo(centers[i]);
        const inner = intersectionInner == null ? Infinity : intersectionInner.distanceTo(centers[i]);
        limits.push({
            angle: sign * angle,
            length: Math.min(outer, inner, edges[i].length() / 2),
        });
        sign = -sign;
    }
    return [centers, edges, limits];
}

function getPoints(time: number, centers: Vector2[], edges: Vector2[], limits: { angle: number; length: number }[]) {
    const n = centers.length;
    const path = new Path();
    path.moveTo(centers[0].x, centers[0].y);
    const cp = [];
    for (let i = 0; i < n; i++) {
        const c1 = centers[i];
        const c2 = centers[(i + 1) % n];

        const e1 = edges[i];
        const e2 = edges[(i + 1) % n];

        const a1 = interpolate(-limits[i].angle, limits[i].angle, time, 0.01 * Math.pow(limits[i].length, 1 / 2));
        const d1 = new Vector2().copy(e1).rotateAround(zero2, -a1).setLength(limits[i].length);
        const a2 = interpolate(-limits[(i + 1) % n].angle, limits[(i + 1) % n].angle, time, 0.01 * Math.pow(limits[(i + 1) % n].length, 1 / 2));
        const d2 = new Vector2()
            .copy(e2)
            .negate()
            .rotateAround(zero2, -a2)
            .setLength(limits[(i + 1) % n].length);
        cp.push({
            first: d1.add(c1),
            second: d2.add(c2),
        });
    }
    for (let i = 0; i < n; i++) {
        path.bezierCurveTo(cp[i].first.x, cp[i].first.y, cp[i].second.x, cp[i].second.y, centers[(i + 1) % n].x, centers[(i + 1) % n].y);
    }
    const points = path.getPoints(50);
    const components = new Float32Array(points.length * 3);
    let position = 0;
    for (let point of points) {
        components[position++] = point.x;
        components[position++] = point.y;
        components[position++] = 0;
    }
    return components;
}

export function createAliveMembrane(n: number, r: number, dr: number, color: ColorRepresentation) {
    const [centers, edges, limits] = generateAliveMembrane(r, dr, n);

    const positionAttribute = new BufferAttribute(getPoints(0, centers, edges, limits), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const material = new LineBasicMaterial({ color: color });
    const curve = new Line(geometry, material);

    const angular = randomFrom(-0.1, 0.1);
    return {
        maxR: r + dr,
        minR: r - dr,
        object: curve,
        tick: (time: number) => {
            positionAttribute.set(getPoints(time, centers, edges, limits));
            positionAttribute.needsUpdate = true;
            curve.rotateZ(angular);
        },
        attack: (position: Vector2) => {},
    };
}
