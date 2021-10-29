import { atom } from "nanostores";
import { ColorRepresentation, WebGLRenderer } from "three";
import { WorldConfiguration } from "./configuration";
import { createScene } from "./world/scene";
import { initializeGui } from "./utils/knobs";

function adjust(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
}

function createConfiguration(): WorldConfiguration {
    const configuration: WorldConfiguration = {
        light: {
            color: atom<ColorRepresentation>("#ffffff"),
            intensity: atom<number>(1),
        },
        soup: {
            count: atom<number>(3),
            width: 300,
            height: 300,
        },
        cell: {
            membrane: {
                segments: atom<number>(10),
                detalization: atom<number>(50),
                frequency: atom<number>(0.02),
                radius: atom<number>(50),
                delta: atom<number>(10),
                color: atom<ColorRepresentation>("rgba(141, 177, 185, 0.5)"),
            },
            organellsCount: atom<number>(4),
            radiusLimit: atom<number>(30),
        },
    };
    initializeGui(configuration, {
        light: { intensity: { min: 0, max: 1, step: 0.01 } },
        soup: { count: { min: 1, max: 10, step: 1 } },
        cell: {
            membrane: {
                segments: { min: 3, max: 10, step: 1 },
                detalization: { min: 10, max: 100, step: 1 },
                frequency: { min: 0, max: 0.1, step: 0.0001 },
                radius: { min: 10, max: 100, step: 1 },
                delta: { min: 1, max: 20, step: 1 },
            },
            organellsCount: { min: 0, max: 10, step: 1 },
            radiusLimit: { min: 1, max: 50, step: 1 },
        },
    });
    return configuration;
}

function initialize() {
    const configuration = createConfiguration();
    const { scene, camera, tick } = createScene(configuration);
    const renderer = new WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true,
    });
    adjust(renderer);

    function render(time: number) {
        tick(time);
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

initialize();
