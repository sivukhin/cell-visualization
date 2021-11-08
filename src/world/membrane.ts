import { getRegularPolygon, inSector, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Path, Vector2 } from "three";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { getFlatComponents3D } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation, findDeformationAngleTime } from "./deformation";

interface DeformationLock {
    start: number;
    finish: number;
}

interface VertexLock {
    out?: DeformationLock;
    in?: DeformationLock;
}

interface Membrane {
    anchors: Vector2[];
    directions: Vector2[];
    deformations: Deformation[];
    locks: VertexLock[];
    getSector(p: Vector2): { point: Vector2; id: number };
}

function calculateLockedTime(lock: DeformationLock | undefined, time: number): number {
    if (lock != undefined && lock.start < time && time < lock.finish) {
        return lock.start;
    }
    return time;
}

function generateAliveMembrane({ segments, radius, delta, skewLimit }: Unwrap<MembraneConfiguration>): Membrane {
    const skeleton = getRegularPolygon(segments, radius / Math.cos(Math.PI / segments));
    const directions: Vector2[] = [];
    const anchors: Vector2[] = [];
    for (let i = 0; i < segments; i++) {
        const direction = new Vector2().subVectors(skeleton[(i + 1) % segments], skeleton[i]);
        directions.push(direction);
        anchors.push(new Vector2().copy(skeleton[i]).addScaledVector(direction, 0.5));
    }

    const deformations: Deformation[] = [];
    const locks: VertexLock[] = [];
    let sign = 1;
    for (let i = 0; i < segments; i++) {
        locks.push({ in: undefined, out: undefined });

        const angle = (1 + Math.random()) * skewLimit;
        const intersectionOuter = tryIntersectLineCircle(anchors[i], new Vector2().copy(directions[i]).rotateAround(zero2, -angle), zero2, radius + delta);
        const intersectionInner = tryIntersectLineCircle(anchors[i], new Vector2().copy(directions[i]).rotateAround(zero2, angle), zero2, radius - delta);
        if (intersectionOuter == null && intersectionInner == null) {
            throw new Error("invalid operation");
        }
        const outer = intersectionOuter == null ? Infinity : intersectionOuter.distanceTo(anchors[i]);
        const inner = intersectionInner == null ? Infinity : intersectionInner.distanceTo(anchors[i]);
        deformations.push({
            angle: sign * angle,
            length: Math.min(outer, inner, directions[i].length() / 2),
        });
        sign = -sign;
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

function calculateMembranePoints(membrane: Membrane, detalization: number, time: number) {
    const n = membrane.anchors.length;
    const controlPoints = [];
    const pivots = [];
    const thickness = [];
    for (let i = 0; i < n; i++) {
        const t1 = calculateLockedTime(membrane.locks[i].out, time);
        const direction1 = membrane.directions[i];
        const c1 = calculateDeformation(membrane.anchors[i], direction1, membrane.deformations[i], t1);

        const t2 = calculateLockedTime(membrane.locks[(i + 1) % n].in, time);
        const direction2 = new Vector2().copy(membrane.directions[(i + 1) % n]).negate();
        const c2 = calculateDeformation(membrane.anchors[(i + 1) % n], direction2, membrane.deformations[(i + 1) % n], t2);
        controlPoints.push({ first: c1, second: c2 });

        const a1 = calculateDeformationAngle(membrane.deformations[i], calculateLockedTime(membrane.locks[i].out, time));
        const a2 = calculateDeformationAngle(membrane.deformations[i], calculateLockedTime(membrane.locks[i].in, time));
        const current = 0.1 + 0.9 * Math.exp(-Math.pow(Math.abs(a1 - a2), 2));
        pivots.push(current);
    }
    thickness.push(pivots[0]);
    for (let i = 0; i < n; i++) {
        for (let s = 0; s < detalization; s++) {
            const alpha = (s + 1) / detalization;
            thickness.push((1 - alpha) * pivots[i] + alpha * pivots[(i + 1) % n]);
        }
    }

    const path = new Path();
    path.moveTo(membrane.anchors[0].x, membrane.anchors[0].y);
    for (let i = 0; i < n; i++) {
        path.bezierCurveTo(controlPoints[i].first.x, controlPoints[i].first.y, controlPoints[i].second.x, controlPoints[i].second.y, membrane.anchors[(i + 1) % n].x, membrane.anchors[(i + 1) % n].y);
    }
    return { points: path.getPoints(detalization), thickness: new Float32Array([1, ...thickness]) };
}

export function createAliveMembrane(membraneConfig: Unwrap<MembraneConfiguration>) {
    const membrane = generateAliveMembrane(membraneConfig);
    const { points: initialPoints, thickness: initialThickness } = calculateMembranePoints(membrane, membraneConfig.detalization, 0);
    const n = initialPoints.length;
    const positionAttribute = new BufferAttribute(getFlatComponents3D([new Vector2(0, 0), ...initialPoints]), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const normals = [];
    for (let i = 0; i < n + 1; i++) {
        normals.push(...[0, 0, 1]);
    }
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    const thicknessAttribute = new BufferAttribute(initialThickness, 1);
    thicknessAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("thickness", thicknessAttribute);
    const index = [];
    for (let i = 0; i < n; i++) {
        index.push(...[0, i + 1, ((i + 1) % n) + 1]);
    }
    geometry.setIndex(index);
    return {
        geometry: geometry,
        membrane: membrane,
        tick: (time: number) => {
            const t = time * membraneConfig.frequency;
            const { points, thickness } = calculateMembranePoints(membrane, membraneConfig.detalization, t);
            thicknessAttribute.set(thickness);
            thicknessAttribute.needsUpdate = true;
            positionAttribute.set(getFlatComponents3D([new Vector2(0, 0), ...points]));
            positionAttribute.needsUpdate = true;
        },
    };
}
