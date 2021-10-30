import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Line, LineBasicMaterial, Object3D, Path, Scene, Vector2 } from "three";
import { createLight } from "./light";
import { createCamera } from "./camera";
import { CellConfiguration, createConfigurationStore, SoupConfiguration, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { generateCircles, getRegularPolygon, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { interpolate, randomFrom, randomVector } from "../utils/math";
import { computed, Store } from "nanostores";
import { createAliveMembrane } from "./membrane";
import { createFlagellum } from "./flagellum";
import { createFlagellumTree } from "./flagellum-tree";

// function createAliveCell(n: number, r: number, organellsCount: number, organellsRadius: number) {
//     const root = new Object3D();
//     const membrane = createAliveMembrane(n, r, 0.3 * r);
//     const organells = [];
//     const circles = generateCircles(organellsCount, (membrane.minR + membrane.maxR) / 2, organellsRadius);
//     for (let i = 0; i < organellsCount; i++) {
//         const or = circles[i].radius;
//         const current = createAliveMembrane(Math.floor((1 + Math.random()) * 3), or, 0.3 * or);
//         current.object.position.set(circles[i].center.x, circles[i].center.y, 0);
//         organells.push(current);
//         membrane.object.add(current.object);
//     }
//     root.add(membrane.object);
//     return {
//         r: r + 0.1 * r,
//         object: root,
//         tick: (time: number) => {
//             membrane.tick(time);
//             for (let i = 0; i < organells.length; i++) {
//                 organells[i].tick(time);
//             }
//         },
//     };
// }
//
// function generateCells(soupConfiguration: SoupConfiguration, cellConfiguration: CellConfiguration): Store<any> {
//     return computed([soupConfiguration.count, cellConfiguration.radiusLimit, cellConfiguration.organells.count, cellConfiguration.membrane.segments], (n, r, organells, segments) => {
//         const cells = [];
//         const angular = [];
//         const velocities = [];
//         const circles = generateCircles(n, Math.min(soupConfiguration.width, soupConfiguration.height) / 2, r);
//         for (let i = 0; i < n; i++) {
//             const cell = createAliveCell(segments, circles[i].radius, organells);
//             cell.object.position.set(circles[i].center.x, circles[i].center.y, 0);
//             cells.push(cell);
//             velocities.push(randomVector(0.5));
//             angular.push(0);
//         }
//         return [cells, angular, velocities];
//     });
// }
//
// function createCells(soupConfiguration: SoupConfiguration, cellConfiguration: CellConfiguration) {
//     const root = new Object3D();
//     const data = generateCells(soupConfiguration, cellConfiguration);
//     data.subscribe(([cells, angular, velocities]) => {
//         root.clear();
//         for (let i = 0; i < cells.length; i++) {
//             root.add(cells[i].object);
//         }
//     });
//     return {
//         object: root,
//         tick: (time: number) => {
//             const [cells, angular, velocities] = data.get();
//             const n = cells.length;
//             for (let i = 0; i < n; i++) {
//                 velocities[i].rotateAround(zero2, angular[i]);
//                 angular[i] += (0.5 - Math.random()) * 0.1;
//                 angular[i] = Math.min(-0.01, Math.max(0.01, angular[i]));
//             }
//             for (let i = 0; i < n; i++) {
//                 cells[i].tick(time);
//                 cells[i].object.translateX(velocities[i].x);
//                 cells[i].object.translateY(velocities[i].y);
//                 if (cells[i].object.position.x - cells[i].r < -100) {
//                     velocities[i].x = Math.abs(velocities[i].x);
//                 }
//                 if (cells[i].object.position.x + cells[i].r > 100) {
//                     velocities[i].x = -Math.abs(velocities[i].x);
//                 }
//                 if (cells[i].object.position.y - cells[i].r < -100) {
//                     velocities[i].y = Math.abs(velocities[i].y);
//                 }
//                 if (cells[i].object.position.y + cells[i].r > 100) {
//                     velocities[i].y = -Math.abs(velocities[i].y);
//                 }
//             }
//             for (let i = 0; i < n; i++) {
//                 for (let s = i + 1; s < n; s++) {
//                     if (cells[i].r + cells[s].r < cells[i].object.position.distanceTo(cells[s].object.position)) {
//                         continue;
//                     }
//                     const tmp = velocities[i];
//                     velocities[i] = velocities[s];
//                     velocities[s] = tmp;
//                 }
//             }
//         },
//     };
// }

export function createScene(dynamic: WorldConfiguration) {
    const scene = new Scene();
    const store = createConfigurationStore(dynamic);
    const camera = createCamera(dynamic.soup.width, dynamic.soup.height);
    scene.add(camera);
    let target = null;

    store.subscribe((configuration) => {
        scene.clear();

        const environment = createEnvironment(configuration.soup.width, configuration.soup.height);
        scene.add(environment);
        const light = createLight(0, 0, 100, configuration.light);
        scene.add(light);
        // const cell = createCells(configuration.soup, configuration.cell);
        // scene.add(cell.object);
        // target = createFlagellum({ target: new Vector2(100, 100), startIn: 0, finishIn: 1000, startOut: 2000, finishOut: 3000 }, configuration.flagellum);
        // target = createFlagellumTree(
        //     {
        //         branchPoint: new Vector2(200, 0),
        //         targets: [new Vector2(300, 100), new Vector2(300, -50)],
        //         start: 1000,
        //         finish: 5000,
        //     },
        //     configuration.flagellum
        // );
        target = createAliveMembrane(configuration.cell.membrane, configuration.flagellum);
        scene.add(target.object);
    });
    let attacked = false;
    return {
        scene,
        camera,
        tick: (time: number) => {
            // cell.tick(time);
            if (target != null) {
                target.tick(time);
            }
            if (time % 10000 < 1000) {
                attacked = false;
            }
            if (time % 10000 > 1000 && target != null && !attacked) {
                attacked = true;
                const targets = [];
                for (let i = 0; i < 20; i++) {
                    targets.push(new Vector2(randomFrom(200, 500), 0).rotateAround(zero2, randomFrom(0, Math.PI * 2)));
                    // targets.push(new Vector2(500, 0));
                }
                target.attack(targets);
            }
        },
    };
}
