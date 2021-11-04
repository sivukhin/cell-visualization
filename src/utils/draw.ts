import { Vector2 } from "three";
import { zero2 } from "./geometry";

export function getComponents(points: Vector2[]): Float32Array {
    const components = new Float32Array(points.length * 3);
    let position = 0;
    for (let point of points) {
        components[position++] = point.x;
        components[position++] = point.y;
        components[position++] = 0;
    }
    return components;
}

export function cutBezierCurve(start: Vector2, c1: Vector2, c2: Vector2, end: Vector2, alpha: number) {
    const i1 = new Vector2().addScaledVector(start, 1 - alpha).addScaledVector(c1, alpha);
    const j1 = new Vector2().addScaledVector(c1, 1 - alpha).addScaledVector(c2, alpha);
    const k1 = new Vector2().addScaledVector(c2, 1 - alpha).addScaledVector(end, alpha);
    const i2 = new Vector2().addScaledVector(i1, 1 - alpha).addScaledVector(j1, alpha);
    const j2 = new Vector2().addScaledVector(j1, 1 - alpha).addScaledVector(k1, alpha);
    const i3 = new Vector2().addScaledVector(i2, 1 - alpha).addScaledVector(j2, alpha);
    return { c1: i1, c2: i2, end: i3 };
}

export interface Figure {
    points: Float32Array;
    indices: number[];
}

export function createFigureFromPath(path: Vector2[]): Figure {
    const points = [];
    for (let i = 0; i < path.length; i++) {
        const v = i + 1 < path.length ? new Vector2().subVectors(path[i + 1], path[i]) : new Vector2().subVectors(path[i - 1], path[i]);
        const u = v.rotateAround(zero2, Math.PI / 2);
        points.push(new Vector2().addVectors(points[i], u));
        points.push(new Vector2().subVectors(points[i], u));
    }
    const indices = [];
    for (let i = 0; i < path.length - 1; i++) {
        indices.push(...[2 * i, 2 * i + 1, 2 * (i + 1)]);
        indices.push(...[2 * i, 2 * (i + 1), 2 * (i + 1) + 1]);
    }
    return { points: new Float32Array(points), indices };
}
