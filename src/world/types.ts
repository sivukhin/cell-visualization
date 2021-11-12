import { Object3D } from "three";

export interface Element {
    object: Object3D;
    microscope?: Object3D;
    alive?(): boolean;
    tick(time: number): void;
}
