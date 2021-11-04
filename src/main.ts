import { atom } from "nanostores";
import { ColorRepresentation, WebGLRenderer } from "three";
import { WorldConfiguration } from "./configuration";
import { createScene } from "./world/scene";
import { initializeGui } from "./utils/knobs";
import Stats from "stats.js";

function adjust(renderer) {
    const canvas = renderer.domElement;
    canvas.width = 900;
    canvas.height = 900;
    canvas.style.width = "900px";
    canvas.style.height = "900px";
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
}

function createConfiguration(): WorldConfiguration {
    const configuration: WorldConfiguration = {
        light: {
            color: atom<ColorRepresentation>("rgb(43, 50, 71)"),
            intensity: atom<number>(1),
        },
        soup: {
            count: atom<number>(3),
            rows: atom<number>(1),
            cols: atom<number>(1),
            xDistance: atom<number>(0),
            yDistance: atom<number>(0),
            width: 1500,
            height: 1500,
        },
        cell: {
            membrane: {
                segments: atom<number>(10),
                detalization: atom<number>(50),
                frequency: atom<number>(0.0001),
                radius: atom<number>(200),
                delta: atom<number>(50),
                color: atom<ColorRepresentation>("rgba(84,105,125,1.0)"),
                skewLimit: atom<number>(Math.PI / 6),
                angularLimit: atom<number>(0.01),
                glowStart: atom<number>(0.8),
            },
            organellsCount: atom<number>(4),
            radiusLimit: atom<number>(30),
        },
        flagellum: {
            color: atom<ColorRepresentation>("rgba(84,105,125,1.0)"),
            segmentLength: atom<number>(50),
            amplitude: atom<number>(100),
            skewLimit: atom<number>(Math.PI),
            minWobbling: atom<number>(0.1),
        },
    };
    initializeGui(configuration, {
        light: { intensity: { min: 0, max: 1, step: 0.01 } },
        soup: {
            rows: { min: 1, max: 10, step: 1 },
            cols: { min: 1, max: 10, step: 1 },
            xDistance: { min: 1, max: 1000 },
            yDistance: { min: 1, max: 1000 },
            count: { min: 1, max: 10, step: 1 },
        },
        cell: {
            membrane: {
                segments: { min: 3, max: 10, step: 1 },
                detalization: { min: 10, max: 100, step: 1 },
                frequency: { min: 0, max: 0.01, step: 0.0001 },
                radius: { min: 10, max: 200, step: 1 },
                delta: { min: 1, max: 100, step: 1 },
                skewLimit: { min: 0, max: Math.PI, step: 0.001 },
                angularLimit: { min: 0, max: 1, step: 0.01 },
                glowStart: { min: 0, max: 1, step: 0.01 },
            },
            organellsCount: { min: 0, max: 10, step: 1 },
            radiusLimit: { min: 1, max: 50, step: 1 },
        },
        flagellum: {
            segmentLength: { min: 2, max: 100, step: 1 },
            amplitude: { min: 1, max: 200, step: 1 },
            skewLimit: { min: 0, max: Math.PI, step: 0.1 },
            minWobbling: { min: 0, max: 1, step: 0.05 },
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
        alpha: true,
    });

    adjust(renderer);

    const stats = Stats();

    function render(time: number) {
        stats.begin();
        tick(time);
        renderer.render(scene, camera);
        stats.end();
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}

initialize();
