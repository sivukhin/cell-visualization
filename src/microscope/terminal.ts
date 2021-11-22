export function createTerminal() {
    let buffer = [];
    let current = null;
    let startTime = 0;
    let lineId = 0;
    const terminal = document.getElementById("terminal");
    return {
        tick: (time: number) => {
            buffer = buffer.filter((x) => x[0] > time - 5000);
            if (buffer.length > 0 && buffer[0][0] > time) {
                return;
            }
            if (current == null && buffer.length > 0) {
                current = buffer[0][1];
                lineId++;
                startTime = time;
                buffer.splice(0, 1);
            }
            if (current != null) {
                let input = document.getElementById(`input-${lineId}`);
                if (input == null) {
                    if (terminal.childElementCount == 10) {
                        terminal.removeChild(terminal.childNodes[0]);
                    }
                    const inputElement = document.createElement("div");
                    inputElement.setAttribute("id", `input-${lineId}`);
                    // outputElement.setAttribute("style", "color: gray");
                    terminal.appendChild(inputElement);
                    input = inputElement;
                }
                const prefix = current.slice(0, Math.floor(current.length * Math.min(1.0, (time - startTime) / 500)));
                input.innerHTML = `${prefix}`;
                if (time > startTime + 500) {
                    current = null;
                }
            }
        },
        sendCommand: (time: number, input: string) => {
            buffer.push([time, input]);
            buffer.sort((a, b) => a[0] - b[0]);
            if (buffer.length > 100) {
                buffer.splice(0, buffer.length - 100);
            }
        },
    };
}
