import { Unwrap, WorldConfiguration } from "../configuration";
import { Object3D, Vector2 } from "three";
import { getComponents } from "../utils/geometry";
import { createAliveCell } from "./cell";
import { CellElement, CellInfo, WorldElement } from "./types";
import { to2 } from "../utils/draw";
import { interpolateMany, randomFrom } from "../utils/math";

interface CellState {
    velocity: Vector2;
    angular: number;
    radius: number;
    caption: string;
}

function occupy<T>(occupied: T[][], p: T, row: number, col: number, rows: number, cols: number) {
    occupied[row * cols + col].push(p);
    occupied[Math.min(rows - 1, row + 1) * cols + col].push(p);
    occupied[Math.max(0, row - 1) * cols + col].push(p);
    occupied[row * cols + Math.min(cols - 1, col + 1)].push(p);
    occupied[row * cols + Math.max(0, col - 1)].push(p);
}

const urlSearchParams = new URLSearchParams(window.location.search);
if (urlSearchParams.has("clear")) {
    console.info("clear local storage");
    localStorage.clear();
}

const cellPositionsRaw = localStorage.getItem("cells-positions");
let initialPositions = new Map<number, Vector2>();
if (cellPositionsRaw != null) {
    initialPositions = new Map<number, Vector2>(JSON.parse(cellPositionsRaw).map((x) => [x[0], new Vector2(x[1], x[2])]));
    console.info("state was loaded: ", cellPositionsRaw, initialPositions);
}

