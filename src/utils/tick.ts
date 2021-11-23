let currentTime = 0;
let currentWorldTime = 0;

let stopAt = null;
let startAt = null;

export function stopTime(start: number, finish: number) {
    stopAt = currentTime + start;
    startAt = currentTime + finish;
}

let paused = false;
export function tick(time: number): [number, boolean] {
    let delta = time - currentTime;
    currentTime = time;
    if (stopAt != null && startAt != null && stopAt < time && time < startAt) {
        if (!paused) {
            currentWorldTime += Math.max(0, delta - (time - stopAt));
            paused = true;
            // @ts-ignore
            document.getElementById("#back").pause();
        }
        return [currentWorldTime, true];
    }
    if (paused) {
        paused = false;
        // @ts-ignore
        document.getElementById("#back").play();
    }
    currentWorldTime += delta;
    return [currentWorldTime, false];
}

interface Ticker {
    tick(time: number): boolean;
}

export function tickAll<T extends Ticker>(tickers: T[], time: number, remove: (t: T) => void): T[] {
    let alive: T[] = [];
    for (const ticker of tickers) {
        if (ticker.tick(time)) {
            alive.push(ticker);
        } else {
            remove(ticker);
        }
    }
    return alive;
}
