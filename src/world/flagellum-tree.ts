import { FlagellumConfiguration, Unwrap } from "../configuration";
import { Object3D, Vector2 } from "three";
import { createFlagellum } from "./flagellum";

export interface FlagellumTreeState {
    branchPoint: Vector2;
    targets: Vector2[];
    start: number;
    finish: number;
}

export function createFlagellumTree({ branchPoint, targets, start, finish }: FlagellumTreeState, configuration: Unwrap<FlagellumConfiguration>) {
    const root = new Object3D();
    const total = finish - start;
    const startD = total / 4;
    const branchD = total / 5;
    const waitD = total / 20;
    const unbranchD = total / 8;
    const endD = (3 * total) / 8;
    const trunk = createFlagellum(
        {
            target: branchPoint,
            startIn: start,
            finishIn: start + startD,
            startOut: finish - endD,
            finishOut: finish,
        },
        configuration
    );
    root.add(trunk.object);
    const branches = [];
    return {
        object: root,
        tick: (time: number) => {
            trunk.tick(time);
            for (let i = 0; i < branches.length; i++) {
                branches[i].tick(time);
            }
            if (time > start + startD && branches.length !== targets.length) {
                for (let i = 0; i < targets.length; i++) {
                    let branch = createFlagellum(
                        {
                            target: new Vector2().subVectors(targets[i], branchPoint),
                            startIn: start + startD,
                            finishIn: start + startD + branchD,
                            startOut: start + startD + branchD + waitD,
                            finishOut: start + startD + branchD + waitD + unbranchD,
                        },
                        configuration
                    );
                    branch.object.position.set(branchPoint.x, branchPoint.y, 0);
                    root.add(branch.object);
                    branches.push(branch);
                }
            }
            if (time > finish - endD && branches.length > 0) {
                for (let i = 0; i < branches.length; i++) {
                    root.remove(branches[i].object);
                }
            }
        },
    };
}
