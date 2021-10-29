import { AmbientLight } from "three";
import { LightConfiguration, Unwrap } from "../configuration";

export function createLight(x: number, y: number, z: number, configuration: Unwrap<LightConfiguration>) {
    const light = new AmbientLight(configuration.color, configuration.intensity);
    light.position.set(x, y, z);
    light.lookAt(0, 0, 0);
    return light;
}
