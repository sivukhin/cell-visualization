import { GUI } from "dat.gui";

interface Lazy<T> {
    get(): T;
    map<U>(selector: (x: T) => U): Lazy<U>;
}

function lazy<T>(factory: () => T): Lazy<T> {
    let element = undefined;
    return {
        get() {
            if (element === undefined) {
                element = factory();
            }
            return element;
        },
        map<U>(selector: (x: T) => U) {
            return lazy(() => selector(this.get()));
        },
    };
}

function hasOwnFunction<X extends {}, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, Function> {
    return obj.hasOwnProperty(prop);
}

function createProxy(get: (obj: any, prop: PropertyKey) => any, set: (obj: any, prop: PropertyKey, value: any) => boolean) {
    return new Proxy(
        {},
        {
            get: get,
            set: set,
        }
    );
}

function traverseObject(data: any, configuration: any, root: any, gui: Lazy<any>) {
    for (const [key, value] of Object.entries(data)) {
        const current = configuration != null ? configuration[key] : undefined;
        if (typeof value === "object" && hasOwnFunction(value, "set") && hasOwnFunction(value, "get")) {
            root[key] = new Proxy(
                { value: value.get() },
                {
                    get: (target, p) => target[p],
                    set: (target, p, v) => {
                        value.set(v);
                        target[p] = v;
                        return true;
                    },
                }
            );
            if (key.includes("color")) {
                gui.get().addColor(root[key], "value").name(key);
            } else {
                const min = current != null ? current.min : undefined;
                const max = current != null ? current.max : undefined;
                const step = current != null ? current.step : undefined;
                gui.get().add(root[key], "value", min, max, step).name(key);
            }
        } else if (typeof value === "object") {
            const child = {};
            root[key] = child;
            traverseObject(
                value,
                current,
                child,
                gui.map((x) => {
                    const folder = x.addFolder(key);
                    folder.open();
                    return folder;
                })
            );
        }
    }
}

export function initializeGui(data: any, configuration?: any) {
    const gui = new GUI();
    const root = {};
    traverseObject(
        data,
        configuration,
        root,
        lazy(() => gui)
    );
    return gui;
}
