import { Camera, Color, Object3D, Scene, Vector2, Vector3 } from "three";
import { AliveMembrane } from "./alive-membrane";
import { Organell } from "./organell";
import { Timings } from "../utils/timings";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";

export type Multiverse =
    | Object3D
    | {
          [key: string]: Multiverse;
      };

export type Multiworld = Scene | { [key: string]: Multiworld };

export type Multiworldish<T> = T extends Object3D
    ? Scene
    : {
          [key in keyof T]: Multiworldish<T[key]>;
      };

export function createMultiworld<T extends Multiverse>(multiverse: T, camera: Camera): Multiworldish<T> {
    const multiworld: any = {};
    for (const [key, value] of Object.entries(multiverse)) {
        if (value.isObject3D != null && value.isObject3D) {
            const scene = new Scene();
            scene.add(value);
            scene.add(camera);
            multiworld[key] = scene;
        } else {
            multiworld[key] = createMultiworld(value, camera);
        }
    }
    return multiworld;
}

export interface FlagellumElement {
    multiverse: Object3D;
    tick(time: number): boolean;
}

export interface OrganellElement {
    multiverse: Object3D;
    tick(time: number): boolean;
    update(nextOrganell: Organell | null, nextMembrane: AliveMembrane | null): void;
    glow(start: number, finish: number): void;
}

export interface CellElement {
    multiverse: {
        organell: Object3D;
        membrane: Object3D;
    };
    tick(time: number): boolean;
    spawn(id: number, weight: number): void;
    irritate(id: number, start: number, finish: number): void;
    attack(targets: Vector2[], duration: number): Timings[];
    get(id: number): Vector2;
}

export interface TargetElement {
    multiverse: Object3D;
    tick(time: number): boolean;
}

export interface OrganellId {
    cell: number;
    organell: number;
}

export interface WorldElement {
    multiverse: {
        top: {
            organell: Object3D;
            membrane: Object3D;
        };
        middle: {
            organell: Object3D;
            membrane: Object3D;
        };
        bottom: {
            organell: Object3D;
            membrane: Object3D;
        };
        microscope: Object3D;
    };
    tick(time: number): boolean;
    spawn(id: OrganellId, radius: number);
    attack(from: number, to: OrganellId);
    select(id: number, color: Color);
}

export interface Microcosmos {
    composers: EffectComposer[];
    tick(time: number): void;
    magnification(): number;
    zoom(magnification: number): void;
    move(dx: number, dy: number): void;
}
