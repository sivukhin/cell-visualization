import { Object3D } from "three";

export interface Element {
    object: Object3D;
    tick(time: number): void;
}
