import { Color, Vector2, WebGLRenderer } from "three";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createEnvironment } from "./environment";
import { createWorld } from "./world";
import { setLastTick } from "../utils/tick";
import { randomFrom } from "../utils/math";
import { EffectComposer, Pass } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { createMultiworld, GodElement, Microcosmos, WorldElement } from "./types";
import { BlurShader } from "../postprocessing/blur";
import { EdgeGlowShader } from "../postprocessing/glow";
import { BloomPass } from "three/examples/jsm/postprocessing/BloomPass";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";
import { subscribeApi } from "../api";
import { createTeamIndex } from "../glue";
import { createGod } from "./god";

function createOverlayRender(pass: RenderPass) {
    pass.clear = false;
    pass.clearDepth = true;
    return pass;
}

function createOverlayShader(pass: ShaderPass, uniforms?: any | undefined, needsSwap?: boolean) {
    pass.clear = false;
    pass.material.transparent = true;
    if (uniforms) {
        pass.material.uniforms = { ...pass.material.uniforms, ...uniforms };
    }
    if (needsSwap) {
        pass.needsSwap = true;
    }
    return pass;
}

function createOverlay<T extends Pass>(pass: T, modify: (t: T) => void) {
    modify(pass);
    return pass;
}

export function createScene(dynamic: WorldConfiguration, renderer: WebGLRenderer): Microcosmos {
    const store = createConfigurationStore(dynamic);

    const { camera, move, zoom, magnification, position } = createCamera(dynamic.soup.width, dynamic.soup.height);

    let world: WorldElement | null = null;
    let god: GodElement | null = null;
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
        // bottomMembrane.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.01 } }));
        const bottomOrganell = new EffectComposer(renderer);
        bottomOrganell.addPass(createOverlayRender(new RenderPass(multiworld.bottom.organell, camera)));
        // bottomOrganell.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.01 } }));

        const middleMembrane = new EffectComposer(renderer);
        middleMembrane.addPass(createOverlayRender(new RenderPass(multiworld.middle.membrane, camera)));
        //middleMembrane.addPass(createOverlayShader(new ShaderPass(EdgeGlowShader), undefined, true));
        //middleMembrane.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.005 } }));
        const middleOrganell = new EffectComposer(renderer);
        middleOrganell.addPass(createOverlayRender(new RenderPass(multiworld.middle.organell, camera)));
        //middleOrganell.addPass(createOverlayShader(new ShaderPass(EdgeGlowShader), undefined, true));
        //middleOrganell.addPass(createOverlayShader(new ShaderPass(BlurShader), { u_size: { value: 0.005 } }));

        const size = new Vector2();
        renderer.getSize(size);
        const topMembrane = new EffectComposer(renderer);
        topMembrane.addPass(createOverlayRender(new RenderPass(multiworld.top.membrane, camera)));
        topMembrane.addPass(
            createOverlay(new UnrealBloomPass(size, configuration.cell.bloomStrength, configuration.cell.bloomRadius, configuration.cell.bloomThreshold), (x) => {
                x.clear = false;
            })
        );
        // topMembrane.addPass(createOverlayShader(new ShaderPass(CopyShader)));
        // topMembrane.addPass(createOverlayShader(new ShaderPass(EdgeGlowShader), undefined, true));
        const topOrganell = new EffectComposer(renderer);
        topOrganell.addPass(createOverlayRender(new RenderPass(multiworld.top.organell, camera)));
        // topOrganell.addPass(createOverlayShader(new ShaderPass(EdgeGlowShader), undefined, true));

        const microscope = new EffectComposer(renderer);
        microscope.addPass(createOverlayRender(new RenderPass(multiworld.microscope, camera)));
        // microscope.addPass(createOverlayShader(new ShaderPass(FXAAShader)));

        composers.splice(0, composers.length);
        // composers.push(topMembrane);
        composers.push(bottomMembrane, bottomOrganell, middleMembrane, middleOrganell, topMembrane, topOrganell, microscope);
        god = createGod(world);
    });

    let lastTime = -Infinity;
    return {
        composers: composers,
        move: move,
        zoom: zoom,
        magnification: magnification,
        tick: (time: number) => {
            setLastTick(time);
            world.tick(time);
            god.tick(time);

            // if (id < store.get().soup.count && time > lastTime + randomFrom(100, 200)) {
            //     world.update([
            //         {
            //             id: id,
            //             size: 10,
            //             caption: "Team 1",
            //             organells: [
            //                 {
            //                     id: 1,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("red"),
            //                 },
            //                 {
            //                     id: 2,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("blue"),
            //                 },
            //                 {
            //                     id: 3,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("blue"),
            //                 },
            //                 {
            //                     id: 4,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("green"),
            //                 },
            //                 {
            //                     id: 5,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("orange"),
            //                 },
            //                 {
            //                     id: 6,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("green"),
            //                 },
            //                 {
            //                     id: 7,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("green"),
            //                 },
            //                 {
            //                     id: 8,
            //                     size: 10,
            //                     active: false,
            //                     color: new Color("green"),
            //                 },
            //                 {
            //                     id: 9,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("green"),
            //                 },
            //                 {
            //                     id: 10,
            //                     size: 10,
            //                     active: true,
            //                     color: new Color("green"),
            //                 },
            //             ],
            //         },
            //     ]);
            //     id++;
            // }
            // if (id == store.get().soup.count && time > lastTime + 5000) {
            //     lastTime = time;
            //     world.register(1, "HACK1");
            //     world.attack(0, [{ cell: 1, organell: 5 }], time + 1000, time + 3000);
            //     // world.inspect(0, time + 1000, time + 5000);
            // }
            // if (id == 10 && time > lastTime + randomFrom(1000, 2000) && store.get().soup.count > 1) {
            //     lastTime = time;
            //     const source = Math.min(store.get().soup.count - 1, Math.floor(randomFrom(0, store.get().soup.count)));
            //     for (let i = 0; i < 1; i++) {
            //         while (true) {
            //             const targetCell = Math.min(store.get().soup.count - 1, Math.floor(randomFrom(0, store.get().soup.count)));
            //             if (targetCell === source) {
            //                 continue;
            //             }
            //             const targetOrganell = Math.min(id - 1, Math.floor(randomFrom(0, id)));
            //             world.attack(source, { cell: targetCell, organell: targetOrganell });
            //             break;
            //         }
            //     }
            // }
        },
    };
}
