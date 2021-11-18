import { Camera, Color, ColorRepresentation, Object3D, Scene, Vector2, Vector3 } from "three";
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
    update(nextOrganell: Organell | null): void;
    glow(start: number, finish: number): void;
}

export interface CellElement {
    multiverse: {
        organell: Object3D;
        membrane: Object3D;
    };
    tick(time: number): boolean;
    spawn(id: number, weight: number, active: boolean, color: ColorRepresentation): void;
    update(size: number, organells: OrganellInfo[]): void;
    irritate(id: number, start: number, finish: number): void;
    attack(targets: Vector2[], start: number, finish: number): Timings;
    get(id: number): { center: Vector2; weight: number };
    getAll(): Array<{ id: number; center: Vector2; weight: number; active: boolean; color: Color }>;
}

export interface DetailsElement {
    tick(time: number): boolean;
}

export interface TargetElement {
    multiverse: Object3D;
    cleanup(): void;
    tick(time: number): boolean;
}

export interface OrganellId {
    cell: number;
    organell: number;
}

export interface OrganellInfo {
    id: number;
    size: number;
    color: ColorRepresentation;
    active: boolean;
}

export interface CellInfo {
    id: number;
    size: number;
    caption: string;
    organells: OrganellInfo[];
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
    getTarget(cell: number, organell: number): Vector2;
    tick(time: number): boolean;
    register(id: number, name: string): void;
    update(cellStates: CellInfo[]);
    inspect(id: number, start: number, finish: number): void;
    attack(from: number, targets: Array<{ cell: number; organell: number }>, start: number, finish: number);
    setAccent(id: number, caption: string);
    resetAccent(id: number);
}

export interface GodElement {
    tick(time: number): void;
}

export interface Microcosmos {
    composers: EffectComposer[];
    tick(time: number): void;
    magnification(): number;
    zoom(magnification: number): void;
    move(dx: number, dy: number): void;
}
