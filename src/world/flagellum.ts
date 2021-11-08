import { BackSide, BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D, Path, Vector2 } from "three";
import { FlagellumConfiguration, Unwrap } from "../configuration";
import { createFigureFromPath, cutBezierCurve, getFlatComponents3D } from "../utils/draw";
import { randomFrom } from "../utils/math";
import { zero2 } from "../utils/geometry";
import { calculateDeformation, Deformation, modifyDeformation } from "./deformation";
import { getRelativeTime, Timings } from "../utils/timings";

interface Flagellum {
    points: Vector2[];
    jitters: Vector2[];
    deformations: Deformation[];
    length: number;
}

function generateFlagellum(target: Vector2, { segmentLength, amplitude, skewLimit }: Unwrap<FlagellumConfiguration>) {
    const ratios = [];
    const distance = target.length();
    let remainder = distance;
    while (remainder >= 0) {
        const ratio = randomFrom(0, segmentLength);
        ratios.push(Math.min(ratio, remainder) / distance);
        remainder -= ratio;
    }
    ratios.sort((a, b) => b - a);

    const segments = ratios.length;
    const ort = new Vector2()
        .copy(target)
        .rotateAround(zero2, Math.PI / 2)
        .normalize();
    const points = [new Vector2(0, 0)];
    const jitters = [new Vector2(0, 0)];
    let sign = Math.sign(randomFrom(-1, 1));
    for (let i = 0; i < segments; i++) {
        const current = amplitude / (i + 1);
        const jitter = i == segments - 1 ? 0 : randomFrom(current / 2, current) * sign;
        sign = -sign;
        const point = new Vector2().copy(points[i]).addScaledVector(target, ratios[i]);
        points.push(point);
        jitters.push(new Vector2().copy(ort).multiplyScalar(jitter));
    }

    const deformations = [];
    sign = Math.sign(randomFrom(-1, 1));
    let length = 0;
    for (let i = 0; i < points.length; i++) {
        if (i > 0) {
            length += points[i].distanceTo(points[i - 1]);
        }
        const angle = i == 0 ? 0 : randomFrom(skewLimit / 2, skewLimit) * sign;
        sign = -sign;
        const next = i == 0 ? points[i + 1] : points[i - 1];
        const distance = points[i].distanceTo(next);
        deformations.push({ angle, length: randomFrom(distance, 2 * distance) });
    }
    return { points, length, deformations, jitters };
}

function calculateFlagellumPoints(
    { points, length, deformations, jitters }: Flagellum,
    startDirection: Vector2,
    finishDirection: Vector2,
    { minWobbling }: Unwrap<FlagellumConfiguration>,
    time: number
) {
    let k = time * length;
    const path = new Path();
    path.moveTo(points[0].x, points[0].y);
    let jittered = [];
    for (let i = 0; i < points.length; i++) {
        const intensity = Math.cos(2 * Math.PI * time) * (1 - Math.min(1, time));
        jittered.push(new Vector2().copy(points[i]).addScaledVector(jitters[i], intensity));
    }
    for (let i = 1; i < jittered.length && k > 0; i++) {
        let current = jittered[i].distanceTo(jittered[i - 1]);
        const direction1 = i == 1 ? startDirection : new Vector2().subVectors(jittered[i], jittered[i - 1]);
        const direction2 = i == jittered.length - 1 ? finishDirection : new Vector2().subVectors(jittered[i], jittered[i + 1]);
        const lengthStretch = minWobbling + (1 - minWobbling) * Math.max(0, 1 - time);
        const angleStretch1 = lengthStretch * Math.cos(Math.PI * time + i - 1);
        const angleStretch2 = lengthStretch * Math.cos(Math.PI * time + i);
        const d1 = modifyDeformation(deformations[i - 1], angleStretch1, lengthStretch);
        const d2 = modifyDeformation(deformations[i], angleStretch2, lengthStretch);
        const c1 = calculateDeformation(jittered[i - 1], direction1, d1, 0);
        const c2 = calculateDeformation(jittered[i], direction2, d2, 0);
        if (current > k) {
            const cut = cutBezierCurve(jittered[i - 1], c1, c2, jittered[i], k / current);
            path.bezierCurveTo(cut.c1.x, cut.c1.y, cut.c2.x, cut.c2.y, cut.end.x, cut.end.y);
        } else {
            path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, jittered[i].x, jittered[i].y);
        }
        k -= current;
    }
    return path.getPoints(50);
}

export interface FlagellumState {
    startDirection: Vector2;
    finishDirection: Vector2;
    target: Vector2;
    timings: Timings;
}

export function createFlagellum({ startDirection, finishDirection, target, timings }: FlagellumState, configuration: Unwrap<FlagellumConfiguration>) {
    const material = new MeshBasicMaterial({ color: configuration.color, side: BackSide, transparent: true });
    const flagellum = generateFlagellum(target, configuration);
    const points = calculateFlagellumPoints(flagellum, startDirection, finishDirection, configuration, 0);
    const figure = createFigureFromPath(points, (d) => Math.max(1, 10 / Math.pow(1 + d, 1 / 2)));
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(figure.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(figure.normals, 3));
    geometry.setIndex(figure.indices);

    const curve = new Mesh(geometry, material);
    return {
        object: curve,
        finish: timings.finishOut,
        tick: (time: number) => {
            if (time > timings.finishOut) {
                return;
            }
            const relativeTime = getRelativeTime(timings, time);
            const current = calculateFlagellumPoints(flagellum, startDirection, finishDirection, configuration, relativeTime);
            // if (current.length === positionAttribute.count) {
            //     positionAttribute.set(getComponents(current));
            //     positionAttribute.needsUpdate = true;
            // } else {
            const update = createFigureFromPath(current, (d) => Math.max(1, 5 / Math.pow(1 + d, 1 / 4)));
            // const update = new BufferAttribute(getFlatComponents3D(current), 3);
            geometry.setAttribute("position", new BufferAttribute(update.positions, 3));
            geometry.setAttribute("normal", new BufferAttribute(update.normals, 3));
            geometry.setIndex(update.indices);
            // }
        },
    };
}
