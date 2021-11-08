import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    DynamicDrawUsage,
    Float32BufferAttribute,
    Line,
    LineBasicMaterial,
    Mesh,
    MeshBasicMaterial,
    MeshPhongMaterial,
    Object3D,
    Path,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Uniform,
    Vector2,
    Vector3,
} from "three";
import { createLight } from "./light";
import { createCamera } from "./camera";
import { CellConfiguration, createConfigurationStore, SoupConfiguration, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { generateCircles, getRegularPolygon, tryIntersectLineCircle, zero2 } from "../utils/geometry";
import { interpolate, randomFrom, randomVector } from "../utils/math";
import { computed, Store } from "nanostores";
import { createAliveCell, createAliveMembrane } from "./cell";
import { createFlagellum } from "./flagellum";
import { createFlagellumTree } from "./flagellum-tree";
import { getFlatComponents3D } from "../utils/draw";

import GlowVertexShader from "../shaders/cell-vertex.shader";
import GlowFragmentShader from "../shaders/cell-fragment.shader";

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
    let targets = [];
    let target = null;
    let lastTime = 0;

    store.subscribe((configuration) => {
        scene.clear();
        targets = [];

        const environment = createEnvironment(configuration.soup.width, configuration.soup.height, configuration.light.color);
        scene.add(environment);
        // const light = createLight(0, 0, 100, configuration.light);
        // scene.add(light);
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
        for (let i = 0; i < configuration.soup.rows; i++) {
            for (let s = 0; s < configuration.soup.cols; s++) {
                const target = createAliveCell(configuration.cell, configuration.flagellum);
                scene.add(target.object);
                target.object.position.set(
                    configuration.cell.membrane.radius + (i - configuration.soup.rows / 2) * configuration.soup.xDistance,
                    (s - configuration.soup.cols / 2) * configuration.soup.yDistance,
                    0
                );
                targets.push(target);
            }
        }

        // const geometry = new BufferGeometry();
        // const polygon = getRegularPolygon(8, 200);
        // const positions = new BufferAttribute(getComponents([new Vector2(0, 0), ...polygon]), 3);
        // geometry.setAttribute("position", positions);
        // const normalsComponents = [];
        // for (let i = 0; i < polygon.length + 1; i++) {
        //     normalsComponents.push(...[0, 0, 1]);
        // }
        // const normals = new BufferAttribute(new Float32Array(normalsComponents), 3);
        // geometry.setAttribute("normal", normals);
        // const index = [];
        // for (let i = 0; i < polygon.length; i++) {
        //     index.push(...[0, i + 1, ((i + 1) % polygon.length) + 1]);
        // }
        // geometry.setIndex(index);
        // const cellColor = new Color(configuration.cell.membrane.color);
        // const cellColorHsl = { h: 0, s: 0, l: 0 };
        // cellColor.getHSL(cellColorHsl);
        //
        // const material = new ShaderMaterial({
        //     uniforms: {
        //         u_color: new Uniform(new Vector3(cellColorHsl.h, cellColorHsl.s, cellColorHsl.l)),
        //         start: new Uniform(0.7),
        //     },
        //     vertexShader: GlowVertexShader,
        //     fragmentShader: GlowFragmentShader,
        //     transparent: true,
        // });
        // const mesh = new Mesh(geometry, material);
        // scene.add(mesh);
    });
    let attacked = false;
    let refreshAt = 0;
    return {
        scene,
        camera,
        tick: (time: number) => {
            lastTime = time;
            // cell.tick(time);
            for (let i = 0; i < targets.length; i++) {
                targets[i].tick(time);
            }
            if (target != null) {
                target.tick(time);
            }
            // if (target == null || time > refreshAt) {
            //     scene.clear();
            //     refreshAt = time + 2000;
            //     target = createFlagellum(
            //         {
            //             startDirection: new Vector2(1, 0),
            //             finishDirection: new Vector2(1, 0),
            //             target: new Vector2(500, 0),
            //             timings: {
            //                 startIn: time,
            //                 finishIn: time + 1000,
            //                 startOut: time + 1500,
            //                 finishOut: time + 2000,
            //             },
            //         },
            //         {
            //             segmentLength: store.get().flagellum.segmentLength,
            //             amplitude: store.get().flagellum.amplitude,
            //             skewLimit: store.get().flagellum.skewLimit,
            //             color: store.get().flagellum.color,
            //             minWobbling: store.get().flagellum.minWobbling,
            //         }
            //     );
            //     scene.add(target.object);
            // }
            // if (target2 != null) {
            //     target2.tick(time);
            // }
            if (time % 10000 < 1000) {
                attacked = false;
            }
            if (time % 10000 > 1000 && !attacked) {
                attacked = true;
                for (let i = 0; i < targets.length; i++) {
                    const points = [];
                    const k = randomFrom(0, 1.1);
                    const cells = [];
                    for (let s = 0; s < k; s++) {
                        // target.object.position.set(
                        //     configuration.cell.membrane.radius + (i - configuration.soup.rows / 2) * configuration.soup.xDistance,
                        //     (s - configuration.soup.cols / 2) * configuration.soup.yDistance,
                        //     0
                        // );

                        let a = Math.ceil(randomFrom(0, store.get().soup.rows)) % store.get().soup.rows;
                        let b = Math.ceil(randomFrom(0, store.get().soup.cols)) % store.get().soup.cols;
                        if (a == Math.ceil(target / store.get().soup.rows) && b == target % store.get().soup.cols) {
                            a = (a + 1) % store.get().soup.rows;
                            b = (b + 1) % store.get().soup.cols;
                        }
                        const attack = targets[a * store.get().soup.cols + b];
                        const center = new Vector2(attack.object.position.x, attack.object.position.y).add(attack.organell.position);
                        points.push(
                            new Vector2(randomFrom(0, 10), 0)
                                .rotateAround(zero2, randomFrom(0, Math.PI * 2))
                                .add(center)
                                .sub(new Vector2(targets[i].object.position.x, targets[i].object.position.y))
                        );
                        cells.push(targets[a * store.get().soup.cols + b]);
                    }
                    if (points.length > 0) {
                        const timings = targets[i].attack(points);
                        for (let k = 0; k < timings.length; k++) {
                            cells[k].glow(timings[k]);
                        }
                    }
                }
            }
        },
    };
}
