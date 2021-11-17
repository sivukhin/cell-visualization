import { Color, Vector2, Vector3 } from "three";
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
    const id = Math.min(array.length - 1, Math.floor(randomFrom(0, array.length)));
    return array[id];
}

export function randomChoiceNonRepeat<T>(array: T[], occupied: boolean[]): T {
    while (true) {
        const id = Math.min(array.length - 1, Math.floor(randomFrom(0, array.length)));
        if (occupied[id]) {
            continue;
        }
        occupied[id] = true;
        return array[id];
    }
}

export function randomVector(length: number): Vector2 {
    const angle = Math.random() * Math.PI * 2;
    return new Vector2(length, 0).rotateAround(zero2, angle);
}

export function interpolateLinear1D(a: number, b: number, l: number, r: number, t: number) {
    const alpha = Math.max(0, Math.min(1, (t - l) / (r - l)));
    return (1 - alpha) * a + alpha * b;
}

export function interpolateLinear2D(a: Vector2, b: Vector2, l: number, r: number, t: number) {
    const alpha = Math.max(0, Math.min(1, (t - l) / (r - l)));
    return new Vector2().addScaledVector(a, 1 - alpha).addScaledVector(b, alpha);
}

export function interpolateLinear3D(a: Vector3, b: Vector3, l: number, r: number, t: number) {
    const alpha = Math.max(0, Math.min(1, (t - l) / (r - l)));
    return new Vector3().addScaledVector(a, 1 - alpha).addScaledVector(b, alpha);
}

export function interpolateLinearColor(a: Color, b: Color, l: number, r: number, t: number) {
    const alpha = Math.max(0, Math.min(1, (t - l) / (r - l)));
    return new Color(a.r * (1 - alpha) + b.r * alpha, a.g * (1 - alpha) + b.g * alpha, a.b * (1 - alpha) + b.b * alpha);
}

export function interpolateMany(values: number[], l: number, r: number) {
    let min = values[0];
    let max = values[0];
    for (const value of values) {
        min = Math.min(min, value);
        max = Math.max(max, value);
    }
    const result: number[] = [];
    for (const value of values) {
        result.push(l + ((value - min) / (max - min)) * (r - l));
    }
    return result;
}
