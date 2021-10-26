import * as THREE from "three";
import {Vector2, Vector3} from "three";

const zero2 = new THREE.Vector2(0, 0);
const zero3 = new THREE.Vector3(0, 0, 0);

function adjust(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
}

function getRandomRange(l: number, r: number): [number, number] {
    const a = Math.random() * (r - l) + l;
    const b = Math.random() * (r - l) + l;
    return a < b ? [a, b] : [b, a];
}

function generate(l: number, r: number) {
    return Math.random() * (r - l) + l;
}

function interpolate(l: number, r: number, time: number, alpha: number): number {
    const k = time * alpha;
    const d = r - l;
    let delta = k % Math.abs(2 * d);
    if (delta > Math.abs(d)) {
        delta = Math.abs(2 * d) - delta;
    }
    return l + (d < 0 ? -1 : +1) * delta;
}

function getCircle(n: number, r: number) {
    const points = [];
    for (let i = 0; i < n; i++) {
        const angle = 2 * Math.PI / n * i;
        points.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    return points;
}

function generateCircles(n: number, r: number): Array<[Vector2, number]> {
    const positions = [];
    for (let i = 0; i < n; i++) {
        const angle = 2 * Math.PI / n * i + (0.5 - Math.random()) * 0.01;
        const radius = r / 2;
        const v = new THREE.Vector2(radius, 0).rotateAround(zero2, angle);
        positions.push(v);
    }
    const radiuses = [];
    for (let i = 0; i < n; i++) {
        let maxR = r - positions[i].length();
        for (let s = 0; s < i; s++) {
            maxR = Math.min(maxR, positions[i].distanceTo(positions[s]) - radiuses[s]);
        }
        for (let s = i + 1; s < n; s++) {
            maxR = Math.min(maxR, positions[i].distanceTo(positions[s]));
        }
        radiuses.push(0.4 * (1 + Math.random()) * maxR);
    }
    const result = [];
    for (let i = 0; i < n; i++) {
        result.push([positions[i], radiuses[i]]);
    }
    return result;
}

function getH(p: Vector2, a: Vector2, v: Vector2): Vector2 {
    const k = new THREE.Vector2().subVectors(p, a).dot(v);
    return new THREE.Vector2().copy(v).multiplyScalar(k / v.lengthSq()).add(a);
}

function tryIntersectLineCircle(p: Vector2, v: Vector2, c: Vector2, r: number): Vector2 | null {
    const h = getH(c, p, v);
    const d = h.distanceToSquared(c);
    if (d > r * r) {
        return null;
    }
    const l = Math.sqrt(r * r - d) / v.length();
    const a = new THREE.Vector2().copy(h).addScaledVector(v, l);
    const b = new THREE.Vector2().copy(h).addScaledVector(v, -l);
    return new THREE.Vector2().subVectors(a, p).dot(v) > 0 ? a : b;
}

function createAliveMembrane(n: number, r: number, dr: number, debug: boolean = false) {
    const polygon = getCircle(n, r / Math.cos(Math.PI / n));

    const edges = [];
    const centers = [];
    for (let i = 0; i < n; i++) {
        const edge = new THREE.Vector2().subVectors(polygon[(i + 1) % n], polygon[i]);
        edges.push(edge);
        centers.push(new THREE.Vector2().copy(polygon[i]).addScaledVector(edge, 0.5));
    }

    const limits = [];
    let sign = 1;
    for (let i = 0; i < n; i++) {
        const angle = (1 + Math.random()) * Math.PI / 6;
        const intersectionOuter = tryIntersectLineCircle(centers[i], new THREE.Vector2().copy(edges[i]).rotateAround(zero2, -angle), zero2, r + dr);
        const intersectionInner = tryIntersectLineCircle(centers[i], new THREE.Vector2().copy(edges[i]).rotateAround(zero2, angle), zero2, r - dr);
        if (intersectionOuter == null && intersectionInner == null) {
            throw new Error("invalid operation");
        }
        const outer = intersectionOuter == null ? Infinity : intersectionOuter.distanceTo(centers[i]);
        const inner = intersectionInner == null ? Infinity : intersectionInner.distanceTo(centers[i]);
        limits.push({
            angle: sign * angle,
            length: Math.min(outer, inner, edges[i].length() / 2),
        })
        sign = -sign;
    }

    const angular = (1 + Math.random()) * 0.01 / r;

    function getPoints(time: number) {
        const path = new THREE.Path();
        path.moveTo(centers[0].x, centers[0].y);
        const cp = [];
        for (let i = 0; i < n; i++) {
            const c1 = centers[i];
            const c2 = centers[(i + 1) % n];

            const e1 = edges[i];
            const e2 = edges[(i + 1) % n];

            const a1 = interpolate(-limits[i].angle, limits[i].angle, time, 0.01 * Math.pow(limits[i].length, 1/2));
            const d1 = new THREE.Vector2().copy(e1).rotateAround(zero2, -a1).setLength(limits[i].length);
            const a2 = interpolate(-limits[(i + 1) % n].angle, limits[(i + 1) % n].angle, time, 0.01 * Math.pow(limits[(i + 1) % n].length, 1/2));
            const d2 = new THREE.Vector2().copy(e2).negate().rotateAround(zero2, -a2).setLength(limits[(i + 1) % n].length);
            cp.push({
                first: d1.add(c1),
                second: d2.add(c2)
            })
        }
        for (let i = 0; i < n; i++) {
            path.bezierCurveTo(cp[i].first.x, cp[i].first.y, cp[i].second.x, cp[i].second.y, centers[(i + 1) % n].x, centers[(i + 1) % n].y);
        }
        const points = path.getPoints(50);
        const components = new Float32Array(points.length * 3);
        let position = 0;
        for (let point of points) {
            components[position++] = point.x;
            components[position++] = point.y;
            components[position++] = 0;
        }
        return components;
    }

    const positionAttribute = new THREE.BufferAttribute(getPoints(0), 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', positionAttribute);

    const material = new THREE.LineBasicMaterial({ color : 'rgba(141, 177, 185, 0.5)' });
    const curve = new THREE.Line(geometry, material);

    if (false) {
        const outerCircle = getCircle(32, r + dr);
        curve.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([...outerCircle, outerCircle[0]]),
            new THREE.LineBasicMaterial({ color : 'rgba(100, 100, 100)' })
        ));
        const innerCircle = getCircle(32, r - dr);
        curve.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([...innerCircle, innerCircle[0]]),
            new THREE.LineBasicMaterial({ color : 'rgba(100, 100, 100)' })
        ));
        curve.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([...polygon, polygon[0]]),
            new THREE.LineBasicMaterial({ color : 'rgba(100, 100, 100)' })
        ));
    }

    let t = 0;
    return {
        maxR: r + dr,
        minR: r - dr,
        object: curve,
        tick: () => {
            t += 1;
            positionAttribute.set(getPoints(t));
            positionAttribute.needsUpdate = true;
            curve.rotateZ(angular);
        }
    }
}

