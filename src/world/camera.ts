import { OrthographicCamera } from "three";

export function createCamera(width: number, height: number) {
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    return camera;
}
