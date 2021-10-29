import { Vector2 } from "three";
import { zero2 } from "./geometry";

export function interpolate(l: number, r: number, time: number, inScale?: number, outScale?: number): number {
    if (inScale == undefined) {
        inScale = 1;
    }
    if (outScale == undefined) {
        outScale = inScale;
    }
    const d = Math.abs(r - l);
    let delta = time % (d / inScale + d / outScale);
    if (delta < d / inScale) {
        delta *= inScale;
    } else {
        delta = d - (delta - d / inScale) * outScale;
    }
    return l + (l > r ? -1 : +1) * delta;
}

export function randomFrom(l: number, r: number) {
    return Math.random() * (r - l) + l;
}

export function randomVector(length: number): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(length, 0).rotateAround(zero2, angle);
}
