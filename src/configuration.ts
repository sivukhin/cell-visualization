import { computed, Store } from "nanostores";
import { ColorRepresentation, Vector2 } from "three";
import { hasOwnFunction } from "./utils/type";

export interface LightConfiguration {
    color: Store<ColorRepresentation>;
    intensity: Store<number>;
}

export interface FlagellumConfiguration {
    segmentLength: Store<number>;
    amplitude: Store<number>;
    skewLimit: Store<number>;
    minWobbling: Store<number>;
    color: Store<ColorRepresentation>;
}

export interface MembraneConfiguration {
    spline: Store<boolean>;
    segments: Store<number>;
    frequency: Store<number>;
    radius: Store<number>;
    delta: Store<number>;
    color: Store<ColorRepresentation>;
    detalization: Store<number>;
    skewLimit: Store<number>;
}

export interface CellConfiguration {
    membrane: MembraneConfiguration;
    organell: MembraneConfiguration;
    glowStart: Store<number>;
    organellsCount: Store<number>;
    radiusLimit: Store<number>;
}

export interface SoupConfiguration {
    rows: Store<number>;
    cols: Store<number>;
    xDistance: Store<number>;
    yDistance: Store<number>;
    count: Store<number>;
    width: number;
    height: number;
}

export interface WorldConfiguration {
    light: LightConfiguration;
    soup: SoupConfiguration;
    cell: CellConfiguration;
    flagellum: FlagellumConfiguration;
}

export type Unwrap<T> = {
    [P in keyof T]: T[P] extends Store<infer X> ? X : Unwrap<T[P]>;
};

function getState(configuration: any, world: any): any {
    for (const [key, value] of Object.entries(configuration)) {
        if (typeof value === "object" && hasOwnFunction(value, "get")) {
            world[key] = value.get();
        } else if (typeof value === "object") {
            world[key] = getState(value, {});
        } else {
            world[key] = value;
        }
    }
    return world;
}

function gatherStores(configuration: any): Store[] {
    const stores = [];
    for (const [, value] of Object.entries(configuration)) {
        if (typeof value === "object" && hasOwnFunction(value, "get")) {
            stores.push(value);
        } else if (typeof value === "object") {
            stores.push(...gatherStores(value));
        }
    }
    return stores;
}

export function createConfigurationStore(configuration: WorldConfiguration): Store<Unwrap<WorldConfiguration>> {
    const stores = gatherStores(configuration);
    return computed(stores, () => {
        return getState(configuration, {});
    });
}
