import {ColorRepresentation, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, Scene} from "three";

export function createEnvironment(width: number, height: number, color: ColorRepresentation) {
    const planeGeometry = new PlaneGeometry(width, height);
    const planeMaterial = new MeshBasicMaterial({
        color: color,
    });
    const planeMesh = new Mesh(planeGeometry, planeMaterial);
    planeMesh.position.set(0, 0, -10);
    return planeMesh;
}
