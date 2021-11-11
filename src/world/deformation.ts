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
    const angle = interpolate(-deformation.angle, deformation.angle, time, Math.pow(deformation.length, 1 / 2));
    const normalizator = Math.sign(angle) * Math.abs(deformation.angle);
    const value = angle / normalizator;
    return angle;
    return Math.min(1, Math.max(0, value)) * normalizator;
}

export function calculateDeformation(anchor: Vector2, direction: Vector2, deformation: Deformation, time: number) {
    const angle = calculateDeformationAngle(deformation, time);
    return new Vector2().copy(direction).rotateAround(zero2, -angle).setLength(deformation.length).add(anchor);
}

export function modifyDeformation(deformation: Deformation, angleStretch: number, lengthStretch: number) {
    return {
        angle: deformation.angle * angleStretch,
        length: deformation.length * lengthStretch,
    };
}
