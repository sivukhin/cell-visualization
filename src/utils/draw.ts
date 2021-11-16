import { Color, ColorRepresentation, Vector2, Vector3 } from "three";
import { zero2 } from "./geometry";

export function getFlatComponents3D(points: Vector2[]): Float32Array {
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
    positions: Float32Array;
    indices: number[];
}

export function createFigureFromPath(path: Vector2[], thickness: (d: number) => number): Figure {
    if (path.length <= 1) {
        return { positions: new Float32Array(), indices: [] };
    }
    const positions = [];
    let distance = 0;
    for (let i = 0; i < path.length; i++) {
        if (i != 0) {
            distance += path[i].distanceTo(path[i - 1]);
        }
        const v = i + 1 < path.length ? new Vector2().subVectors(path[i + 1], path[i]) : new Vector2().subVectors(path[i], path[i - 1]);
        const u = v.rotateAround(zero2, Math.PI / 2).setLength(thickness(distance));
        positions.push(new Vector2().addVectors(path[i], u));
        positions.push(new Vector2().subVectors(path[i], u));
    }
    const indices = [];
    for (let i = 0; i < path.length - 1; i++) {
        indices.push(2 * i, 2 * (i + 1), 2 * i + 1);
        indices.push(2 * i + 1, 2 * (i + 1), 2 * (i + 1) + 1);
    }
    return {
        positions: getFlatComponents3D(positions),
        indices,
    };
}

export function getHSL(repr: ColorRepresentation): { h: number; s: number; l: number } {
    const color = new Color(repr);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return hsl;
}

export function getHSLVector(repr: ColorRepresentation): Vector3 {
    const hsl = getHSL(repr);
    return new Vector3(hsl.h, hsl.s, hsl.l);
}

export function to2(v: Vector3): Vector2 {
    return new Vector2(v.x, v.y);
}

export function to3(v: Vector2): Vector3 {
    return new Vector3(v.x, v.y, 0);
}
