import { Vector2 } from "three";
import { randomFrom } from "../utils/math";

const AlarmWidth = 494;
const AlarmHeight = 176;
export function createAlarm(obstables: Vector2[], width: number, height: number, start: number) {
    const root = document.createElementNS("http://www.w3.org/2000/svg", "g");
    root.setAttribute("class", "alarm");
    const rectElement = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectElement.setAttribute("width", `${AlarmWidth}`);
    rectElement.setAttribute("height", `${AlarmHeight}`);
    rectElement.setAttribute("fill", "rgba(169, 42, 39, 0.8)");

    const textElement1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement1.setAttribute("x", "16");
    textElement1.setAttribute("y", "16");
    textElement1.setAttribute("font-size", "70px");
    textElement1.setAttribute("fill", "rgba(255, 90, 73, 1)");
    textElement1.innerHTML = "FIRST BLOOD";
    const textElement2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement2.setAttribute("x", "16");
    textElement2.setAttribute("y", "100");
    textElement2.setAttribute("font-size", "70px");
    textElement2.setAttribute("fill", "rgba(255, 90, 73, 1)");
    textElement2.innerHTML = "DETECTED";

    let best = new Vector2(0, 0);
    let bestDistance = 0;
    for (let i = 0; i < 32; i++) {
        const x = randomFrom(-width / 2 + AlarmWidth / 2, width / 2 - AlarmWidth / 2);
        const y = randomFrom(-height / 2 + AlarmHeight / 2, height / 2 - AlarmHeight / 2);
        const current = new Vector2(x, y);
        let minDistance = 2 * Math.min(Math.min(x + width / 2, width / 2 - x), Math.min(y + height / 2, height / 2 - y));
        for (const obstacle of obstables) {
            minDistance = Math.min(minDistance, obstacle.distanceTo(current));
        }
        if (bestDistance < minDistance) {
            bestDistance = minDistance;
            best = current;
        }
    }
    root.setAttribute("transform", `translate(${best.x - AlarmWidth / 2}, ${best.y - AlarmHeight / 2})`);

    let appended = false;
    return {
        multiverse: root,
        tick: (time: number) => {
            if (time < start) {
                return true;
            }
            if (!appended) {
                root.appendChild(rectElement);
                root.appendChild(textElement1);
                root.appendChild(textElement2);
                appended = true;
            }
        },
    };
}
