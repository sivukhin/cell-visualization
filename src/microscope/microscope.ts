import { createTime } from "./time";
import { ColorRepresentation, Vector2 } from "three";
import { createTarget } from "./target";
import { createRuler } from "./ruler";
import { tickAll } from "../utils/tick";

export function createMicroscope() {
    const display = document.getElementById("display");
    const dateTime = createTime();
    const ruler = createRuler();
    const targets = [];
    return {
        tick: (time: number) => {
            dateTime.tick(time);
            for (const target of targets) {
                target.tick(time);
            }
        },
        rollXY: (x: number, y: number) => {
            ruler.rollXY(x, y);
        },
        setServices: (services: Array<{ name: string; color: ColorRepresentation }>) => {
            const legend = document.getElementById("legend");
            const content = [];
            for (const service of services) {
                content.push(`<span class="service"><span style="color: ${service.color}">▌</span><span>${service.name}</span></span>`);
            }
            legend.innerHTML = content.join("");
        },
        setMode: (mode: "live" | "attention") => {
            if (mode == "live") {
                document.getElementById("status").textContent = "LIVE";
                document.getElementById("status").setAttribute("style", "background: white;");
                document.getElementById("microscope").setAttribute("style", "color: white;");
                ruler.setColor("white");
            } else {
                document.getElementById("status").textContent = "ATTENTION";
                document.getElementById("status").setAttribute("style", "background: #FF5A49;");
                document.getElementById("microscope").setAttribute("style", "color: #FF5A49;");
                ruler.setColor("#FF5A49");
            }
        },
        addTarget: (follow: () => Vector2, size: number, color: string, bottom: string, top: string, start: number) => {
            const target = createTarget({
                follow: follow,
                size: size,
                color: color,
                bottom: bottom,
                top: top,
                start: start,
            });
            targets.push(target);
            display.appendChild(target.multiverse);
        },
    };
}
