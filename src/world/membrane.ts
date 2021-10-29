import { getRegularPolygon, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Object3D, Path, Vector2 } from "three";
import { interpolate, randomFrom } from "../utils/math";
import { MembraneConfiguration, Unwrap } from "../configuration";

interface MembraneDeformation {
    angle: number;
    length: number;
}

interface Membrane {
    anchors: Vector2[];
    directions: Vector2[];
    deformations: MembraneDeformation[];
}

function generateAliveMembrane({ segments, radius, delta, detalization }: Unwrap<MembraneConfiguration>): Membrane {
    const skeleton = getRegularPolygon(segments, radius / Math.cos(Math.PI / segments));
    const directions: Vector2[] = [];
    const anchors: Vector2[] = [];
    for (let i = 0; i < segments; i++) {
        const direction = new Vector2().subVectors(skeleton[(i + 1) % segments], skeleton[i]);
        directions.push(direction);
        anchors.push(new Vector2().copy(skeleton[i]).addScaledVector(direction, 0.5));
    }

    const deformations: MembraneDeformation[] = [];
    let sign = 1;
    for (let i = 0; i < segments; i++) {
        const angle = ((1 + Math.random()) * Math.PI) / 6;
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
    return { anchors: anchors, directions: directions, deformations: deformations };
}

function calculateControlPoint(anchor: Vector2, direction: Vector2, deformation: MembraneDeformation, time: number) {
    const angle = interpolate(-deformation.angle, deformation.angle, time, 0.01 * Math.pow(deformation.length, 1 / 2));
    return new Vector2().copy(direction).rotateAround(zero2, -angle).setLength(deformation.length).add(anchor);
}

function calculateMembranePoints(membrane: Membrane, detalization: number, time: number) {
    const n = membrane.anchors.length;
    const controlPoints = [];
    for (let i = 0; i < n; i++) {
        const direction1 = membrane.directions[i];
        const direction2 = new Vector2().copy(membrane.directions[(i + 1) % n]).negate();
        const c1 = calculateControlPoint(membrane.anchors[i], direction1, membrane.deformations[i], time);
        const c2 = calculateControlPoint(membrane.anchors[(i + 1) % n], direction2, membrane.deformations[(i + 1) % n], time);
        controlPoints.push({ first: c1, second: c2 });
    }

    const path = new Path();
    path.moveTo(membrane.anchors[0].x, membrane.anchors[0].y);
    for (let i = 0; i < n; i++) {
        path.bezierCurveTo(controlPoints[i].first.x, controlPoints[i].first.y, controlPoints[i].second.x, controlPoints[i].second.y, membrane.anchors[(i + 1) % n].x, membrane.anchors[(i + 1) % n].y);
    }
    const points = path.getPoints(detalization);
    const components = new Float32Array(points.length * 3);
    let position = 0;
    for (let point of points) {
        components[position++] = point.x;
        components[position++] = point.y;
        components[position++] = 0;
    }
    return components;
}

export function createAliveMembrane(configuration: Unwrap<MembraneConfiguration>) {
    const root = new Object3D();
    const material = new LineBasicMaterial({ color: configuration.color });
    const membrane = generateAliveMembrane(configuration);
    const positionAttribute = new BufferAttribute(calculateMembranePoints(membrane, configuration.detalization, 0), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", positionAttribute);
    const curve = new Line(geometry, material);
    root.add(curve);
    const angular = randomFrom(-0.1, 0.1);
    return {
        // maxR: r + dr,
        // minR: r - dr,
        object: root,
        tick: (time: number) => {
            const points = calculateMembranePoints(membrane, configuration.detalization, time * configuration.frequency);
            positionAttribute.set(points);
            positionAttribute.needsUpdate = true;
            // root.rotateZ(angular);
        },
        attack: (position: Vector2) => {},
    };
}
