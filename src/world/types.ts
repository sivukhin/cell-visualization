import { Camera, Color, ColorRepresentation, Object3D, Scene, Vector2, Vector3 } from "three";
import { Timings } from "../utils/timings";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { Details } from "../microscope/details";

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

export interface CellElement {
    multiverse: Object3D;
    tick(time: number): boolean;
    spawn(id: number, weight: number, active: boolean, color: ColorRepresentation): void;
    update(size: number, organells: OrganellInfo[]): void;
    irritate(id: number, start: number, finish: number): void;
    attack(targets: Array<() => Vector2>, start: number, finish: number): Timings;
    get(id: number): { center: Vector2; weight: number };
    getAll(): Array<{ id: number; center: Vector2; weight: number; active: boolean; color: Color }>;
}

export interface DetailsElement {
    tick(time: number): boolean;
}

export interface TargetElement {
    multiverse: SVGElement;
    position(): Vector2;
    tick(time: number): boolean;
}

export interface Stats {
    round: number;
    attacks: number;
    bleeding: number;
    stolen: number;
    alive: number;
    stat: boolean;
    action: boolean;
}

export interface MicroscopeElement {
    tick(time: number): void;
    rollXY(x: number, y: number);
    setServices(services: Array<{ name: string; color: ColorRepresentation }>);
    setStats(stats: Stats);
    setMode(mode: "live" | "attention");
    addAlarm(service: number, time: number);
    addTarget(follow: () => Vector2, size: () => number, color: string, bottom: string, top: string, start: number, hideTarget?: boolean);
    addDetails(details: Details);
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
    multiverse: Object3D;
    getOrganells(cell: number, organells: number[]): Vector2[];
    getOrganell(cell: number, organell: number): Vector2;
    getCell(cell: number): { center: Vector2; radius: number };
    tick(time: number): boolean;
    update(cellStates: CellInfo[]);
    attack(from: number, targets: Array<{ cell: number; organell: number }>, start: number, finish: number);
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
