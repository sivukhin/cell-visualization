export interface Timings {
    startIn: number;
    finishIn: number;
    startOut: number;
    finishOut: number;
}

export function getRelativeTime({ startIn, startOut, finishIn, finishOut }: Timings, time: number) {
    if (time < finishIn) {
        return (time - startIn) / (finishIn - startIn);
    } else if (time > startOut) {
        return 1 - (time - startOut) / (finishOut - startOut);
    }
    return 1 + (Math.min(time - finishIn, startOut - time) / (startOut - finishIn)) * 2;
}
