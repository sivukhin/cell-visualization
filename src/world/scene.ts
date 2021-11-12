import { Color, Scene } from "three";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { createWorld, WorldElement } from "./world";
import { setLastTick } from "../utils/tick";
import { randomFrom } from "../utils/math";

export function createScene(dynamic: WorldConfiguration) {
    const scene = new Scene();
    const store = createConfigurationStore(dynamic);
    const camera = createCamera(dynamic.soup.width, dynamic.soup.height);
    scene.add(camera);
    let targets = [];
    let target = null;
    let world: WorldElement | null = null;

    let id = 0;
    store.subscribe((configuration) => {
        id = 0;
        scene.clear();
        const environment = createEnvironment(configuration.soup.width, configuration.soup.height, configuration.light.color);
        scene.add(environment);
        world = createWorld(configuration);
        scene.add(world.object);
        /*
        targets = [];

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
        */
    });
    let attacked = false;
    let refreshAt = 0;
    let lastTime = 0;
    return {
        scene,
        camera,
        tick: (time: number) => {
            setLastTick(time);
            world.tick(time);

            if (id < 8 && time > lastTime + randomFrom(100, 200)) {
                lastTime = time;
                for (let i = 0; i < store.get().soup.count; i++) {
                    world.spawn({ cell: i, organell: id }, 0.2 * store.get().cell.radius);
                }
                id++;
            }
            if (id == 8 && time > lastTime + randomFrom(5000, 8000) && store.get().soup.count > 1) {
                lastTime = time;
                const source = Math.min(store.get().soup.count - 1, Math.floor(randomFrom(0, store.get().soup.count)));
                for (let i = 0; i < 2; i++) {
                    while (true) {
                        const targetCell = Math.min(store.get().soup.count - 1, Math.floor(randomFrom(0, store.get().soup.count)));
                        if (targetCell === source) {
                            continue;
                        }
                        const targetOrganell = Math.min(id - 1, Math.floor(randomFrom(0, id)));
                        world.attack(source, { cell: targetCell, organell: targetOrganell });
                        break;
                    }
                }
            }
            /*
            lastTime = time;
            for (let i = 0; i < targets.length; i++) {
                targets[i].tick(time);
            }
            if (target != null) {
                target.tick(time);
            }
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
             */
        },
    };
}
