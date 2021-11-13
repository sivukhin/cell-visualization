import { getRegularPolygon, inSector, scalePoints, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Path, Vector2 } from "three";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { getFlatComponents3D } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation } from "./deformation";
import { interpolateLinear1D, interpolateLinear2D, randomFrom } from "../utils/math";
import { lastTick } from "../utils/tick";

export interface Membrane {
    points: Vector2[];
}

function calculateMembranePoints(membrane: Membrane, config: Unwrap<MembraneConfiguration>, time: number) {
    const path = new Path();
    const anchors = [];
    const directions = [];
    for (let i = 0; i < membrane.points.length; i++) {
        const a = membrane.points[i];
        const b = membrane.points[(i + 1) % membrane.points.length];
        anchors.push(new Vector2().addVectors(a, b).multiplyScalar(0.5));
        directions.push(new Vector2().subVectors(b, a).multiplyScalar(0.5));
    }
    path.moveTo(anchors[0].x, anchors[0].y);
    for (let i = 0; i < anchors.length; i++) {
        const c = new Vector2().addVectors(anchors[i], directions[i]);
        const end = anchors[(i + 1) % anchors.length];
        path.bezierCurveTo(c.x, c.y, c.x, c.y, end.x, end.y);
    }
    return { points: membrane.points }; //path.getPoints(config.detalization) };
}

export function createMembrane(membrane: Membrane, config: Unwrap<MembraneConfiguration>) {
    const { points } = calculateMembranePoints(membrane, config, 0);
    const geometry = new BufferGeometry();
    let positionAttribute = new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("position", positionAttribute);

    const index = [];
    for (let i = 0; i < points.length; i++) {
        index.push(0, i + 1, ((i + 1) % points.length) + 1);
    }
    geometry.setIndex(index);

    return {
        geometry: geometry,
        tick: (time: number) => {},
        update: (update: Membrane) => {
            membrane = update;
            const { points } = calculateMembranePoints(membrane, config, lastTick());
            positionAttribute = new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3);
            positionAttribute.setUsage(DynamicDrawUsage);
            geometry.setAttribute("position", positionAttribute);
            const index = [];
            for (let i = 0; i < points.length; i++) {
                index.push(0, i + 1, ((i + 1) % points.length) + 1);
            }
            geometry.setIndex(index);
            positionAttribute.needsUpdate = true;
        },
    };
}
