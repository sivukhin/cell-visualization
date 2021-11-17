import { scalePoints, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Path, Vector2 } from "three";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { getFlatComponents3D } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation, findDeformationAngleTime } from "./deformation";
import { randomFrom } from "../utils/math";
import { lastTick } from "../utils/tick";

interface DeformationLock {
    start: number;
    finish: number;
}

interface VertexLock {
    out?: DeformationLock;
    in?: DeformationLock;
}

interface Sector {
    point: Vector2;
    id: number;
}

interface MembraneSkeleton {
    anchors: Vector2[];
    directions: Vector2[];
    deformations: Deformation[];
    locks: VertexLock[];
}

export interface AliveMembrane {
    points: Vector2[];
}

function calculateLockedTime(lock: DeformationLock | undefined, time: number): number {
    if (lock != undefined && lock.start < time && time < lock.finish) {
        return lock.start;
    }
    return time;
}

function generateAliveMembrane({ points }: AliveMembrane, { wobbling, skew }: Unwrap<MembraneConfiguration>): MembraneSkeleton {
    const directions: Vector2[] = [];
    const anchors: Vector2[] = [];
    for (let i = 0; i < points.length; i++) {
        const direction = new Vector2().subVectors(points[(i + 1) % points.length], points[i]);
        directions.push(direction);
        anchors.push(new Vector2().copy(points[i]).addScaledVector(direction, 0.5));
    }

    let sign = 1;
    const deformations: Deformation[] = [];
    for (let i = 0; i < points.length; i++) {
        const angle = skew * randomFrom(0.5, 1);
        deformations.push({
            angle: sign * angle,
            length: points[i].distanceTo(points[(i + 1) % points.length]) * wobbling,
        });
        sign = -sign;
    }

    const locks: VertexLock[] = [];
    for (let i = 0; i < points.length; i++) {
        locks.push({ in: undefined, out: undefined });
    }
    return {
        anchors: anchors,
        directions: directions,
        locks: locks,
        deformations: deformations,
    };
}

function calculateMembranePoints(membrane: MembraneSkeleton, config: Unwrap<MembraneConfiguration>, time: number) {
    const n = membrane.anchors.length;
    const controlPoints = [];
    for (let i = 0; i < n; i++) {
        const t1 = calculateLockedTime(membrane.locks[i].out, time);
        const direction1 = membrane.directions[i];
        const c1 = calculateDeformation(membrane.anchors[i], direction1, membrane.deformations[i], t1);

        const t2 = calculateLockedTime(membrane.locks[(i + 1) % n].in, time);
        const direction2 = new Vector2().copy(membrane.directions[(i + 1) % n]).negate();
        const c2 = calculateDeformation(membrane.anchors[(i + 1) % n], direction2, membrane.deformations[(i + 1) % n], t2);
        controlPoints.push({ first: c1, second: c2 });
    }

    const path = new Path();
    path.moveTo(membrane.anchors[0].x, membrane.anchors[0].y);
    let pathDetalization = config.detalization;
    if (config.spline) {
        pathDetalization = 4 * config.detalization;
        for (let i = 0; i < n; i++) {
            path.splineThru([controlPoints[i].first, controlPoints[i].second, membrane.anchors[(i + 1) % n]]);
        }
    } else {
        for (let i = 0; i < n; i++) {
            path.bezierCurveTo(
                controlPoints[i].first.x,
                controlPoints[i].first.y,
                controlPoints[i].second.x,
                controlPoints[i].second.y,
                membrane.anchors[(i + 1) % n].x,
                membrane.anchors[(i + 1) % n].y
            );
        }
    }

    const pivots = [];
    for (let i = 0; i < n; i++) {
        const a1 = calculateDeformationAngle(membrane.deformations[i], calculateLockedTime(membrane.locks[i].out, time));
        const a2 = calculateDeformationAngle(membrane.deformations[i], calculateLockedTime(membrane.locks[i].in, time));
        const current = config.thorness + (1 - config.thorness) * Math.min(1, Math.pow(2, 5 * (a1 - a2) - 1));
        pivots.push(current);
    }
    const thickness = [1];
    for (let i = 0; i < n; i++) {
        for (let s = 0; s < pathDetalization; s++) {
            const alpha = (s + 1) / pathDetalization;
            // thickness.push((1 - alpha) * pivots[i] + alpha * pivots[(i + 1) % n]);
            thickness.push(1);
        }
    }
    return { points: path.getPoints(config.detalization), thickness: thickness };
}

interface MembraneGeometry {
    geometry: BufferGeometry;
    tick(time: number): void;
    thorn(id: number, duration: number): number;
    scale(scale: number): void;
    getScale(): number;
}

export function createAliveMembrane(membrane: AliveMembrane, config: Unwrap<MembraneConfiguration>): MembraneGeometry {
    const geometry = new BufferGeometry();
    let skeleton = generateAliveMembrane(membrane, config);
    let positionAttribute = null;
    let thicknessAttribute = null;
    const update = (data: AliveMembrane) => {
        skeleton = generateAliveMembrane(data, config);
        const { points, thickness } = calculateMembranePoints(skeleton, config, 0);
        positionAttribute = new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3);
        positionAttribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("position", positionAttribute);

        thicknessAttribute = new BufferAttribute(new Float32Array([1, ...thickness]), 1);
        thicknessAttribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("thickness", thicknessAttribute);

        const index = [];
        for (let i = 0; i < points.length; i++) {
            index.push(0, i + 1, ((i + 1) % points.length) + 1);
        }
        geometry.setIndex(index);
    };

    update(membrane);
    let scale = 1.0;

    return {
        geometry: geometry,
        thorn: (id: number, duration: number) => {
            const t = lastTick() * config.frequency;
            const start1 = findDeformationAngleTime(skeleton.deformations[id], t, -Math.abs(skeleton.deformations[id].angle));
            const start2 = findDeformationAngleTime(skeleton.deformations[id], t, Math.abs(skeleton.deformations[id].angle));
            const finish1 = findDeformationAngleTime(skeleton.deformations[id], Math.max(start1, start2) + duration * config.frequency, -Math.abs(skeleton.deformations[id].angle));
            const finish2 = findDeformationAngleTime(skeleton.deformations[id], Math.max(start1, start2) + duration * config.frequency, Math.abs(skeleton.deformations[id].angle));
            skeleton.locks[id].out = { start: start1, finish: finish1 };
            skeleton.locks[id].in = { start: start2, finish: finish2 };
            return Math.max(start1, start2);
        },
        tick: (time: number) => {
            const t = time * config.frequency;
            const { points, thickness } = calculateMembranePoints(skeleton, config, t);
            thicknessAttribute.set(new Float32Array([1, ...thickness]));
            thicknessAttribute.needsUpdate = true;
            positionAttribute.set(getFlatComponents3D([zero2, ...scalePoints(points, scale)]));
            positionAttribute.needsUpdate = true;
        },
        scale: (update: number) => {
            scale = update;
        },
        getScale: () => {
            return scale;
        },
    };
}
