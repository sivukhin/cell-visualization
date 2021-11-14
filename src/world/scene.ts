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
import { createMultiworld, Microcosmos, WorldElement } from "./types";
import { BlurShader } from "../postprocessing/blur";

function createOverlayRender(pass: RenderPass) {
    pass.clear = false;
    pass.clearDepth = true;
    return pass;
}

function createOverlayShader(pass: ShaderPass, uniforms?: any) {
    pass.clear = false;
    pass.material.transparent = true;
    if (uniforms) {
        pass.material.uniforms = { ...pass.material.uniforms, ...uniforms };
    }
    return pass;
}

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
        multiworld.bottom.membrane.add(environment);

        const bottomMembrane = new EffectComposer(renderer);
        bottomMembrane.addPass(new RenderPass(multiworld.bottom.membrane, camera));
        bottomMembrane.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.01 } }));
        const bottomOrganell = new EffectComposer(renderer);
        bottomOrganell.addPass(createOverlayRender(new RenderPass(multiworld.bottom.organell, camera)));
        bottomOrganell.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.01 } }));

        const middleMembrane = new EffectComposer(renderer);
        middleMembrane.addPass(createOverlayRender(new RenderPass(multiworld.middle.membrane, camera)));
        middleMembrane.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.005 } }));
        const middleOrganell = new EffectComposer(renderer);
        middleOrganell.addPass(createOverlayRender(new RenderPass(multiworld.middle.organell, camera)));
        middleOrganell.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.005 } }));

        const topMembrane = new EffectComposer(renderer);
        topMembrane.addPass(createOverlayRender(new RenderPass(multiworld.top.membrane, camera)));
        const topOrganell = new EffectComposer(renderer);
        topOrganell.addPass(createOverlayRender(new RenderPass(multiworld.top.organell, camera)));

        const microscope = new EffectComposer(renderer);
        microscope.addPass(createOverlayRender(new RenderPass(multiworld.microscope, camera)));

        composers.splice(0, composers.length);
        composers.push(bottomMembrane, bottomOrganell, middleMembrane, middleOrganell, topMembrane, topOrganell, microscope);
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
