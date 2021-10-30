import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Object3D, Path, Vector2 } from "three";
import { FlagellumConfiguration, Unwrap } from "../configuration";
import { getComponents } from "../utils/draw";
import { randomFrom } from "../utils/math";
import { zero2 } from "../utils/geometry";
import { calculateDeformation, Deformation } from "./deformation";

interface Flagellum {
    points: Vector2[];
    deformations: Deformation[];
    length: number;
}

function generateFlagellum(target: Vector2, { segmentLength, amplitude, skewLimit }: Unwrap<FlagellumConfiguration>) {
    const segments = Math.max(1, Math.ceil(target.length() / segmentLength));
    const ort = new Vector2()
        .copy(target)
        .rotateAround(zero2, Math.PI / 2)
        .normalize();
    const points = [new Vector2(0, 0)];
    const deformations = [];
    let sign = 1;
    for (let i = 0; i <= segments; i++) {
        const jitter = i == 0 || i == segments ? 0 : randomFrom(0, amplitude) * sign;
        sign = -sign;
        const point = new Vector2(0, 0).addScaledVector(target, i / segments).addScaledVector(ort, jitter);
        points.push(point);
    }

    sign = 1;
    let length = 0;
    for (let i = 0; i < points.length; i++) {
        if (i > 0) {
            length += points[i].distanceTo(points[i - 1]);
        }
        const angle = randomFrom(skewLimit / 2, skewLimit) * sign;
        sign = -sign;
        const next = i == 0 ? points[i + 1] : points[i - 1];
        const distance = points[i].distanceTo(next);
        deformations.push({ angle, length: distance / 2 });
    }
    return { points, length, deformations };
}

function calculateFlagellumPoints({ points, length, deformations }: Flagellum, startDirection: Vector2, finishDirection: Vector2, { inOutRatio }: Unwrap<FlagellumConfiguration>, time: number) {
    let k = time * length;
    const path = new Path();
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        let current = points[i].distanceTo(points[i - 1]);
        const direction1 = i == 1 ? startDirection : new Vector2().subVectors(points[i], points[i - 1]);
        const direction2 = i == points.length - 1 ? finishDirection : new Vector2().subVectors(points[i], points[i + 1]);
        const c = Math.pow(1 - Math.min(time, 1), 1 / 2);
        const a1 = deformations[i - 1].angle * c;
        const a2 = deformations[i].angle * c;
        const c1 = calculateDeformation(points[i - 1], direction1, { ...deformations[i - 1], angle: a1 }, 0);
        const c2 = calculateDeformation(points[i], direction2, { ...deformations[i], angle: a2 }, 0);
        if (current > k) {
            const alpha = k / current;
            const i1 = new Vector2().addScaledVector(points[i - 1], 1 - alpha).addScaledVector(c1, alpha);
            const j1 = new Vector2().addScaledVector(c1, 1 - alpha).addScaledVector(c2, alpha);
            const k1 = new Vector2().addScaledVector(c2, 1 - alpha).addScaledVector(points[i], alpha);
            const i2 = new Vector2().addScaledVector(i1, 1 - alpha).addScaledVector(j1, alpha);
            const j2 = new Vector2().addScaledVector(j1, 1 - alpha).addScaledVector(k1, alpha);
            const i3 = new Vector2().addScaledVector(i2, 1 - alpha).addScaledVector(j2, alpha);
            path.bezierCurveTo(i1.x, i1.y, i2.x, i2.y, i3.x, i3.y);
            break;
        } else {
            path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, points[i].x, points[i].y);
            k -= current;
        }
    }
    return path.getPoints(50);
}

export interface FlagellumState {
    startDirection: Vector2;
    finishDirection: Vector2;
    target: Vector2;
    startIn: number;
    finishIn: number;
    startOut: number;
    finishOut: number;
}

export function createFlagellum({ startDirection, finishDirection, target, startIn, finishIn, startOut, finishOut }: FlagellumState, configuration: Unwrap<FlagellumConfiguration>) {
    const material = new LineBasicMaterial({ color: configuration.color });
    const flagellum = generateFlagellum(target, configuration);
    let positionAttribute = new BufferAttribute(getComponents(calculateFlagellumPoints(flagellum, startDirection, finishDirection, configuration, 0)), 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const curve = new Line(geometry, material);
    return {
        object: curve,
        tick: (time: number) => {
            if (time > finishOut) {
                return;
            }
            let relativeTime = 0;
            if (time < finishIn) {
                relativeTime = (time - startIn) / (finishIn - startIn);
            } else if (time > startOut) {
                relativeTime = 1 - (time - startOut) / (finishOut - startOut);
            } else {
                relativeTime = 1 + (Math.min(time - finishIn, startOut - time) / (startOut - finishIn)) * 2;
            }
            const current = calculateFlagellumPoints(flagellum, startDirection, finishDirection, configuration, relativeTime);
            if (current.length === positionAttribute.count) {
                positionAttribute.set(getComponents(current));
                positionAttribute.needsUpdate = true;
            } else {
                const update = new BufferAttribute(getComponents(current), 3);
                geometry.setAttribute("position", update);
                positionAttribute = update;
            }
        },
    };
}
