import { getRegularPolygon, inSector, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Line, LineBasicMaterial, Mesh, Path, ShaderMaterial, Uniform, Vector2, Vector3 } from "three";
import { extrapolate, interpolate, randomFrom } from "../utils/math";
import { FlagellumConfiguration, MembraneConfiguration, Unwrap } from "../configuration";
import { getComponents } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation, findDeformationAngleTime } from "./deformation";
import { createFlagellumTree } from "./flagellum-tree";
import GlowVertexShader from "../shaders/glow-vertex.shader";
import GlowFragmentShader from "../shaders/glow-fragment.shader";
import { createFlagellum } from "./flagellum";

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
    for (let i = 0; i < n; i++) {
        const t1 = calculateLockedTime(membrane.locks[i].out, time);
        const direction1 = membrane.directions[i];
        const c1 = calculateDeformation(membrane.anchors[i], direction1, membrane.deformations[i], t1);

        const t2 = calculateLockedTime(membrane.locks[(i + 1) % n].in, time);
        const direction2 = new Vector2().copy(membrane.directions[(i + 1) % n]).negate();
        const c2 = calculateDeformation(membrane.anchors[(i + 1) % n], direction2, membrane.deformations[(i + 1) % n], t2);

        if (i == n - 1) {
            // console.info(calculateDeformationAngle(membrane.deformations[i], t1));
        }
        controlPoints.push({ first: c1, second: c2 });
    }

    const path = new Path();
    path.moveTo(membrane.anchors[0].x, membrane.anchors[0].y);
    for (let i = 0; i < n; i++) {
        path.bezierCurveTo(controlPoints[i].first.x, controlPoints[i].first.y, controlPoints[i].second.x, controlPoints[i].second.y, membrane.anchors[(i + 1) % n].x, membrane.anchors[(i + 1) % n].y);
    }
    return [new Vector2(0, 0), ...path.getPoints(detalization)];
}

export function createAliveMembrane(membraneConfig: Unwrap<MembraneConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>) {
    const membrane = generateAliveMembrane(membraneConfig);
    const initialPoints = calculateMembranePoints(membrane, membraneConfig.detalization, 0);
    const n = initialPoints.length - 1;
    const positionAttribute = new BufferAttribute(getComponents(initialPoints), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const normals = [];
    for (let i = 0; i < initialPoints.length; i++) {
        normals.push(...[0, 0, 1]);
    }
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    const index = [];
    for (let i = 0; i < n; i++) {
        index.push(...[0, i + 1, ((i + 1) % n) + 1]);
    }
    geometry.setIndex(index);
    // const material = new LineBasicMaterial({ color: membraneConfig.color });

    const cellColor = new Color(membraneConfig.color);
    const cellColorHsl = { h: 0, s: 0, l: 0 };
    cellColor.getHSL(cellColorHsl);
    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(new Vector3(cellColorHsl.h, cellColorHsl.s, cellColorHsl.l)),
            start: new Uniform(0.8),
        },
        vertexShader: GlowVertexShader,
        fragmentShader: GlowFragmentShader,
        transparent: true,
    });

    const curve = new Mesh(geometry, material);
    const angular = randomFrom(-membraneConfig.angularLimit, membraneConfig.angularLimit);
    let trees = [];
    let lastTime = 0;
    return {
        // maxR: r + dr,
        // minR: r - dr,
        object: curve,
        tick: (time: number) => {
            lastTime = time;
            for (let i = 0; i < trees.length; i++) {
                if (trees[i].finish < time) {
                    curve.remove(trees[i].object);
                }
            }
            trees = trees.filter((t) => t.finish > time);
            for (let i = 0; i < trees.length; i++) {
                trees[i].tick(time);
            }
            const t = time * membraneConfig.frequency;
            const points = calculateMembranePoints(membrane, membraneConfig.detalization, t);
            positionAttribute.set(getComponents(points));
            positionAttribute.needsUpdate = true;
            // curve.rotateZ(angular);
        },
        attack: (targets: Vector2[]) => {
            const t = lastTime * membraneConfig.frequency;
            const n = membrane.anchors.length;
            for (let i = 0; i < targets.length; i++) {
                const { point, id } = membrane.getSector(targets[i]);
                const start1 = findDeformationAngleTime(membrane.deformations[id], t, -Math.abs(membrane.deformations[id].angle));
                const start2 = findDeformationAngleTime(membrane.deformations[id], t, Math.abs(membrane.deformations[id].angle));
                const finish1 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + 2000 * membraneConfig.frequency, -Math.abs(membrane.deformations[id].angle));
                const finish2 = findDeformationAngleTime(membrane.deformations[id], Math.max(start1, start2) + 2000 * membraneConfig.frequency, Math.abs(membrane.deformations[id].angle));
                membrane.locks[id].out = { start: start1, finish: finish1 };
                membrane.locks[id].in = { start: start2, finish: finish2 };
                const flagellum = createFlagellum(
                    {
                        startDirection: new Vector2().copy(point),
                        finishDirection: new Vector2().subVectors(targets[i], point),
                        startIn: start1 / membraneConfig.frequency,
                        finishIn: start1 / membraneConfig.frequency + 600,
                        startOut: start1 / membraneConfig.frequency + 1000,
                        finishOut: Math.max(start1, start2) / membraneConfig.frequency + 2000,
                        target: new Vector2().subVectors(targets[i], point),
                    },
                    flagellumConfig
                );
                flagellum.object.position.set(point.x, point.y, 0);
                curve.add(flagellum.object);
                trees.push(flagellum);
            }
            // for (let i = 0; i < n; i++) {
            //     const group = [];
            //     for (let s = 0; s < targets.length; s++) {
            //         const anchor = membrane.getSector(targets[s]);
            //         if (anchor === membrane.anchors[i]) {
            //             group.push(targets[s]);
            //         }
            //     }
            //     if (group.length === 0) {
            //         continue;
            //     }
            //     const start1 = findDeformationAngleTime(membrane.deformations[i], t, -Math.abs(membrane.deformations[i].angle));
            //     const start2 = findDeformationAngleTime(membrane.deformations[i], t, Math.abs(membrane.deformations[i].angle));
            //     const finish1 = findDeformationAngleTime(membrane.deformations[i], Math.max(start1, start2) + 4000 * membraneConfig.frequency, -Math.abs(membrane.deformations[i].angle));
            //     const finish2 = findDeformationAngleTime(membrane.deformations[i], Math.max(start1, start2) + 4000 * membraneConfig.frequency, Math.abs(membrane.deformations[i].angle));
            //     membrane.locks[i].out = { start: start1, finish: finish1 };
            //     membrane.locks[i].in = { start: start2, finish: finish2 };
            //     const anchor = membrane.anchors[i];
            //     const next = new Vector2().copy(anchor);
            //     for (let s = 0; s < group.length; s++) {
            //         next.add(group[s]);
            //     }
            //     next.multiplyScalar(1 / (group.length + 1));
            //     const flagellum = createFlagellumTree(
            //         {
            //             startDirection: new Vector2().copy(anchor).multiplyScalar(0.1),
            //             branchPoint: new Vector2().subVectors(next, anchor),
            //             targets: group.map((p) => new Vector2().subVectors(p, anchor)),
            //             start: Math.max(start1, start2) / membraneConfig.frequency,
            //             finish: Math.max(start1, start2) / membraneConfig.frequency + 4000,
            //         },
            //         flagellumConfig
            //     );
            //     flagellum.object.position.set(anchor.x, anchor.y, 0);
            //     curve.add(flagellum.object);
            //     trees.push(flagellum);
            // }
        },
    };
}