function createAliveCell(n: number, r: number, organellsCount: number, debug: boolean = false) {
    const root = new THREE.Object3D();
    const membrane = createAliveMembrane(n, r, 0.3 * r, debug);
    const organells = [];
    const circles = generateCircles(organellsCount, (membrane.minR + membrane.maxR) / 2);
    for (let i = 0; i < organellsCount; i++) {
        const or = circles[i][1];
        const current = createAliveMembrane(Math.floor((1 + Math.random()) * 3), or, 0.3 * or, debug);
        current.object.position.set(circles[i][0].x, circles[i][0].y, 0);
        organells.push(current);
        membrane.object.add(current.object);
    }
    root.add(membrane.object);
    return {
        r: r + 0.1 * r,
        object: root,
        tick: () => {
            membrane.tick();
            for (let i = 0; i < organells.length; i++) {
                organells[i].tick();
            }
        }
    }
}

function createCells(n: number, debug: boolean) {
    const root = new THREE.Object3D();
    const cells = [];
    const velocities = [];
    const angular = [];
    const circles = generateCircles(n, 100);
    for (let i = 0; i < n; i++) {
        const cell = createAliveCell(Math.floor((1 + Math.random()) * 4), circles[i][1], Math.floor((1 + Math.random()) * 3), debug);
        cell.object.position.set(circles[i][0].x, circles[i][0].y, 0);
        cells.push(cell);
        velocities.push(new THREE.Vector2(generate(-0.5, 0.5), generate(-0.5, 0.5)));
        angular.push(0);
    }
    for (let i = 0; i < n; i++) {
        root.add(cells[i].object);
    }
    return {
        object: root,
        tick: () => {
            for (let i = 0; i < n; i++) {
                velocities[i].rotateAround(zero2, angular[i]);
                angular[i] += (0.5 - Math.random()) * 0.1;
                angular[i] = Math.min(-0.01, Math.max(0.01, angular[i]));
            }
            for (let i = 0; i < n; i++) {
                cells[i].tick();
                cells[i].object.translateX(velocities[i].x);
                cells[i].object.translateY(velocities[i].y);
                if (cells[i].object.position.x - cells[i].r < -100) {
                    velocities[i].x = Math.abs(velocities[i].x);
                }
                if (cells[i].object.position.x + cells[i].r > 100) {
                    velocities[i].x = -Math.abs(velocities[i].x);
                }
                if (cells[i].object.position.y - cells[i].r < -100) {
                    velocities[i].y = Math.abs(velocities[i].y);
                }
                if (cells[i].object.position.y + cells[i].r > 100) {
                    velocities[i].y = -Math.abs(velocities[i].y);
                }
            }
            for (let i = 0; i < n; i++) {
                for (let s = i + 1; s < n; s++) {
                    if (cells[i].r + cells[s].r < cells[i].object.position.distanceTo(cells[s].object.position)) {
                        continue;
                    }
                    const tmp = velocities[i];
                    velocities[i] = velocities[s];
                    velocities[s] = tmp;
                }
            }
        }
    }
}

