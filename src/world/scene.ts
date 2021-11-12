import { Scene, Vector3 } from "three";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { createWorld, WorldElement } from "./world";
import { setLastTick } from "../utils/tick";
import { randomFrom } from "../utils/math";

export function createScene(dynamic: WorldConfiguration) {
    let zoom = 1;
    const scene = new Scene();
    const store = createConfigurationStore(dynamic);
    const camera = createCamera(dynamic.soup.width, dynamic.soup.height);
    scene.add(camera.camera);
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
        },
    };
}
