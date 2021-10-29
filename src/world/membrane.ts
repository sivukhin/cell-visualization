import { getRegularPolygon, inSector, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Path, Vector2 } from "three";
import { interpolate, randomFrom } from "../utils/math";
import { FlagellumConfiguration, MembraneConfiguration, Unwrap } from "../configuration";
import { getComponents } from "../utils/draw";
import { calculateDeformation, Deformation } from "./deformation";
import { createFlagellumTree } from "./flagellum-tree";

interface Membrane {
    anchors: Vector2[];
    directions: Vector2[];
    deformations: Deformation[];
    getSector(p: Vector2): Vector2;
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
    let sign = 1;
    for (let i = 0; i < segments; i++) {
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
        deformations: deformations,
        getSector(p: Vector2): Vector2 {
            for (let i = 0; i < skeleton.length; i++) {
                const a = skeleton[i];
                const b = skeleton[(i + 1) % skeleton.length];
                if (inSector(p, a, b)) {
                    return anchors[i];
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
        const direction1 = membrane.directions[i];
        const direction2 = new Vector2().copy(membrane.directions[(i + 1) % n]).negate();
        const c1 = calculateDeformation(membrane.anchors[i], direction1, membrane.deformations[i], time);
        const c2 = calculateDeformation(membrane.anchors[(i + 1) % n], direction2, membrane.deformations[(i + 1) % n], time);
        controlPoints.push({ first: c1, second: c2 });
    }

    const path = new Path();
    path.moveTo(membrane.anchors[0].x, membrane.anchors[0].y);
    for (let i = 0; i < n; i++) {
        path.bezierCurveTo(controlPoints[i].first.x, controlPoints[i].first.y, controlPoints[i].second.x, controlPoints[i].second.y, membrane.anchors[(i + 1) % n].x, membrane.anchors[(i + 1) % n].y);
    }
    return getComponents(path.getPoints(detalization));
}

export function createAliveMembrane(membraneConfig: Unwrap<MembraneConfiguration>, flagellumConfig: Unwrap<FlagellumConfiguration>) {
    const material = new LineBasicMaterial({ color: membraneConfig.color });
    const membrane = generateAliveMembrane(membraneConfig);
    const positionAttribute = new BufferAttribute(calculateMembranePoints(membrane, membraneConfig.detalization, 0), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const curve = new Line(geometry, material);
    const angular = randomFrom(-membraneConfig.angularLimit, membraneConfig.angularLimit);
    const trees = [];
    let lastTime = 0;
    return {
        // maxR: r + dr,
        // minR: r - dr,
        object: curve,
        tick: (time: number) => {
            lastTime = time;
            for (let i = 0; i < trees.length; i++) {
                trees[i].tick(time);
            }
            const points = calculateMembranePoints(membrane, membraneConfig.detalization, time * membraneConfig.frequency);
            positionAttribute.set(points);
            positionAttribute.needsUpdate = true;
            // curve.rotateZ(angular);
        },
        attack: (targets: Vector2[]) => {
            for (let i = 0; i < membrane.anchors.length; i++) {
                const group = [];
                for (let s = 0; s < targets.length; s++) {
                    const anchor = membrane.getSector(targets[s]);
                    if (anchor === membrane.anchors[i]) {
                        group.push(targets[s]);
                    }
                }
                if (group.length === 0) {
                    continue;
                }
                const anchor = membrane.anchors[i];
                const direction = new Vector2().copy(anchor).normalize();
                const distance = group.map((p) => 3 * anchor.distanceTo(p) / 4).reduce((a, b) => Math.min(a, b), Infinity);
                const next = new Vector2().copy(anchor).addScaledVector(direction, distance);
                const flagellum = createFlagellumTree(
                    {
                        branchPoint: new Vector2().subVectors(next, anchor),
                        targets: group.map((p) => new Vector2().subVectors(p, anchor)),
                        start: lastTime,
                        finish: lastTime + 2000,
                    },
                    flagellumConfig
                );
                flagellum.object.position.set(anchor.x, anchor.y, 0);
                curve.add(flagellum.object);
                trees.push(flagellum);
            }
        },
    };
}