function createScene() {
    const scene = new THREE.Scene();
    const planeGeometry = new THREE.PlaneGeometry(300, 300);
    const planeMaterial = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide} );
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.position.set(0, 0, -10);
    scene.add(planeMesh);
    return scene;
}

function createCamera(width: number, height: number) {
    const camera = new THREE.OrthographicCamera(-width / 2,width / 2,height / 2,-height /2);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0)
    return camera;
}

function createLight(x: number, y: number, z: number) {
    const light = new THREE.AmbientLight("#fff", 1);
    light.position.set(x, y, z);
    light.lookAt(0, 0, 0);
    return light;
}

function initialize() {
    const scene = createScene();
    const cell = createCells(5, false);
    scene.add(cell.object);
    // const membrane3 = createAliveMembrane(3, 40, 10, false);
    // scene.add(membrane3.object);
    // membrane3.object.position.set(-90, -50, 0);
    // const membrane4 = createAliveMembrane(4, 40, 10, false);
    // scene.add(membrane4.object);
    // membrane4.object.position.set(0, -50, 0);
    // const membrane5 = createAliveMembrane(5, 40, 10, false);
    // scene.add(membrane5.object);
    // membrane5.object.position.set(90, -50, 0);
    //
    // const membrane6 = createAliveMembrane(6, 40, 10, false);
    // scene.add(membrane6.object);
    // membrane6.object.position.set(-90, 50, 0);
    // const membrane7 = createAliveMembrane(7, 40, 10, false);
    // scene.add(membrane7.object);
    // membrane7.object.position.set(0, 50, 0);
    // const membrane8 = createAliveMembrane(8, 40, 10, false);
    // scene.add(membrane8.object);
    // membrane8.object.position.set(90, 50, 0);

    const light = createLight(0, 0, 100);
    scene.add(light);
    const camera = createCamera(300, 300);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true
    });
    adjust(renderer);

    let t = 0;
    function render() {
        cell.tick();
        // membrane3.tick();
        // membrane4.tick();
        // membrane5.tick();
        // membrane6.tick();
        // membrane7.tick();
        // membrane8.tick();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

initialize();
