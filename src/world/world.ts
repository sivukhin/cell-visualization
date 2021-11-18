import { Unwrap, WorldConfiguration } from "../configuration";
import { Color, Object3D, Vector2, Vector3 } from "three";
import { getComponents, zero2 } from "../utils/geometry";
import { createAliveCell } from "./cell";
import { CellElement, CellInfo, DetailsElement, OrganellId, OrganellInfo, TargetElement, WorldElement } from "./types";
import { createTarget } from "../microscope/target";
import { to2, to3 } from "../utils/draw";
import { interpolateMany, randomChoice, randomChoiceNonRepeat, randomFrom } from "../utils/math";
import { lastTick, tickAll } from "../utils/tick";
import { createDetails } from "../microscope/details";

interface CellState {
    velocity: Vector2;
    angular: number;
    radius: number;
    caption: string;
}

function occupy(occupied: number[], row: number, col: number, rows: number, cols: number) {
    occupied[row * cols + col]++;
    occupied[Math.min(rows - 1, row + 1) * cols + col]++;
    occupied[Math.max(0, row + 1) * cols + col]++;
    occupied[row * cols + Math.min(cols - 1, col + 1)]++;
    occupied[row * cols + Math.max(0, col - 1)]++;
}

export function createWorld(worldConfig: Unwrap<WorldConfiguration>): WorldElement {
    const multiverse = {
        top: { organell: new Object3D(), membrane: new Object3D() },
        middle: { organell: new Object3D(), membrane: new Object3D() },
        bottom: { organell: new Object3D(), membrane: new Object3D() },
        microscope: new Object3D(),
    };

    const cells = new Map<number, { element: CellElement; state: CellState }>();
    const organells = new Map<number, string>();
    let targets = new Map<number, TargetElement>();
    let details: DetailsElement[] = [];

    const vPadding = 150;
    const hPadding = 50;
    return {
        multiverse: multiverse,
        resetAccent: (id: number) => {
            const target = targets.get(id);
            if (target == null) {
                return;
            }
            multiverse.microscope.remove(target.multiverse);
            target.cleanup();
            targets.delete(id);
        },
        setAccent: (id: number, caption: string) => {
            if (targets.has(id)) {
                return;
            }
            const size = (cells.get(id).state.radius / Math.cos(Math.PI / worldConfig.cell.segments)) * (1 + worldConfig.cell.membrane.wobbling) * 2;
            const target = createTarget({
                follow: () => to2(cells.get(id).element.multiverse.membrane.position),
                size: size,
                appearDuration: worldConfig.target.appearDuration,
                typingDuration: worldConfig.target.typingDuration,
                start: lastTick(),
                select: true,
                highlight: false,
                caption: caption,
                width: worldConfig.soup.width,
                height: worldConfig.soup.height,
            });
            targets.set(id, target);
            multiverse.microscope.add(target.multiverse);
        },
        getTarget(cellId: number, organell: number): Vector2 {
            const cell = cells.get(cellId);
            return new Vector2().addVectors(cell.element.get(organell).center, to2(cell.element.multiverse.membrane.position));
        },
        inspect: (id: number, start: number, finish: number) => {
            const cell = cells.get(id);
            if (cell == null) {
                return;
            }
            const current = cell.element.getAll();

            details.push(
                createDetails({
                    center: () => to2(cell.element.multiverse.membrane.position),
                    sideX: 110,
                    follow: () => current.map((c) => new Vector2().addVectors(cell.element.get(c.id).center, to2(cell.element.multiverse.membrane.position))),
                    captions: current.map((c) => ({ title: organells.get(c.id), value: c.weight, color: c.active ? "#" + c.color.getHexString() : null })),
                    start: start,
                    finish: finish,
                })
            );
        },
        register: (id: number, name: string) => {
            organells.set(id, name);
        },
        tick: (time: number) => {
            details = tickAll(details, time, (t) => {});
            for (const target of targets.values()) {
                target.tick(time);
            }
            for (const item of cells.values()) {
                item.element.tick(time);
                item.element.multiverse.organell.position.x += item.state.velocity.x;
                item.element.multiverse.organell.position.y += item.state.velocity.y;
                item.element.multiverse.membrane.position.x += item.state.velocity.x;
                item.element.multiverse.membrane.position.y += item.state.velocity.y;
                item.element.multiverse.organell.rotateZ(item.state.angular);
            }
            for (const { element: aElement, state: aState } of cells.values()) {
                if (aElement.multiverse.membrane.position.x < -worldConfig.soup.width / 2 + vPadding + 2 * aState.radius) {
                    aState.velocity.x += worldConfig.speed / 10;
                }
                if (aElement.multiverse.membrane.position.y < -worldConfig.soup.height / 2 + hPadding + 2 * aState.radius) {
                    aState.velocity.y += worldConfig.speed / 10;
                }
                if (aElement.multiverse.membrane.position.x > worldConfig.soup.width / 2 - vPadding - 2 * aState.radius) {
                    aState.velocity.x -= worldConfig.speed / 10;
                }
                if (aElement.multiverse.membrane.position.y > worldConfig.soup.height / 2 - hPadding - 2 * aState.radius) {
                    aState.velocity.y -= worldConfig.speed / 10;
                }
                for (const { element: bElement, state: bState } of cells.values()) {
                    const aPosition = to2(aElement.multiverse.membrane.position);
                    const bPosition = to2(bElement.multiverse.membrane.position);
                    if (aElement == bElement || aPosition.distanceTo(bPosition) + 10 > aState.radius + bState.radius) {
                        continue;
                    }
                    const direction = new Vector2().subVectors(bPosition, aPosition).normalize();
                    const [v, u] = getComponents(aState.velocity, direction);
                    aState.velocity = new Vector2().addVectors(v.addScaledVector(direction, -worldConfig.speed / 10), u);
                }
                if (aState.velocity.length() > worldConfig.speed) {
                    aState.velocity.setLength(worldConfig.speed);
                }
            }
            return true;
        },
        update: (cellInfos: CellInfo[]) => {
            const sizes = interpolateMany(
                cellInfos.map((s) => s.size),
                worldConfig.cell.radius / 2,
                worldConfig.cell.radius
            );
            const count = new Set([...cells.keys(), ...cellInfos.map((x) => x.id)]).size;
            let rows = Math.ceil(Math.sqrt(count / (worldConfig.soup.width / worldConfig.soup.height)));
            let cols = Math.ceil(count / rows);
            const row = (worldConfig.soup.height - 2 * hPadding) / rows;
            const col = (worldConfig.soup.width - 2 * vPadding) / cols;
            const occupied = new Array(rows * cols).fill(0);
            for (const cell of cells.values()) {
                const x = cell.element.multiverse.membrane.position.x;
                const y = cell.element.multiverse.membrane.position.y;
                const r = Math.min(rows - 1, Math.floor((y + worldConfig.soup.height / 2 - hPadding) / row));
                const c = Math.min(cols - 1, Math.floor((x + worldConfig.soup.width / 2 - vPadding) / col));
                occupy(occupied, r, c, rows, cols);
            }
            for (let i = 0; i < cellInfos.length; i++) {
                const cellInfo = cellInfos[i];
                if (cells.has(cellInfo.id)) {
                    const cell = cells.get(cellInfo.id);
                    cells.get(cellInfo.id).state.caption = cellInfo.caption;
                    cell.element.update(sizes[i], cellInfo.organells);
                } else {
                    const cell = createAliveCell(worldConfig.cell, worldConfig.flagellum);
                    const velocity = new Vector2(worldConfig.speed, 0);
                    let slot = Math.min(occupied.length - 1, Math.floor(randomFrom(0, occupied.length)));
                    let iteration = 0;
                    while (true) {
                        iteration++;
                        if (occupied[slot] < iteration / occupied.length) {
                            break;
                        }
                        slot = (slot + 1) % occupied.length;
                    }
                    occupy(occupied, Math.floor(slot / cols), slot % cols, rows, cols);
                    const position = new Vector2(
                        col * (slot % cols) - worldConfig.soup.width / 2 + vPadding + randomFrom(col / 3, (2 * col) / 3),
                        row * Math.floor(slot / cols) - worldConfig.soup.height / 2 + hPadding + randomFrom(row / 3, (2 * row) / 3)
                    );
                    position.x = Math.min(worldConfig.soup.width - sizes[i] - vPadding, Math.max(-worldConfig.soup.width + sizes[i] + vPadding, position.x));
                    position.y = Math.min(worldConfig.soup.height - sizes[i] - hPadding, Math.max(-worldConfig.soup.height + sizes[i] + hPadding, position.y));
                    cell.multiverse.membrane.position.set(position.x, position.y, 0);
                    cell.multiverse.organell.position.set(position.x, position.y, 0);
                    cell.update(sizes[i], cellInfo.organells);
                    multiverse.top.membrane.add(cell.multiverse.membrane);
                    multiverse.top.organell.add(cell.multiverse.organell);
                    cells.set(cellInfo.id, {
                        element: cell,
                        state: {
                            caption: cellInfo.caption,
                            velocity: velocity,
                            radius: sizes[i],
                            angular: randomFrom(0, 0),
                        },
                    });
                }
            }
        },
        attack: (from: number, targets: Array<{ cell: number; organell: number }>, start: number, finish: number) => {
            console.info("ATTACK", from, targets, cells);
            const source = cells.get(from).element;
            if (source == null) {
                return;
            }
            const points = [];
            for (let i = 0; i < targets.length; i++) {
                const cell = cells.get(targets[i].cell);
                const absolute = new Vector2().addVectors(cell.element.get(targets[i].organell).center, to2(cell.element.multiverse.membrane.position));
                const relative = new Vector2().subVectors(absolute, to2(source.multiverse.membrane.position));
                points.push(relative);
            }
            const timing = source.attack(points, start, finish);
            for (let i = 0; i < targets.length; i++) {
                const cell = cells.get(targets[i].cell);
                cell.element.irritate(targets[i].organell, timing.finishIn, timing.finishOut);
            }
        },
    };
}
