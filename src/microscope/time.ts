function pad(number) {
    return number < 10 ? `0${number}` : `${number}`;
}

export function createTime() {
    let lastTime = -Infinity;
    return {
        tick: (time: number) => {
            if (time < lastTime + 100) {
                return;
            }
            const now = new Date();
            document.getElementById("date").textContent = `${pad(now.getUTCDate())}/${pad(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
            document.getElementById("time").textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`;
        },
    };
}
