import { Vector2 } from "three";
import { interpolate } from "../utils/math";
import { zero2 } from "../utils/geometry";

export interface Deformation {
    angle: number;
    length: number;
}

export function calculateDeformation(anchor: Vector2, direction: Vector2, deformation: Deformation, time: number) {
    const angle = interpolate(-deformation.angle, deformation.angle, time, Math.pow(deformation.length, 1 / 2));
    return new Vector2().copy(direction).rotateAround(zero2, -angle).setLength(deformation.length).add(anchor);
}
