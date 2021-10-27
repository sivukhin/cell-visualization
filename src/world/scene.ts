import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Object3D, Path, Scene, Vector2 } from "three";
import { createLight } from "./light";
import { createCamera } from "./camera";
import { CellConfiguration, SoupConfiguration, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { generateCircles, getRegularPolygon, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { interpolate, randomVector } from "../utils/math";
import { computed, Store } from "nanostores";
import { createAliveMembrane } from "./membrane";

function createAliveCell(n: number, r: number, organellsCount: number, organellsRadius: number) {
    const root = new Object3D();
    const membrane = createAliveMembrane(n, r, 0.3 * r, );
    const organells = [];
    const circles = generateCircles(organellsCount, (membrane.minR + membrane.maxR) / 2, organellsRadius);
    for (let i = 0; i < organellsCount; i++) {
        const or = circles[i].radius;
        const current = createAliveMembrane(Math.floor((1 + Math.random()) * 3), or, 0.3 * or);
        current.object.position.set(circles[i].center.x, circles[i].center.y, 0);
        organells.push(current);
        membrane.object.add(current.object);
    }
    root.add(membrane.object);
    return {
        r: r + 0.1 * r,
        object: root,
        tick: (time: number) => {
            membrane.tick(time);
            for (let i = 0; i < organells.length; i++) {
                organells[i].tick(time);
            }
        },
    };
}

function generateCells(soupConfiguration: SoupConfiguration, cellConfiguration: CellConfiguration): Store<any> {
    return computed([soupConfiguration.count, cellConfiguration.radiusLimit, cellConfiguration.organells.count, cellConfiguration.membrane.segments], (n, r, organells, segments) => {
        const cells = [];
        const angular = [];
        const velocities = [];
        const circles = generateCircles(n, Math.min(soupConfiguration.width, soupConfiguration.height) / 2, r);
        for (let i = 0; i < n; i++) {
            const cell = createAliveCell(segments, circles[i].radius, organells);
            cell.object.position.set(circles[i].center.x, circles[i].center.y, 0);
            cells.push(cell);
            velocities.push(randomVector(0.5));
            angular.push(0);
        }
        return [cells, angular, velocities];
    });
}

function createCells(soupConfiguration: SoupConfiguration, cellConfiguration: CellConfiguration) {
    const root = new Object3D();
    const data = generateCells(soupConfiguration, cellConfiguration);
    data.subscribe(([cells, angular, velocities]) => {
        root.clear();
        for (let i = 0; i < cells.length; i++) {
            root.add(cells[i].object);
        }
    });
    return {
        object: root,
        tick: (time: number) => {
            const [cells, angular, velocities] = data.get();
            const n = cells.length;
            for (let i = 0; i < n; i++) {
                velocities[i].rotateAround(zero2, angular[i]);
                angular[i] += (0.5 - Math.random()) * 0.1;
                angular[i] = Math.min(-0.01, Math.max(0.01, angular[i]));
            }
            for (let i = 0; i < n; i++) {
                cells[i].tick(time);
                cells[i].object.translateX(velocities[i].x);
                cells[i].object.translateY(velocities[i].y);
                if (cells[i].object.position.x - cells[i].r < -100) {
                    velocities[i].x = Math.abs(velocities[i].x);
                }
                if (cells[i].object.position.x + cells[i].r > 100) {
                    velocities[i].x = -Math.abs(velocities[i].x);
                }
                if (cells[i].object.position.y - cells[i].r < -100) {
                    velocities[i].y = Math.abs(velocities[i].y);
                }
                if (cells[i].object.position.y + cells[i].r > 100) {
                    velocities[i].y = -Math.abs(velocities[i].y);
                }
            }
            for (let i = 0; i < n; i++) {
                for (let s = i + 1; s < n; s++) {
                    if (cells[i].r + cells[s].r < cells[i].object.position.distanceTo(cells[s].object.position)) {
                        continue;
                    }
                    const tmp = velocities[i];
                    velocities[i] = velocities[s];
                    velocities[s] = tmp;
                }
            }
        },
    };
}

export function createScene(configuration: WorldConfiguration) {
    const scene = new Scene();
    const environment = createEnvironment(configuration.soup.width, configuration.soup.height);
    scene.add(environment);
    const light = createLight(0, 0, 100, configuration.light);
    scene.add(light);
    const camera = createCamera(configuration.soup.width, configuration.soup.height);
    scene.add(camera);
    const cell = createCells(configuration.soup, configuration.cell);
    scene.add(cell.object);
    return {
        scene,
        camera,
        tick: (time: number) => {
            cell.tick(number);
        },
    };
}
