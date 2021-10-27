import { Store } from "nanostores";
import { ColorRepresentation } from "three";

export interface LightConfiguration {
    color: Store<ColorRepresentation>;
    intensity: Store<number>;
}

export interface MembraneConfiguration {
    segments: Store<number>;
    color: Store<ColorRepresentation>;
}

export interface OrganellsConfiguration {
    count: Store<number>;
    colors: [Store<ColorRepresentation>];
}

export interface CellConfiguration {
    membrane: MembraneConfiguration;
    organells: OrganellsConfiguration;
    radiusLimit: Store<number>;
}

export interface SoupConfiguration {
    count: Store<number>;
    width: number;
    height: number;
}

export interface WorldConfiguration {
    light: LightConfiguration;
    soup: SoupConfiguration;
    cell: CellConfiguration;
}
