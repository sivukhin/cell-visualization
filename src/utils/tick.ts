let currentTime = 0;
export const setLastTick = (time: number) => (currentTime = time);
export const lastTick = () => currentTime;

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
