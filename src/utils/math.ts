import { Vector2 } from "three";
import { zero2 } from "./geometry";

export function extrapolate(l: number, r: number, time: number, target: number, inScale?: number, outScale?: number): number {
    if (l > r) {
        return extrapolate(r, l, time, r + (l - target), inScale, outScale);
    }
    if (inScale == undefined) {
        inScale = 1;
    }
    if (outScale == undefined) {
        outScale = inScale;
    }
    target = target - l;
    const d = Math.abs(r - l);
    let delta = time % (d / inScale + d / outScale);
    if (delta < d / inScale) {
        if (delta * inScale <= target) {
            return time + (target - delta * inScale) / inScale;
        }
        return time + (d - delta * inScale) / inScale + (d - target) / outScale;
    } else {
        delta = d / outScale + d / inScale - delta;
        if (target < delta * outScale) {
            return time + (delta * outScale - target) / outScale;
        }
        return time + (delta * outScale) / outScale + target / inScale;
    }
}

export function interpolate(l: number, r: number, time: number, inScale?: number, outScale?: number): number {
    if (l == r) {
        return l;
    }
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

export function randomChoice<T>(array: T[]): T {
    const id = Math.min(array.length - 1, Math.ceil(randomFrom(0, array.length)));
    return array[id];
}

export function randomVector(length: number): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(length, 0).rotateAround(zero2, angle);
}
