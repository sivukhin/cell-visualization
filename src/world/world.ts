import { Unwrap, WorldConfiguration } from "../configuration";
import { Color, Object3D, Vector2, Vector3 } from "three";
import { getComponents, getRegularPolygon, zero2 } from "../utils/geometry";
import { CellElement, createAliveCell } from "./cell";
import { Element } from "./types";
import { createTarget } from "../microscope/target";
import { to2 } from "../utils/draw";
import { randomFrom } from "../utils/math";

type CellId = number;

interface OrganellId {
    cell: CellId;
    organell: number;
}

export interface WorldElement extends Element {
    spawn(id: OrganellId, radius: number);
    kill(id: OrganellId);
    attack(from: CellId, to: OrganellId);
    select(id: CellId, color: Color);
}

export function createWorld(worldConfig: Unwrap<WorldConfiguration>): WorldElement {
    const root = new Object3D();
    const microscopeRoot = new Object3D();
    const velocities: Vector2[] = [];

    const positions = [];
    const rows = Math.ceil(Math.sqrt(worldConfig.soup.count));
    const cols = Math.ceil(worldConfig.soup.count / rows);
    const dy = worldConfig.soup.height / rows;
    const dx = worldConfig.soup.width / cols;
    for (let i = 0; i < rows && positions.length < worldConfig.soup.count; i++) {
        for (let s = 0; s < cols && positions.length < worldConfig.soup.count; s++) {
            positions.push(new Vector2(dx * s + dx / 2 + randomFrom(-dx / 4, dx / 4) - worldConfig.soup.width / 2, dy * i + dy / 2 + randomFrom(-dy / 4, dy / 4) - worldConfig.soup.height / 2));
            velocities.push(new Vector2(worldConfig.speed, 0).rotateAround(zero2, randomFrom(0, 2 * Math.PI)));
        }
    }
    const cells: CellElement[] = [];
    let targets: Element[] = [];
    for (let i = 0; i < positions.length; i++) {
        const cell = createAliveCell(worldConfig.cell, worldConfig.flagellum);
        cell.object.position.set(positions[i].x, positions[i].y, 0);
        root.add(cell.object);
        cells.push(cell);
    }
    let previousRound = 0;
    let attacks: Array<{ from: CellId; to: OrganellId }> = [];
    const select = (id: CellId, color: Color) => {
        const size = (worldConfig.cell.radius / Math.cos(Math.PI / worldConfig.cell.segments)) * 2;
        const target = createTarget({
            follow: () => to2(cells[id].object.position),
            size: size,
            appearDuration: worldConfig.target.appearDuration,
            selectDuration: worldConfig.target.selectDuration,
            color: color,
        });
        targets.push(target);
        microscopeRoot.add(target.object);
    };
    return {
        object: root,
        microscope: microscopeRoot,
        tick: (time: number) => {
            for (let i = 0; i < cells.length; i++) {
                cells[i].tick(time);
                cells[i].object.position.x += velocities[i].x;
                cells[i].object.position.y += velocities[i].y;
            }
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].object.position.x < -worldConfig.soup.width / 2 + 2 * worldConfig.cell.radius) {
                    velocities[i].x += worldConfig.speed / 10;
                }
                if (cells[i].object.position.y < -worldConfig.soup.height / 2 + 2 * worldConfig.cell.radius) {
                    velocities[i].y += worldConfig.speed / 10;
                }
                if (cells[i].object.position.x > worldConfig.soup.width / 2 - 2 * worldConfig.cell.radius) {
                    velocities[i].x -= worldConfig.speed / 10;
                }
                if (cells[i].object.position.y > worldConfig.soup.height / 2 - 2 * worldConfig.cell.radius) {
                    velocities[i].y -= worldConfig.speed / 10;
                }
                for (let s = 0; s < cells.length; s++) {
                    const aPosition = to2(cells[i].object.position);
                    const bPosition = to2(cells[s].object.position);
                    if (i == s || aPosition.distanceTo(bPosition) * 1.1 > 2 * worldConfig.cell.radius) {
                        continue;
                    }
                    const direction = new Vector2().subVectors(bPosition, aPosition).normalize();
                    const [v, u] = getComponents(velocities[i], direction);
                    velocities[i] = new Vector2().addVectors(v.addScaledVector(direction, -worldConfig.speed / 10), u);
                }
                if (velocities[i].length() > worldConfig.speed) {
                    velocities[i].setLength(worldConfig.speed);
                }
            }
            for (let i = 0; i < targets.length; i++) {
                if (!targets[i].alive()) {
                    microscopeRoot.remove(targets[i].object);
                }
            }
            targets = targets.filter((t) => t.alive());
            for (let i = 0; i < targets.length; i++) {
                targets[i].tick(time);
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
                    select(ordered[i][0], new Color(worldConfig.target.attackerColor));
                    const targets = ordered[i][1].map((id) => {
                        const relative3d = cells[id.cell].get(id.organell).object.position;
                        const absolute3d = new Vector3().addVectors(relative3d, cells[id.cell].object.position).sub(cells[ordered[i][0]].object.position);
                        return new Vector2(absolute3d.x, absolute3d.y);
                    });
                    const timings = source.attack(targets, worldConfig.roundDuration / 3);
                    for (let s = 0; s < ordered[i][1].length; s++) {
                        select(ordered[i][1][s].cell, new Color(worldConfig.target.defenderColor));
                        cells[ordered[i][1][s].cell].glow(ordered[i][1][s].organell, timings[s].finishIn, timings[s].finishOut);
                    }
                }
                previousRound = time;
                attacks = [];
            }
        },
        select: select,
        spawn: (id: OrganellId, radius: number) => {
            cells[id.cell].spawn(id.organell);
        },
        kill: (id: OrganellId) => {
            cells[id.cell].kill(id.organell);
        },
        attack: (from: CellId, to: OrganellId) => {
            attacks.push({ from, to });
        },
    };
}
