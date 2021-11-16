import { OrthographicCamera, Vector3 } from "three";
import { to2 } from "../utils/draw";

export function createCamera(width: number, height: number) {
    let zoom = 1;
    const camera = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);
    const align = () => {
        camera.position.x = Math.min(width / 2 - camera.right, Math.max(-camera.left - width / 2, camera.position.x));
        camera.position.y = Math.min(height / 2 - camera.top, Math.max(-camera.bottom - height / 2, camera.position.y));
    };
    return {
        camera,
        magnification: () => zoom,
        position: () => to2(camera.position),
        zoom: (magnification: number) => {
            zoom = Math.max(1, Math.min(4, zoom + magnification * 0.001));
            camera.left = -width / 2 / zoom;
            camera.right = width / 2 / zoom;
            camera.top = height / 2 / zoom;
            camera.bottom = -height / 2 / zoom;
            camera.updateProjectionMatrix();
            align();
        },
        move: (dx: number, dy: number) => {
            camera.position.add(new Vector3(dx, dy, 0));
            align();
        },
    };
}
