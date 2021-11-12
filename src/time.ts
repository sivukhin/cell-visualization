function pad(number) {
    return number < 10 ? `0${number}` : `${number}`;
}

function updateTime() {
    const now = new Date();
    document.getElementById("date").textContent = `${pad(now.getUTCDay())}/${pad(now.getUTCMonth())}/${now.getUTCFullYear()}`;
    document.getElementById("time").textContent = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`;
}

setInterval(updateTime, 1000);
