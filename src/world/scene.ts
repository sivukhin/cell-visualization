import { Scene, WebGLRenderer } from "three";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { createWorld, WorldElement } from "./world";
import { setLastTick } from "../utils/tick";
import { randomFrom } from "../utils/math";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { RGBShiftShader } from "../postprocessing/rgb-shift";
import { EdgeGlowShader } from "../postprocessing/glow";

export function createScene(dynamic: WorldConfiguration, renderer: WebGLRenderer) {
    let zoom = 1;
    const store = createConfigurationStore(dynamic);

    const worldScene = new Scene();
    const microscopeScene = new Scene();
    microscopeScene.background = null;

    const camera = createCamera(dynamic.soup.width, dynamic.soup.height);
    worldScene.add(camera.camera);
    microscopeScene.add(camera.camera);

    let targets = [];
    let target = null;
    let world: WorldElement | null = null;

    let id = 0;
    store.subscribe((configuration) => {
        id = 0;
        worldScene.clear();
        microscopeScene.clear();

        const environment = createEnvironment(configuration.soup.width, configuration.soup.height, configuration.light.color);
        worldScene.add(environment);
        world = createWorld(configuration);
        worldScene.add(world.object);
        if (world.microscope != null) {
            microscopeScene.add(world.microscope);
        }
    });

    const microcosmosComposer = new EffectComposer(renderer);
    microcosmosComposer.addPass(new RenderPass(worldScene, camera.camera));
    // microcosmosComposer.addPass(new ShaderPass(RGBShiftShader));
    // microcosmosComposer.addPass(new ShaderPass(EdgeGlowShader));

    const microscopeComposer = new EffectComposer(renderer);
    const pass = new RenderPass(microscopeScene, camera.camera);
    pass.clear = false;
    pass.clearDepth = true;
    microscopeComposer.addPass(pass);

    let attacked = false;
    let refreshAt = 0;
    let lastTime = 0;
    return {
        scene: worldScene,
        camera,
        microcosmosComposer,
        microscopeComposer,
        tick: (time: number) => {
            setLastTick(time);
            world.tick(time);

            if (id < 10 && time > lastTime + randomFrom(1000, 2000)) {
                lastTime = time;
                for (let i = 0; i < store.get().soup.count; i++) {
                    world.spawn({ cell: i, organell: id }, 0.2 * store.get().cell.radius);
                }
                id++;
            }
            if (id == 10 && time > lastTime + randomFrom(1000, 2000) && store.get().soup.count > 1) {
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
