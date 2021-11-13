import { atom } from "nanostores";
import { ColorRepresentation, Vector2, WebGLRenderer } from "three";
import { WorldConfiguration } from "./configuration";
import { createScene } from "./world/scene";
import { initializeGui } from "./utils/knobs";
import Stats from "stats.js";
import "./time";
import { rollXY } from "./microscope/ruler";
import { convexHull } from "./utils/geometry";

function adjust(renderer, composers) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    for (const composer of composers) {
        composer.setSize(width, height);
    }
}

function createConfiguration(canvas): WorldConfiguration {
    const configuration: WorldConfiguration = {
        light: {
            color: atom<ColorRepresentation>("rgb(43, 50, 71)"),
            intensity: atom<number>(1),
        },
        soup: {
            count: atom<number>(30),
            width: canvas.clientWidth,
            height: canvas.clientHeight,
        },
        target: {
            appearDuration: atom<number>(1000),
            selectDuration: atom<number>(3000),
            attackerColor: atom<ColorRepresentation>("rgb(255, 255, 255)"),
            defenderColor: atom<ColorRepresentation>("rgb(255, 100, 100)"),
        },
        cell: {
            segments: atom<number>(10),
            membrane: {
                spline: atom<boolean>(false),
                detalization: atom<number>(50),
                frequency: atom<number>(0.0001),
                skew: atom<number>(Math.PI / 10),
                thorness: atom<number>(0.2),
                wobbling: atom<number>(0.15),
                transitionDuration: atom<number>(5000),
            },
            organell: {
                transitionDuration: atom<number>(5000),
                colors: {
                    color0: atom<ColorRepresentation>("rgb(128, 84, 84)"),
                    color1: atom<ColorRepresentation>("rgb(106, 130, 86)"),
                    color2: atom<ColorRepresentation>("rgb(110, 101, 173)"),
                    color3: atom<ColorRepresentation>("rgb(175, 160, 111)"),
                    color4: atom<ColorRepresentation>("rgb(175, 127, 195)"),
                },
                membrane: {
                    spline: atom<boolean>(false),
                    detalization: atom<number>(20),
                    frequency: atom<number>(0.00005),
                    skew: atom<number>(Math.PI / 8),
                    thorness: atom<number>(0.2),
                    wobbling: atom<number>(0.5),
                    transitionDuration: atom<number>(5000),
                },
            },
            glowing: atom<number>(0.85),
            radius: atom<number>(70),
            color: atom<ColorRepresentation>("rgb(84, 105, 125)"),
        },
        flagellum: {
            color: atom<ColorRepresentation>("rgb(84, 105, 125)"),
            segmentLength: atom<number>(50),
            amplitude: atom<number>(100),
            skew: atom<number>(Math.PI),
            wobbling: atom<number>(0.1),
        },
        speed: atom<number>(0.1),
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
            count: { min: 1, max: 40, step: 1 },
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
        speed: { min: 0, max: 10, step: 0.01 },
        roundDuration: { min: 1000, max: 100_000, step: 100 },
    });
    return configuration;
}

let scene = null;
function initialize() {
    const renderer = new WebGLRenderer({
        canvas: document.getElementById("microcosmos"),
        antialias: true,
        alpha: true,
    });
    const configuration = createConfiguration(renderer.domElement);
    scene = createScene(configuration, renderer);

    adjust(renderer, [scene.microcosmosComposer, scene.microscopeComposer]);

    const stats = Stats();

    function render(time: number) {
        stats.begin();
        scene.tick(time);
        scene.microcosmosComposer.render();
        scene.microscopeComposer.render();
        stats.end();
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}

initialize();

let dragging = false;
let start = [0, 0];
document.body.addEventListener("mousedown", (ev) => {
    dragging = true;
    start = [ev.clientX, ev.clientY];
});
document.body.addEventListener("mouseup", (ev) => {
    dragging = false;
});
document.body.addEventListener("mousemove", (ev) => {
    if (dragging) {
        const delta = [-ev.movementX, ev.movementY];
        scene.camera.move(delta[0], delta[1]);
        rollXY(delta[0], delta[1]);
    }
});
document.body.addEventListener("wheel", (ev) => {
    scene.camera.zoom(-ev.deltaY);
    const magnifications = document.getElementsByClassName("magnification");
    for (let i = 0; i < magnifications.length; i++) {
        magnifications[i].textContent = `${Math.round(25 * scene.camera.magnification())}`;
    }
});
