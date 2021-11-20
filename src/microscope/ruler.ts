import { ColorRepresentation } from "three";

let offsetX = 0;
let offsetY = 0;
let color: ColorRepresentation = "white";

function drawRuler(ruler, offset) {
    ruler.width = ruler.clientWidth;
    ruler.height = ruler.clientHeight;
    const context = ruler.getContext("2d");
    context.clearRect(0, 0, ruler.width, ruler.height);
    context.beginPath();
    context.strokeStyle = color;
    let position = offset % 16;
    let id = Math.floor(-offset / 16) % 5;
    while (position < Math.max(ruler.height, ruler.width)) {
        let shift = id % 5 === 2 ? 0 : 6;
        if (ruler.height > ruler.width) {
            context.moveTo(shift, position);
            context.lineTo(16 - shift, position);
        } else {
            context.moveTo(position, shift);
            context.lineTo(position, 16 - shift);
        }
        position += 16;
        id += 1;
    }
    context.stroke();
}

function drawRulers() {
    const rulers = document.getElementsByClassName("ruler");
    for (let i = 0; i < rulers.length; i++) {
        drawRuler(rulers[i], rulers[i].clientWidth > rulers[i].clientHeight ? offsetX : offsetY);
    }
}

export function createRuler() {
    drawRulers();
    return {
        rollXY: (x: number, y: number) => {
            offsetX += x;
            offsetY += y;
            drawRulers();
        },
        setColor: (c: ColorRepresentation) => {
            color = c;
            drawRulers();
        },
    };
}
