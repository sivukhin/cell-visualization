import { Vector2 } from "three";
import { randomFrom } from "../utils/math";

const AlarmWidth = 494;
const AlarmHeight = 176;
export function createAlarm(service: number, obstables: Vector2[], width: number, height: number, start: number) {
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

    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const obstacle of obstables) {
        minX = Math.min(minX, obstacle.x);
        minY = Math.min(minY, obstacle.y);
        maxX = Math.max(maxX, obstacle.x);
        maxY = Math.max(maxY, obstacle.y);
    }
    const centers = [
        new Vector2((minX + maxX) / 2, (minY + maxY) / 2),
        new Vector2(minX - 150 - AlarmWidth / 2, (minY + maxY) / 2),
        new Vector2(maxX + 150 + AlarmWidth / 2, (minY + maxY) / 2),
        new Vector2((minX + maxX) / 2, minY - 150 - AlarmHeight / 2),
        new Vector2((minX + maxX) / 2, maxY + 150 + AlarmWidth / 2),
    ];
    let bestDistance = -Infinity;
    let best = null;
    for (const center of centers) {
        let current = Math.min(center.x - AlarmWidth / 2 + width / 2, width / 2 - (center.x + AlarmWidth / 2), center.y - AlarmHeight / 2 + height / 2, height / 2 - (center.y + AlarmHeight / 2));
        for (const obstacle of obstables) {
            current = Math.min(current, Math.abs(obstacle.x - (center.x - AlarmWidth / 2)), Math.abs(obstacle.x - (center.x + AlarmWidth / 2)));
            current = Math.min(current, Math.abs(obstacle.y - (center.y - AlarmHeight / 2)), Math.abs(obstacle.y - (center.y + AlarmHeight / 2)));
        }
        if (current > bestDistance) {
            bestDistance = current;
            best = center;
        }
    }
    root.setAttribute("transform", `translate(${best.x - AlarmWidth / 2}, ${-(best.y + AlarmHeight / 2)})`);

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
                const element = document.getElementById(`service-${service}`);
                if (element != null) {
                    element.classList.add("alarm");
                }
                appended = true;
            }
        },
    };
}
