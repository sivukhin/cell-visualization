import { Mesh, MeshLambertMaterial, PlaneGeometry, Scene } from "three";

export function createEnvironment(width: number, height: number) {
    const planeGeometry = new PlaneGeometry(width, height);
    const planeMaterial = new MeshLambertMaterial({
        color: 0xffffff,
    });
    const planeMesh = new Mesh(planeGeometry, planeMaterial);
    planeMesh.position.set(0, 0, -10);
    return planeMesh;
}
