export function createTerminal() {
    const buffer = [];
    let current = null;
    let startTime = 0;
    let lineId = 0;
    const terminal = document.getElementById("terminal");
    return {
        tick: (time: number) => {
            if (current == null && buffer.length > 0) {
                current = buffer[0];
                lineId++;
                startTime = time;
                buffer.splice(0, 1);
            }
            if (current != null) {
                let input = document.getElementById(`input-${lineId}`);
                let output = document.getElementById(`output-${lineId}`);
                if (input == null || output == null) {
                    if (terminal.childElementCount == 10) {
                        terminal.removeChild(terminal.childNodes[0]);
                        terminal.removeChild(terminal.childNodes[0]);
                    }
                    const inputElement = document.createElement("div");
                    const outputElement = document.createElement("div");
                    inputElement.setAttribute("id", `input-${lineId}`);
                    outputElement.setAttribute("id", `output-${lineId}`);
                    // outputElement.setAttribute("style", "color: gray");
                    terminal.appendChild(inputElement);
                    terminal.appendChild(outputElement);
                    input = inputElement;
                    output = outputElement;
                }
                const prefix = current[0].slice(0, Math.floor(current[0].length * Math.min(1.0, (time - startTime) / 500)));
                input.innerHTML = `$> ${prefix}`;
                if (time > startTime + 1000) {
                    output.innerHTML = `&nbsp;&nbsp;&nbsp;${current[1]}`;
                    current = null;
                }
            }
        },
        sendCommand: (input: string, output: string) => {
            buffer.push([input, output]);
        },
    };
}
