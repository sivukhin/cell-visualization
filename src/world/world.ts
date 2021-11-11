import { Unwrap, WorldConfiguration } from "../configuration";
import { Color, Object3D, Vector2, Vector3 } from "three";
import { getRegularPolygon } from "../utils/geometry";
import { CellElement, createAliveCell } from "./cell";
import { Element } from "./types";

type CellId = number;

interface OrganellId {
    cell: CellId;
    organell: number;
}

export interface WorldElement extends Element {
    spawn(id: OrganellId, radius: number);
    kill(id: OrganellId);
    attack(from: CellId, to: OrganellId);
}

export function createWorld(worldConfig: Unwrap<WorldConfiguration>): WorldElement {
    const root = new Object3D();
    const positions = getRegularPolygon(worldConfig.soup.count, 300);
    const cells: CellElement[] = [];
    for (let i = 0; i < positions.length; i++) {
        const cell = createAliveCell(worldConfig.cell, worldConfig.flagellum);
        cell.object.position.set(positions[i].x, positions[i].y, 0);
        root.add(cell.object);
        cells.push(cell);
    }
    let previousRound = 0;
    let attacks: Array<{ from: CellId; to: OrganellId }> = [];
    return {
        object: root,
        tick: (time: number) => {
            for (let i = 0; i < cells.length; i++) {
                cells[i].tick(time);
            }
            if (time - previousRound > worldConfig.roundDuration) {
                const groups = new Map<CellId, OrganellId[]>();
                for (let i = 0; i < attacks.length; i++) {
                    const { from, to } = attacks[i];
                    if (!groups.has(from)) {
                        groups.set(from, []);
                    }
                    if (!groups.get(from).includes(to)) {
                        groups.get(from).push(to);
                    }
                }
                const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
                for (let i = 0; i < ordered.length; i++) {
                    const source = cells[ordered[i][0]];
                    const targets = ordered[i][1].map((id) => {
                        const relative3d = cells[id.cell].get(id.organell).object.position;
                        const absolute3d = new Vector3().addVectors(relative3d, cells[id.cell].object.position).sub(cells[ordered[i][0]].object.position);
                        return new Vector2(absolute3d.x, absolute3d.y);
                    });
                    const timings = source.attack(targets, worldConfig.roundDuration / 3);
                    for (let s = 0; s < ordered[i][1].length; s++) {
                        cells[ordered[i][1][s].cell].glow(ordered[i][1][s].organell, timings[s].finishIn, timings[s].finishOut);
                    }
                }
                previousRound = time;
                attacks = [];
            }
        },
        spawn: (id: OrganellId, radius: number) => {
            cells[id.cell].spawn(id.organell, radius);
        },
        kill: (id: OrganellId) => {
            cells[id.cell].kill(id.organell);
        },
        attack: (from: CellId, to: OrganellId) => {
            attacks.push({ from, to });
        },
    };
}
