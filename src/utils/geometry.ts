import * as THREE from "three";
import { Vector2 } from "three";

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
