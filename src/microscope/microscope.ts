import { createTime } from "./time";
import { ColorRepresentation, Vector2 } from "three";
import { createTarget } from "./target";
import { createRuler } from "./ruler";
import { createAlarm } from "./alarm";
import { Unwrap, WorldConfiguration } from "../configuration";
import { MicroscopeElement, Stats } from "../world/types";
import { createDetails, Details } from "./details";
import { tickAll } from "../utils/tick";

export function createMicroscope(world: Unwrap<WorldConfiguration>): MicroscopeElement {
    const display = document.getElementById("display");
    const dateTime = createTime();
    const ruler = createRuler();
    const targets = [];
    let details = [];
    let alarms = [];
    return {
        tick: (time: number) => {
            dateTime.tick(time);
            for (const target of targets) {
                target.tick(time);
            }
            for (const alarm of alarms) {
                alarm.tick(time);
            }
            details = tickAll(details, time, () => {});
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
        setStats(stats: Stats) {
            document.getElementById("round").innerText = `${stats.round}`;
            document.getElementById("attacks").innerText = `${stats.attacks}`;
            document.getElementById("bleeding").innerText = `${stats.bleeding}`;
            document.getElementById("stolen").innerText = `${stats.stolen}`;
            document.getElementById("alive").innerText = `${stats.alive}`;
            document.getElementById("stat-enabled").innerText = `${stats.stat ? "●" : "◯"}`;
            document.getElementById("action-enabled").innerText = `${stats.action ? "●" : "◯"}`;
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
        addAlarm: (start: number) => {
            const alarm = createAlarm(
                targets.map((x) => x.position()),
                world.soup.width,
                world.soup.height,
                start
            );
            alarms.push(alarm);
            display.appendChild(alarm.multiverse);
            return () => {
                alarms.splice(alarms.indexOf(alarm), 1);
                display.removeChild(alarm.multiverse);
            };
        },
        addTarget: (follow: () => Vector2, size: () => number, color: string, bottom: string, top: string, start: number) => {
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
            return () => {
                display.removeChild(target.multiverse);
                targets.splice(targets.indexOf(target), 1);
            };
        },
        addDetails(config: Details) {
            const element = createDetails(config);
            details.push(element);
        },
    };
}
