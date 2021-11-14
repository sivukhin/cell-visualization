import { WebGLRenderer } from "three";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { createWorld } from "./world";
import { setLastTick } from "../utils/tick";
import { randomFrom } from "../utils/math";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { RGBShiftShader } from "../postprocessing/rgb-shift";
import { EdgeGlowShader } from "../postprocessing/glow";
import { createMultiworld, Microcosmos, WorldElement } from "./types";

export function createScene(dynamic: WorldConfiguration, renderer: WebGLRenderer): Microcosmos {
    const store = createConfigurationStore(dynamic);

    const { camera, move, zoom, magnification } = createCamera(dynamic.soup.width, dynamic.soup.height);

    let world: WorldElement | null = null;
    let composers: EffectComposer[] = [];

    let id = 0;
    store.subscribe((configuration) => {
        id = 0;
        world = createWorld(configuration);
        const multiworld = createMultiworld(world.multiverse, camera);
        const environment = createEnvironment(configuration.soup.width, configuration.soup.height, configuration.light.color);
        multiworld.membrane.add(environment);

        const membrane = new EffectComposer(renderer);
        membrane.addPass(new RenderPass(multiworld.membrane, camera));
        membrane.addPass(new ShaderPass(RGBShiftShader));

        const organell = new EffectComposer(renderer);
        const organellPass = new RenderPass(multiworld.organell, camera);
        organellPass.clear = false;
        organellPass.clearDepth = true;
        organell.addPass(organellPass);

        const microscope = new EffectComposer(renderer);
        const microscopePass = new RenderPass(multiworld.microscope, camera);
        microscopePass.clear = false;
        microscopePass.clearDepth = true;
        microscope.addPass(microscopePass);

        composers.splice(0, composers.length);
        composers.push(membrane, organell, microscope);
    });

    let lastTime = 0;
    return {
        composers: composers,
        move: move,
        zoom: zoom,
        magnification: magnification,
        tick: (time: number) => {
            setLastTick(time);
            world.tick(time);

            if (id < 10 && time > lastTime + randomFrom(100, 200)) {
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
