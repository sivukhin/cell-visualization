import { Unwrap, WorldConfiguration } from "../configuration";
import { Color, Object3D, Vector2, Vector3 } from "three";
import { getComponents, zero2 } from "../utils/geometry";
import { createAliveCell } from "./cell";
import { CellElement, OrganellId, TargetElement, WorldElement } from "./types";
import { createTarget } from "../microscope/target";
import { to2, to3 } from "../utils/draw";
import { randomChoice, randomFrom } from "../utils/math";
import { tickAll } from "../utils/tick";

const names = [
    "Shadow Servants",
    "VoidHack",
    "keva",
    "Espacio",
    "c00kies@venice",
    "SiBears",
    "MSHP SSL: The Elite Firm",
    "WE_0WN_Y0U",
    "Переподвысмотрит",
    "saarsec",
    "SwissMadeSecurity",
    "BSUIR",
    "Bushwhackers",
    "[censored]",
    "Lights Out",
    "Tower Of Hanoi",
    "Destructive Voice",
    "girav",
    "Teamspin Magic-Hat",
    "ENOFLA",
];

export function createWorld(worldConfig: Unwrap<WorldConfiguration>): WorldElement {
    const multiverse = {
        top: { organell: new Object3D(), membrane: new Object3D() },
        middle: { organell: new Object3D(), membrane: new Object3D() },
        bottom: { organell: new Object3D(), membrane: new Object3D() },
        microscope: new Object3D(),
    };

    const velocities: Vector2[] = [];
    const angular: number[] = [];
    const positions: Vector2[] = [];
    const radiuses: number[] = [];
    const teams: string[] = [];
    const rows = Math.ceil(Math.sqrt(worldConfig.soup.count));
    const cols = Math.ceil(worldConfig.soup.count / rows);
    const dy = worldConfig.soup.height / rows;
    const dx = worldConfig.soup.width / cols;
    for (let i = 0; i < rows && positions.length < worldConfig.soup.count; i++) {
        for (let s = 0; s < cols && positions.length < worldConfig.soup.count; s++) {
            positions.push(new Vector2(dx * s + dx / 2 + randomFrom(-dx / 4, dx / 4) - worldConfig.soup.width / 2, dy * i + dy / 2 + randomFrom(-dy / 4, dy / 4) - worldConfig.soup.height / 2));
            velocities.push(new Vector2(worldConfig.speed, 0).rotateAround(zero2, randomFrom(0, 2 * Math.PI)));
            radiuses.push(worldConfig.cell.radius / (1 + (2 - (radiuses.length % 3)) / 2));
            angular.push(randomFrom(-0.001, 0.001));
            teams.push(randomChoice(names));
        }
    }
    const cells: CellElement[] = [];
    let targets: TargetElement[] = [];
    for (let i = 0; i < positions.length; i++) {
        const cell = createAliveCell({ ...worldConfig.cell, radius: radiuses[i] }, worldConfig.flagellum);
        cell.multiverse.membrane.position.set(positions[i].x, positions[i].y, 0);
        cell.multiverse.organell.position.set(positions[i].x, positions[i].y, 0);
        const layer = [multiverse.top, multiverse.top, multiverse.top][i % 3];
        layer.membrane.add(cell.multiverse.membrane);
        layer.organell.add(cell.multiverse.organell);
        cells.push(cell);
    }
    let previousRound = 0;
    let attacks: Array<{ from: number; to: OrganellId }> = [];
    const accent = (id: number, caption: string, select: boolean, highlight: boolean) => {
        const size = (radiuses[id] / Math.cos(Math.PI / worldConfig.cell.segments)) * (1 + worldConfig.cell.membrane.wobbling) * 2;
        const target = createTarget({
            follow: () => to2(cells[id].multiverse.membrane.position),
            size: size,
            appearDuration: worldConfig.target.appearDuration,
            typingDuration: worldConfig.target.typingDuration,
            selectDuration: worldConfig.target.selectDuration,
            select: select,
            highlight: highlight,
            caption: caption,
            width: worldConfig.soup.width,
            height: worldConfig.soup.height,
        });
        targets.push(target);
        multiverse.microscope.add(target.multiverse);
    };
    return {
        multiverse: multiverse,
        tick: (time: number) => {
            for (let i = 0; i < cells.length; i++) {
                cells[i].tick(time);
                cells[i].multiverse.organell.position.x += velocities[i].x;
                cells[i].multiverse.organell.position.y += velocities[i].y;
                cells[i].multiverse.membrane.position.x += velocities[i].x;
                cells[i].multiverse.membrane.position.y += velocities[i].y;
                cells[i].multiverse.organell.rotateZ(angular[i]);
            }
            for (let i = 0; i < cells.length; i++) {
                if (cells[i].multiverse.membrane.position.x < -worldConfig.soup.width / 2 + 2 * radiuses[i]) {
                    velocities[i].x += worldConfig.speed / 10;
                }
                if (cells[i].multiverse.membrane.position.y < -worldConfig.soup.height / 2 + 2 * radiuses[i]) {
                    velocities[i].y += worldConfig.speed / 10;
                }
                if (cells[i].multiverse.membrane.position.x > worldConfig.soup.width / 2 - 2 * radiuses[i]) {
                    velocities[i].x -= worldConfig.speed / 10;
                }
                if (cells[i].multiverse.membrane.position.y > worldConfig.soup.height / 2 - 2 * radiuses[i]) {
                    velocities[i].y -= worldConfig.speed / 10;
                }
                for (let s = 0; s < cells.length; s++) {
                    const aPosition = to2(cells[i].multiverse.membrane.position);
                    const bPosition = to2(cells[s].multiverse.membrane.position);
                    if (i == s || aPosition.distanceTo(bPosition) + 10 > radiuses[i] + radiuses[s]) {
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
            targets = tickAll(targets, time, (t) => multiverse.microscope.remove(t.multiverse));

            if (time - previousRound > worldConfig.roundDuration) {
                const groups = new Map<number, OrganellId[]>();
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
                const attackers = [];
                const defenders = [];
                for (let i = 0; i < Math.min(ordered.length, 2); i++) {
                    const source = cells[ordered[i][0]];
                    attackers.push(ordered[i][0]);
                    const targets = ordered[i][1].map((id) => {
                        const relative3d = to3(cells[id.cell].get(id.organell));
                        const cell3d = cells[id.cell].multiverse.membrane.position;
                        const absolute3d = new Vector3().addVectors(relative3d, cell3d).sub(cells[ordered[i][0]].multiverse.membrane.position);
                        return new Vector2(absolute3d.x, absolute3d.y);
                    });
                    const timings = source.attack(targets, time + worldConfig.target.typingDuration, time + worldConfig.target.typingDuration + worldConfig.roundDuration / 3);
                    for (let s = 0; s < ordered[i][1].length; s++) {
                        defenders.push(ordered[i][1][s].cell);
                        cells[ordered[i][1][s].cell].irritate(ordered[i][1][s].organell, timings[s].finishIn, timings[s].finishOut);
                    }
                }
                for (let i = 0; i < teams.length; i++) {
                    const select = defenders.includes(i);
                    const highlight = attackers.includes(i);
                    if (select || highlight) {
                        accent(i, teams[i], select, highlight);
                    }
                }
                previousRound = time;
                attacks = [];
            }
            return true;
        },
        accent: accent,
        spawn: (id: OrganellId, weight: number) => {
            cells[id.cell].spawn(id.organell, weight);
        },
        attack: (from: number, to: OrganellId) => {
            attacks.push({ from, to });
        },
    };
}