export function createWorld(worldConfig: Unwrap<WorldConfiguration>): WorldElement {
    const multiverse = new Object3D();

    const cells = new Map<number, { element: CellElement; state: CellState }>();

    const vPadding = 150;
    const hPadding = 50;

    setInterval(() => {
        const currentPositions = [];
        for (const entry of cells.entries()) {
            const position = entry[1].element.multiverse.position;
            currentPositions.push([entry[0], position.x, position.y]);
        }
        localStorage.setItem("cells-positions", JSON.stringify(currentPositions));
        console.info("state was persisted: ", currentPositions);
    }, 1000);
    return {
        multiverse: multiverse,
        getOrganells(cellId: number, organells: number[]): Vector2[] {
            const cell = cells.get(cellId);
            return organells.map((x) => (x == -1 ? new Vector2(100000, 0) : new Vector2().addVectors(cell.element.get(x).center, to2(cell.element.multiverse.position))));
        },
        getOrganell(cellId: number, organell: number): Vector2 {
            if (organell == -1) {
                return new Vector2(100000, 0);
            }
            const cell = cells.get(cellId);
            return new Vector2().addVectors(cell.element.get(organell).center, to2(cell.element.multiverse.position));
        },
        getCell(cellId: number) {
            const cell = cells.get(cellId);
            return { center: to2(cell.element.multiverse.position), radius: cell.state.radius };
        },
        tick: (time: number) => {
            for (const item of cells.values()) {
                item.element.tick(time);
                item.element.multiverse.position.x += item.state.velocity.x;
                item.element.multiverse.position.y += item.state.velocity.y;
                item.element.multiverse.rotateZ(item.state.angular);
            }
            for (const { element: aElement, state: aState } of cells.values()) {
                if (aElement.multiverse.position.x < -worldConfig.soup.width / 2 + vPadding + 2 * aState.radius) {
                    aState.velocity.x += worldConfig.speed / 10;
                }
                if (aElement.multiverse.position.y < -worldConfig.soup.height / 2 + hPadding + 2 * aState.radius) {
                    aState.velocity.y += worldConfig.speed / 10;
                }
                if (aElement.multiverse.position.x > worldConfig.soup.width / 2 - vPadding - 2 * aState.radius) {
                    aState.velocity.x -= worldConfig.speed / 10;
                }
                if (aElement.multiverse.position.y > worldConfig.soup.height / 2 - hPadding - 2 * aState.radius) {
                    aState.velocity.y -= worldConfig.speed / 10;
                }
                for (const { element: bElement, state: bState } of cells.values()) {
                    const aPosition = to2(aElement.multiverse.position);
                    const bPosition = to2(bElement.multiverse.position);
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
            const occupied = new Array(rows * cols).fill(null).map((_) => []);
            for (const cell of cells.values()) {
                const x = cell.element.multiverse.position.x;
                const y = cell.element.multiverse.position.y;
                const r = Math.min(rows - 1, Math.floor((y + worldConfig.soup.height / 2 - hPadding) / row));
                const c = Math.min(cols - 1, Math.floor((x + worldConfig.soup.width / 2 - vPadding) / col));
                occupy(occupied, [new Vector2(x, y), cell.state.radius], r, c, rows, cols);
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
                    let position = null;
                    if (initialPositions.has(cellInfo.id)) {
                        position = initialPositions.get(cellInfo.id);
                    } else {
                        let slot = Math.min(occupied.length - 1, Math.floor(randomFrom(0, occupied.length)));
                        let iteration = 0;
                        while (true) {
                            const center = new Vector2(
                                col * (slot % cols) - worldConfig.soup.width / 2 + vPadding + col / 2,
                                row * Math.floor(slot / cols) - worldConfig.soup.height / 2 + hPadding + row / 2
                            );
                            let minDistance = Infinity;
                            for (const [p, size] of occupied[slot]) {
                                minDistance = Math.min(minDistance, center.distanceTo(p) - size - sizes[i]);
                            }
                            if (minDistance > -iteration) {
                                break;
                            }
                            iteration++;
                            slot = (slot + 1) % occupied.length;
                        }
                        position = new Vector2(
                            col * (slot % cols) - worldConfig.soup.width / 2 + vPadding + randomFrom(col / 3, (2 * col) / 3),
                            row * Math.floor(slot / cols) - worldConfig.soup.height / 2 + hPadding + randomFrom(row / 3, (2 * row) / 3)
                        );
                    }

                    const currentRow = Math.min(rows - 1, Math.floor((position.y + worldConfig.soup.height / 2 - hPadding) / row));
                    const currentCol = Math.min(cols - 1, Math.floor((position.x + worldConfig.soup.width / 2 - vPadding) / col));
                    occupy(occupied, [position, sizes[i]], currentRow, currentCol, rows, cols);

                    position.x = Math.min(worldConfig.soup.width - sizes[i] - vPadding, Math.max(-worldConfig.soup.width + sizes[i] + vPadding, position.x));
                    position.y = Math.min(worldConfig.soup.height - sizes[i] - hPadding, Math.max(-worldConfig.soup.height + sizes[i] + hPadding, position.y));
                    cell.multiverse.position.set(position.x, position.y, 0);
                    cell.update(sizes[i], cellInfo.organells);
                    multiverse.add(cell.multiverse);
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
            const source = cells.get(from);
            if (source.element == null) {
                return;
            }
            const points = [];
            for (let i = 0; i < targets.length; i++) {
                const cell = cells.get(targets[i].cell);
                const v = to2(cell.element.multiverse.position)
                    .sub(to2(source.element.multiverse.position))
                    .setLength(worldConfig.speed * 0.25);
                cell.state.velocity.add(v);
                v.negate();
                source.state.velocity.add(v);
                points.push(() => {
                    const absolute = new Vector2().addVectors(cell.element.get(targets[i].organell).center, to2(cell.element.multiverse.position));
                    return new Vector2().subVectors(absolute, to2(source.element.multiverse.position));
                });
            }
            if (source.state.velocity.length() > worldConfig.speed) source.state.velocity.setLength(worldConfig.speed);
            for (let i = 0; i < targets.length; i++) {
                const cell = cells.get(targets[i].cell);
                if (cell.state.velocity.length() > worldConfig.speed) cell.state.velocity.setLength(worldConfig.speed);
            }
            const timing = source.element.attack(points, start, finish);
            for (let i = 0; i < targets.length; i++) {
                const cell = cells.get(targets[i].cell);
                cell.element.irritate(targets[i].organell, timing.finishIn, timing.finishOut);
            }
        },
    };
}
