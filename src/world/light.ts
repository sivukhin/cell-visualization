import { AmbientLight } from "three";
import { LightConfiguration } from "./configuration";

export function createLight(x: number, y: number, z: number, configuration: LightConfiguration) {
    const light = new AmbientLight(configuration.color.get(), configuration.intensity.get());
    light.position.set(x, y, z);
    light.lookAt(0, 0, 0);
    configuration.color.listen((c) => {
        light.color.set(c);
    });
    configuration.intensity.listen((i) => {
        light.intensity = i;
    });
    return light;
}
