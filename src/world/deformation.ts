import { Vector2 } from "three";
import { extrapolate, interpolate } from "../utils/math";
import { zero2 } from "../utils/geometry";

export interface Deformation {
    angle: number;
    length: number;
}

export function findDeformationAngleTime(deformation: Deformation, time: number, target: number) {
    return extrapolate(-deformation.angle, deformation.angle, time, target, Math.pow(deformation.length, 1 / 2));
}

export function calculateDeformationAngle(deformation: Deformation, time: number) {
    return interpolate(-deformation.angle, deformation.angle, time, Math.pow(deformation.length, 1 / 2));
}

export function calculateDeformation(anchor: Vector2, direction: Vector2, deformation: Deformation, time: number) {
    const angle = calculateDeformationAngle(deformation, time);
    return new Vector2().copy(direction).rotateAround(zero2, -angle).setLength(deformation.length).add(anchor);
}
