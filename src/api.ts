export interface Attack {
    service_id: number;
    attacker_id: number;
    victim_id: number;
}

export interface TeamService {
    id: number;
    flags: number;
    sflags: number;
    sla: number;
    fp: number;
    status: number;
    stdout: string;
}

export interface Service {
    name: string;
    active: number;
}

export interface Team {
    n: number;
    name: string;
    host: string;
    d: number;
    score: number;
    old_score: number;
    services: TeamService[];
}

export interface State {
    round: number;
    scoreboard: Team[];
    services: { [key: string]: Service };
}

export type Response = { type: "attack"; value: Attack } | { type: "state"; value: State };

const subscriptions = [];
export function subscribeApi(handler: (r: Response) => void) {
    subscriptions.push(handler);
    return () => {
        const position = subscriptions.indexOf(handler);
        if (position == -1) {
            return;
        }
        subscriptions.splice(position, 1);
    };
}

let active: WebSocket | null = null;

export function updateApiCredentials(url) {
    if (active != null) {
        active.close();
    }
    active = new WebSocket(url);
    active.onmessage = (e) => {
        const data = JSON.parse(e.data);
        for (const subscription of subscriptions) {
            subscription(data);
        }
    };
    active.onerror = (e) => {
        console.error(e);
    };
}
