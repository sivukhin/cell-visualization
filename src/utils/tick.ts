let currentTime = 0;
export const setLastTick = (time: number) => (currentTime = time);
export const lastTick = () => currentTime;
