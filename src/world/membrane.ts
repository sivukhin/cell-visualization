import { getRegularPolygon, inSector, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Path, Vector2 } from "three";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { getFlatComponents3D } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation } from "./deformation";
import { randomFrom } from "../utils/math";

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
    getSector(p: Vector2): Sector;
}

interface Membrane {
    radius: number;
}

function calculateLockedTime(lock: DeformationLock | undefined, time: number): number {
    if (lock != undefined && lock.start < time && time < lock.finish) {
        return lock.start;
    }
    return time;
}

function generateAliveMembrane({ radius }: Membrane, { segments, wobbling, skew }: Unwrap<MembraneConfiguration>): MembraneSkeleton {
    const skeleton = getRegularPolygon(segments, radius / Math.cos(Math.PI / segments));
    const directions: Vector2[] = [];
    const anchors: Vector2[] = [];
    for (let i = 0; i < segments; i++) {
        const direction = new Vector2().subVectors(skeleton[(i + 1) % segments], skeleton[i]);
        directions.push(direction);
        anchors.push(new Vector2().copy(skeleton[i]).addScaledVector(direction, 0.5));
    }

    let sign = 1;
    const deformations: Deformation[] = [];
    for (let i = 0; i < segments; i++) {
        const angle = skew * randomFrom(0.5, 1);
        deformations.push({
            angle: sign * angle,
            length: radius * wobbling,
        });
        sign = -sign;
    }

    const locks: VertexLock[] = [];
    for (let i = 0; i < segments; i++) {
        locks.push({ in: undefined, out: undefined });
    }
    return {
        anchors: anchors,
        directions: directions,
        locks: locks,
        deformations: deformations,
        getSector(p: Vector2): { point: Vector2; id: number } {
            for (let i = 0; i < skeleton.length; i++) {
                const a = skeleton[i];
                const b = skeleton[(i + 1) % skeleton.length];
                if (inSector(p, a, b)) {
                    return { point: anchors[i], id: i };
                }
            }
            throw new Error(`can't determine sector for point ${p.x} ${p.y}`);
        },
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
    const thickness = [pivots[0]];
    for (let i = 0; i < n; i++) {
        for (let s = 0; s < pathDetalization; s++) {
            const alpha = (s + 1) / pathDetalization;
            thickness.push((1 - alpha) * pivots[i] + alpha * pivots[(i + 1) % n]);
        }
    }
    return { points: path.getPoints(config.detalization), thickness: thickness };
}

export function createAliveMembrane(membrane: Membrane, config: Unwrap<MembraneConfiguration>) {
    const skeleton = generateAliveMembrane(membrane, config);
    const { points: initialPoints, thickness: initialThickness } = calculateMembranePoints(skeleton, config, 0);
    const n = initialPoints.length;
    const positionAttribute = new BufferAttribute(getFlatComponents3D([zero2, ...initialPoints]), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const thicknessAttribute = new BufferAttribute(new Float32Array([1, ...initialThickness]), 1);
    thicknessAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("thickness", thicknessAttribute);
    const index = [];
    for (let i = 0; i < n; i++) {
        index.push(0, i + 1, ((i + 1) % n) + 1);
    }
    geometry.setIndex(index);
    return {
        geometry: geometry,
        membrane: skeleton,
        tick: (time: number) => {
            const t = time * config.frequency;
            const { points, thickness } = calculateMembranePoints(skeleton, config, t);
            thicknessAttribute.set(new Float32Array([1, ...thickness]));
            thicknessAttribute.needsUpdate = true;
            positionAttribute.set(getFlatComponents3D([zero2, ...points]));
            positionAttribute.needsUpdate = true;
        },
    };
}
