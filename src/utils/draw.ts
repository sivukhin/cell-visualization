import { Vector2 } from "three";

export function getComponents(points: Vector2[]): Float32Array {
    const components = new Float32Array(points.length * 3);
    let position = 0;
    for (let point of points) {
        components[position++] = point.x;
        components[position++] = point.y;
        components[position++] = 0;
    }
    return components;
}
