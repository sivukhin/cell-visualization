import { Scene, Vector2, WebGLRenderer } from "three";
import { UnrealBloomPass } from "../postprocessing/unreal-bloom";
import { createCamera } from "./camera";
import { createConfigurationStore, WorldConfiguration } from "../configuration";
import { createWorld } from "./world";
import { tick } from "../utils/tick";
import { EffectComposer, Pass } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";
import { GodElement, Microcosmos, MicroscopeElement, WorldElement } from "./types";
// import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { createGod } from "./god";
import { createMicroscope } from "../microscope/microscope";
import { ColorifyShader } from "three/examples/jsm/shaders/ColorifyShader";

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

    const { camera, move, zoom, magnification } = createCamera(dynamic.soup.width, dynamic.soup.height);

    let world: WorldElement | null = null;
    let microscope: MicroscopeElement | null = null;
    let god: GodElement | null = null;
    let composers: EffectComposer[] = [];

    let id = 0;

    store.subscribe((configuration) => {
        id = 0;
        world = createWorld(configuration);
        microscope = createMicroscope(configuration);
        god = createGod(world, microscope);

        const scene = new Scene();
        scene.add(world.multiverse);
        scene.add(camera);

        const size = new Vector2();
        renderer.getSize(size);
        const composer = new EffectComposer(renderer);
        composer.addPass(createOverlayRender(new RenderPass(scene, camera)));
        composer.addPass(new UnrealBloomPass(size, configuration.cell.bloomStrength, configuration.cell.bloomRadius, configuration.cell.bloomThreshold));
        composers.splice(0, composers.length);
        composers.push(composer);
    });

    let lastTime = -Infinity;
    return {
        composers: composers,
        move: move,
        zoom: zoom,
        magnification: magnification,
        tick: (time: number) => {
            const [worldTime, stopped] = tick(time);
            if (!stopped) {
                world.tick(worldTime);
            }
            microscope.tick(worldTime);
            god.tick(worldTime);
        },
    };
}
