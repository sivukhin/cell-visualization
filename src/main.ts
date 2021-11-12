import { atom } from "nanostores";
import { ColorRepresentation, WebGLRenderer } from "three";
import { WorldConfiguration } from "./configuration";
import { createScene } from "./world/scene";
import { initializeGui } from "./utils/knobs";
import Stats from "stats.js";

function adjust(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
}

function createConfiguration(canvas): WorldConfiguration {
    const configuration: WorldConfiguration = {
        light: {
            color: atom<ColorRepresentation>("rgb(43, 50, 71)"),
            intensity: atom<number>(1),
        },
        soup: {
            count: atom<number>(7),
            width: canvas.clientWidth,
            height: canvas.clientHeight,
        },
        target: {
            appearDuration: atom<number>(1000),
            selectDuration: atom<number>(3000),
            attackerColor: atom<ColorRepresentation>("rgba(255, 255, 255, 0)"),
            defenderColor: atom<ColorRepresentation>("rgba(255, 100, 100, 0)"),
        },
        cell: {
            membrane: {
                spline: atom<boolean>(false),
                segments: atom<number>(10),
                detalization: atom<number>(50),
                frequency: atom<number>(0.0001),
                skew: atom<number>(Math.PI / 10),
                thorness: atom<number>(0.2),
                wobbling: atom<number>(0.15),
            },
            organell: {
                transitionDuration: atom<number>(1000),
                colors: {
                    color0: atom<ColorRepresentation>("rgba(128, 84, 84, 0)"),
                    color1: atom<ColorRepresentation>("rgba(106, 130, 86, 0)"),
                    color2: atom<ColorRepresentation>("rgba(110, 101, 173, 0)"),
                    color3: atom<ColorRepresentation>("rgba(175, 160, 111, 0)"),
                    color4: atom<ColorRepresentation>("rgba(175, 127, 195, 0)"),
                },
                membrane: {
                    spline: atom<boolean>(false),
                    segments: atom<number>(3),
                    detalization: atom<number>(20),
                    frequency: atom<number>(0.00005),
                    skew: atom<number>(Math.PI / 8),
                    thorness: atom<number>(0.2),
                    wobbling: atom<number>(0.5),
                },
            },
            glowing: atom<number>(0.85),
            radius: atom<number>(100),
            color: atom<ColorRepresentation>("rgba(84,105,125,1.0)"),
        },
        flagellum: {
            color: atom<ColorRepresentation>("rgba(84,105,125,1.0)"),
            segmentLength: atom<number>(50),
            amplitude: atom<number>(100),
            skew: atom<number>(Math.PI),
            wobbling: atom<number>(0.1),
        },
        roundDuration: atom<number>(5_000),
    };
    const membraneLimits = {
        segments: { min: 3, max: 10, step: 1 },
        detalization: { min: 1, max: 100, step: 1 },
        frequency: { min: 0, max: 0.01, step: 0.0001 },
        skew: { min: 0, max: Math.PI, step: 0.001 },
        angularLimit: { min: 0, max: 1, step: 0.01 },
        thorness: { min: 0, max: 1, step: 0.1 },
        wobbling: { min: 0, max: 1, step: 0.01 },
    };
    initializeGui(configuration, {
        light: { intensity: { min: 0, max: 1, step: 0.01 } },
        soup: {
            count: { min: 1, max: 10, step: 1 },
        },
        cell: {
            membrane: membraneLimits,
            radius: { min: 10, max: 200, step: 1 },
            glowing: { min: 0, max: 1, step: 0.01 },
            organell: {
                membrane: membraneLimits,
            },
        },
        flagellum: {
            segmentLength: { min: 2, max: 100, step: 1 },
            amplitude: { min: 1, max: 200, step: 1 },
            skew: { min: 0, max: Math.PI, step: 0.1 },
            wobbling: { min: 0, max: 1, step: 0.05 },
        },
        roundDuration: { min: 1000, max: 100_000, step: 100 },
    });
    return configuration;
}

function initialize() {
    const renderer = new WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true,
        alpha: true,
    });
    const configuration = createConfiguration(renderer.domElement);
    const { scene, camera, tick } = createScene(configuration);

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
