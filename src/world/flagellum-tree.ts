import { FlagellumConfiguration, Unwrap } from "../configuration";
import { Object3D, Vector2 } from "three";
import { createFlagellum } from "./flagellum";

export interface FlagellumTreeState {
    startDirection: Vector2;
    branchPoint: Vector2;
    targets: Vector2[];
    start: number;
    finish: number;
}

export function createFlagellumTree({ startDirection, branchPoint, targets, start, finish }: FlagellumTreeState, configuration: Unwrap<FlagellumConfiguration>) {
    const root = new Object3D();
    const total = finish - start;
    const ratios = [1, 1, 10, 4, 4];
    const sum = ratios.reduce((a, b) => a + b, 0);
    const startD = (ratios[0] / sum) * total;
    const branchD = (ratios[1] / sum) * total;
    const waitD = (ratios[2] / sum) * total;
    const unbranchD = (ratios[3] / sum) * total;
    const endD = (ratios[4] / sum) * total;
    const trunk = createFlagellum(
        {
            startDirection: startDirection,
            finishDirection: new Vector2().copy(branchPoint).negate(),
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
        finish: finish,
        tick: (time: number) => {
            trunk.tick(time);
            for (let i = 0; i < branches.length; i++) {
                branches[i].tick(time);
            }
            if (time > start + startD && branches.length !== targets.length) {
                for (let i = 0; i < targets.length; i++) {
                    let branch = createFlagellum(
                        {
                            startDirection: branchPoint,
                            finishDirection: new Vector2().subVectors(branchPoint, targets[i]),
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
