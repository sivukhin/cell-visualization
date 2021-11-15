import { getRegularPolygon, inSector, scalePoints, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Path, Vector2 } from "three";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { getFlatComponents3D } from "../utils/draw";
import { calculateDeformation, calculateDeformationAngle, Deformation, findDeformationAngleTime } from "./deformation";
import { interpolateLinear1D, interpolateLinear2D, randomFrom } from "../utils/math";
import { lastTick } from "../utils/tick";
import { Geometry } from "three/examples/jsm/deprecated/Geometry";

export interface Membrane {
    points: Vector2[];
}

interface MembraneGeometry {
    geometry: BufferGeometry;
    tick(time: number): void;
    update(update: Membrane): void;
}

export function createMembrane(membrane: Membrane) {
    /*
    const geometry = new BufferGeometry();
    let positionAttribute = null;
    let thicknessAttribute = null;
    const update = (data: Membrane) => {
        positionAttribute = new BufferAttribute(getFlatComponents3D([zero2, ...points]), 3);
        positionAttribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("position", positionAttribute);

        const index = [];
        for (let i = 0; i < points.length; i++) {
            index.push(0, i + 1, ((i + 1) % points.length) + 1);
        }
        geometry.setIndex(index);
    };

    update(membrane);

    return {
        geometry: geometry,
        tick: (time: number) => {
            const { points, thickness } = calculateMembranePoints(skeleton, config, t);
            thicknessAttribute.set(new Float32Array([1, ...thickness]));
            thicknessAttribute.needsUpdate = true;
            positionAttribute.set(getFlatComponents3D([zero2, ...points]));
            positionAttribute.needsUpdate = true;
        },
        update: (data: AliveMembrane) => {
            update((membrane = data));
        },
    };
     */
}
