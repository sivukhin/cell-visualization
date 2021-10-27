import { Vector2 } from "three";
import { zero2 } from "./geometry";

export function interpolate(l: number, r: number, time: number, scale: number): number {
    const k = time * scale;
    const d = Math.abs(r - l);
    let delta = k % (2 * d);
    if (delta > d) {
        delta = 2 * d - delta;
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
