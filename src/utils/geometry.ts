import * as THREE from "three";
import { Path, Vector2 } from "three";

export const zero2 = new THREE.Vector2(0, 0);
export const zero3 = new THREE.Vector3(0, 0, 0);

export interface Circle {
    center: Vector2;
    radius: number;
}

export function getRegularPolygon(n: number, r: number) {
    const points = [];
    for (let i = 0; i < n; i++) {
        const angle = ((2 * Math.PI) / n) * i;
        points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    return points;
}

export function generateCircles(n: number, spaceRadius: number, radiusLimit: number): Circle[] {
    const centers = [];
    for (let i = 0; i < n; i++) {
        const angle = ((2 * Math.PI) / n) * i;
        const radius = spaceRadius / 2;
        const v = new Vector2(radius, 0).rotateAround(zero2, angle);
        centers.push(v);
    }
    const radiuses = [];
    for (let i = 0; i < n; i++) {
        let maxR = Math.min(radiusLimit, spaceRadius - centers[i].length());
        for (let s = 0; s < i; s++) {
            maxR = Math.min(maxR, centers[i].distanceTo(centers[s]) - radiuses[s]);
        }
        for (let s = i + 1; s < n; s++) {
            maxR = Math.min(maxR, centers[i].distanceTo(centers[s]));
        }
        radiuses.push(((1 + Math.random()) * maxR) / 2);
    }
    const result: Circle[] = [];
    for (let i = 0; i < n; i++) {
        result.push({ center: centers[i], radius: radiuses[i] });
    }
    return result;
}

export function getRadiusForPoints(points: Vector2[], maxR: number): number[] {
    const radiuses = [];
    for (let i = 0; i < points.length; i++) {
        let limit = maxR - points[i].length();
        let r: number = 2 * limit;
        for (let s = 0; s < points.length; s++) {
            if (i == s) {
                continue;
            }
            const distance = points[i].distanceTo(points[s]);
            if (r == null || r > distance) {
                r = distance;
            }
        }
        radiuses.push(r / 2);
    }
    return radiuses;
}

export function getH(p: Vector2, a: Vector2, v: Vector2): Vector2 {
    const k = new Vector2().subVectors(p, a).dot(v);
    return new Vector2()
        .copy(v)
        .multiplyScalar(k / v.lengthSq())
        .add(a);
}

export function getComponents(v: Vector2, e1: Vector2): [Vector2, Vector2] {
    const a = new Vector2().copy(e1).multiplyScalar(v.dot(e1));
    const b = new Vector2().subVectors(v, a);
    return [a, b];
}

export function tryIntersectLines(a: Vector2, v: Vector2, b: Vector2, u: Vector2): Vector2 | null {
    const t = v.cross(u);
    if (Math.abs(t) < 1e-5) {
        return null;
    }
    const k = new Vector2().subVectors(b, a).cross(u) / t;
    return new Vector2().copy(a).addScaledVector(v, k);
}

export function tryIntersectLineCircle(p: Vector2, v: Vector2, c: Vector2, r: number): Vector2 | null {
    const h = getH(c, p, v);
    const d = h.distanceToSquared(c);
    if (d > r * r) {
        return null;
    }
    const l = Math.sqrt(r * r - d) / v.length();
    const a = new Vector2().copy(h).addScaledVector(v, l);
    const b = new Vector2().copy(h).addScaledVector(v, -l);
    return new Vector2().subVectors(a, p).dot(v) > 0 ? a : b;
}

export function inSector(p: Vector2, a: Vector2, b: Vector2): boolean {
    return a.cross(p) > 0 && p.cross(b) >= 0;
}

export function scalePoints(points: Vector2[], scale: number): Vector2[] {
    return points.map((p) => new Vector2().copy(p).multiplyScalar(scale));
}

export function onSegment(point: Vector2, a: Vector2, b: Vector2): boolean {
    const v = new Vector2().subVectors(point, a);
    const u = new Vector2().subVectors(point, b);
    return Math.abs(v.cross(u)) < 1e-5 && v.dot(u) < 0;
}

export function convexHull(points: Vector2[]): Vector2[] {
    let min = points[0];
    for (let i = 0; i < points.length; i++) {
        if (points[i].x < min.x || (points[i].x == min.x && points[i].y < min.y)) {
            min = points[i];
        }
    }
    points.sort((a, b) => {
        if (a == min) {
            return -1;
        }
        if (b == min) {
            return 1;
        }
        const v = new Vector2().subVectors(a, min);
        const u = new Vector2().subVectors(b, min);
        return -v.cross(u);
    });
    const hull = [points[0]];
    for (let i = 1; i < points.length; i++) {
        while (hull.length > 1 && new Vector2().subVectors(hull[hull.length - 1], hull[hull.length - 2]).cross(new Vector2().subVectors(points[i], hull[hull.length - 1])) < 1e-5) {
            hull.splice(hull.length - 1, 1);
        }
        hull.push(points[i]);
    }
    return hull;
}

export function buildSmoothPath(points: Vector2[], r: number, detalization: number): Vector2[] {
    const next = new Array(points.length).fill(-1);
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const v = new Vector2().subVectors(b, a);
        const vOrt = new Vector2()
            .copy(v)
            .rotateAround(zero2, Math.PI / 2)
            .normalize();
        const pa = new Vector2().copy(a).addScaledVector(vOrt, r);
        for (let s = 1; s < n; s++) {
            const k = (i + s) % n;
            const c = points[k];
            const d = points[(k + 1) % n];
            const u = new Vector2().subVectors(d, c);
            const uOrt = new Vector2()
                .copy(u)
                .rotateAround(zero2, Math.PI / 2)
                .normalize();
            const pc = new Vector2().copy(c).addScaledVector(uOrt, r);
            const intersection = tryIntersectLines(pa, v, pc, u);
            if (intersection == null) {
                continue;
            }
            const ha = getH(intersection, a, v);
            const hc = getH(intersection, c, u);
            if (onSegment(ha, a, b) && onSegment(hc, c, d)) {
                next[i] = s;
                break;
            }
        }
    }
    const used = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
        if (used[i]) {
            continue;
        }
        const chain = [];
        let v = i;
        let distance = 0;
        do {
            chain.push(v);
            used[v] = true;
            distance += (next[v] - v + n) % n;
            v = next[v];
        } while (!used[v]);
        if (distance != n) {
            continue;
        }

    }
    throw new Error("not implemented exception");
}

export function simplifyShape(points: Vector2[], k: number): Vector2[] {
    let p = 0;
    for (let i = 0; i < points.length; i++) {
        p += points[i].distanceTo(points[(i + 1) % points.length]);
    }
    const step = p / k;
    const shape = [points[0]];
    for (let i = 1; i < points.length; i++) {
        if (points[i].distanceTo(shape[shape.length - 1]) > step && points[i].distanceTo(points[0]) > step) {
            shape.push(points[i]);
        }
    }
    return shape;
}

export function getSectorIn(p: Vector2, points: Vector2[]): { point: Vector2; id: number } {
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (inSector(p, a, b)) {
            return { point: new Vector2().addVectors(points[i], points[(i + 1) % n]).multiplyScalar(0.5), id: i };
        }
    }
    throw new Error(`can't determine sector for point ${p.x} ${p.y}`);
}
