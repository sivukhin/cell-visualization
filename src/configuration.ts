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
    skew: Store<number>;
    wobbling: Store<number>;
    color: Store<ColorRepresentation>;
}

export interface MembraneConfiguration {
    spline: Store<boolean>;
    segments: Store<number>;
    frequency: Store<number>;
    detalization: Store<number>;
    skew: Store<number>;
    thorness: Store<number>;
    wobbling: Store<number>;
}

export interface OrganellConfiguration {
    membrane: MembraneConfiguration;
    transitionDuration: Store<number>;
    colors: {
        color0: Store<ColorRepresentation>;
        color1: Store<ColorRepresentation>;
        color2: Store<ColorRepresentation>;
        color3: Store<ColorRepresentation>;
        color4: Store<ColorRepresentation>;
    };
}

export interface CellConfiguration {
    color: Store<ColorRepresentation>;
    glowing: Store<number>;
    radius: Store<number>;
    membrane: MembraneConfiguration;
    organell: OrganellConfiguration;
}

export interface SoupConfiguration {
    count: Store<number>;
    width: number;
    height: number;
}

export interface TargetConfiguration {
    appearDuration: Store<number>;
    selectDuration: Store<number>;
    attackerColor: Store<ColorRepresentation>;
    defenderColor: Store<ColorRepresentation>;
}

export interface WorldConfiguration {
    light: LightConfiguration;
    soup: SoupConfiguration;
    cell: CellConfiguration;
    flagellum: FlagellumConfiguration;
    target: TargetConfiguration;
    roundDuration: Store<number>;
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
