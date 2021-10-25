import * as THREE from "three";

const zero = new THREE.Vector2(0, 0);

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

function interpolate(l: number, r: number, time: number, alpha: number): number {
    const k = time * alpha;
    const d = r - l;
    let delta = k % (2 * d);
    if (delta > d) {
        delta = 2 * d - delta;
    }
    return l + delta;
}

function createMovingCell(n: number, r: number) {
    const polygon = [];
    for (let i = 0; i < n; i++) {
        const angle = 2 * Math.PI / n * i;
        polygon.push(new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r));
    }
    const edges = [];
    const centers = [];
    for (let i = 0; i < n; i++) {
        const edge = new THREE.Vector2().subVectors(polygon[(i + 1) % n], polygon[i]);
        edges.push(edge);
        centers.push(new THREE.Vector2().copy(polygon[i]).addScaledVector(edge, 0.5));
    }

    const limits = [];
    for (let i = 0; i < n; i++) {
        limits.push({
            first: getRandomRange(0, 1),
            second: getRandomRange(0, 1),
        })
    }

    const angular = (Math.random() - 0.5) * 0.001;

    function getPoints(time: number) {
        const path = new THREE.Path();
        path.moveTo(centers[0].x, centers[0].y);
        const cp = [];
        for (let i = 0; i < n; i++) {
            const c1 = centers[i];
            const c2 = centers[(i + 1) % n];

            const e1 = edges[i];
            const e2 = edges[(i + 1) % n];

            const k1 = interpolate(limits[i].first[0], limits[i].first[1], time, 0.001);
            const d1 = new THREE.Vector2().copy(e1).multiplyScalar(k1);
            const k2 = interpolate(limits[i].second[0], limits[i].second[1], time, 0.001);
            const d2 = new THREE.Vector2().copy(e2).negate().multiplyScalar(k2);
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

    const material = new THREE.LineBasicMaterial({ color : 0xff0000 });
    const curveObject = new THREE.Line(geometry, material);
    let t = 0;
    return {
        object: curveObject,
        tick: () => {
            t += 1;
            positionAttribute.set(getPoints(t));
            positionAttribute.needsUpdate = true;
            curveObject.rotateZ(angular);
        }
    }
}

function createScene() {
    const scene = new THREE.Scene();
    const planeGeometry = new THREE.PlaneGeometry(200, 200);
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
    const cell1 = createMovingCell(6, 50)
    cell1.object.position.set(-50, -50, 0);

    const cell2 = createMovingCell(8, 40)
    cell2.object.position.set(50, 50, 0);

    scene.add(cell1.object);
    scene.add(cell2.object);
    const light = createLight(0, 0, 100);
    scene.add(light);
    const camera = createCamera(200, 200);
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById("canvas"),
        antialias: true
    });
    adjust(renderer);

    function render() {
        cell1.tick();
        cell2.tick();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

initialize();
