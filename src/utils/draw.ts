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
