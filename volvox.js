function hslToRgb(h, s, l)  {
    let r, g, b;
    if(s === 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function drawCircle(context, center, r) {
    context.beginPath();
    context.arc(center[0], center[1], r, 0, Math.PI * 2, true);
    context.stroke();
    context.closePath();
}

function drawBlurredCircle(context, center, radius) {
    context.beginPath();
    const [r, g, b] = hslToRgb(0.25, 0.5, Math.max(0.5, 1 - 10 / (radius * radius)));
    context.fillStyle = `rgb(${r}, ${g}, ${b}, ${Math.min(1, 1 / radius)})`;
    context.arc(center[0], center[1], radius, 0, Math.PI * 2, true);
    context.fill();
    context.closePath();
}

function drawParticle(context, center, size) {
    const z = center[2];
    if (Math.abs(z) > 64) {
        return;
    }
    const scale = Math.exp(Math.abs(z) / 32);
    drawBlurredCircle(context, [center[0], center[1]], size * scale);
}

function generate(bound) {
    return (Math.random() - 0.5) * 2 * bound;
}

function random(lower, upper) {
    return Math.random() * (upper - lower) + lower;
}

function addVector(v, u) {
    return [v[0] + u[0], v[1] + u[1], v[2] + u[2]];
}

function subVector(v, u) {
    return [v[0] - u[0], v[1] - u[1], v[2] - u[2]];
}

function dotProduct(v, u) {
    return v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
}

function multVector(v, k) {
    return [v[0] * k, v[1] * k, v[2] * k];
}

function lengthVector(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function lengthVectorSqr(v) {
    return v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
}

function normalizeVector(v) {
    return multVector(v, 1 / lengthVector(v));
}

function projectToVector(v, u) {
    const projection = multVector(u, dotProduct(v, u) / lengthVectorSqr(u));
    const ort = subVector(v, projection);
    return [projection, ort];
}

function rotateAroundVector(v, u, angle) {
    const [projection, ort] = projectToVector(v, u);
    return addVector(projection, rotateVector(ort, angle));
}

function createSphere(center, r) {
    return {center: center, radius: r, angles: [0, 0, 0]};
}

function intersectedSpheres(a, b) {
    const distance = lengthVector(subVector(a.center, b.center));
    return distance <= a.radius + b.radius && distance >= Math.abs(a.radius - b.radius);
}

function buildMembranePart(sphere, membrane, a, b, c, depth) {
    if (depth === 0) {
        return;
    }
    const va = multVector(a, random(0.3, 1));
    const vb = multVector(b, random(0.3, 1));
    const vc = multVector(c, random(0.3, 1));
    const direction = addVector(va, addVector(vb, vc));
    const center = multVector(direction, 1 / lengthVector(direction) * sphere.radius);
    membrane.push(center);
    buildMembranePart(sphere, membrane, a, b, center, depth - 1);
    buildMembranePart(sphere, membrane, a, c, center, depth - 1);
    buildMembranePart(sphere, membrane, b, c, center, depth - 1);
}

function buildMembrane(sphere) {
    const A = [sphere.radius, 0, 0];
    const B = [0, sphere.radius, 0];
    const C = [0, 0, sphere.radius];
    const D = [-sphere.radius, 0, 0];
    const E = [0, -sphere.radius, 0];
    const F = [0, 0, -sphere.radius];
    const anchors = [A, B, C, D, E, F];
    const membrane = [];
    for (let mask = 0; mask < 8; mask++) {
        const pivots = [];
        for (let a = 0; a < 3; a++) {
            if ((mask & (1 << a)) > 0) {
                pivots.push(anchors[a + 3]);
            } else {
                pivots.push(anchors[a]);
            }
        }
        buildMembranePart(sphere, membrane, pivots[0], pivots[1], pivots[2], 5);
    }
    return membrane;
}

function createSphereWithMembrane(center, r) {
    const sphere = createSphere(center, r);
    return {...sphere, membrane: buildMembrane(sphere)};
}

function createVolvox(center, primaryR, secondaryR) {
    const primary = createSphereWithMembrane(center, primaryR);
    const secondary = [];
    for (let i = 0; i < 2; i++) {
        const r = secondaryR * (1 + Math.random());
        const bound = primaryR - r;
        const current = [generate(bound), generate(bound), generate(bound)];
        secondary.push(createSphereWithMembrane(addVector(center, current), r));
    }
    return [primary, ...secondary];
}

function drawVolvox(context, volvox) {
    let membranes = [];
    for (let i = volvox.length - 1; i >= 0; i--) {
        for (let s = 0; s < volvox[i].membrane.length; s++) {
            const angles = volvox[i].angles;
            const v = volvox[i].membrane[s];
            const v1 = [Math.cos(angles[2]) * v[0] - Math.sin(angles[2]) * v[1], Math.sin(angles[2]) * v[0] + Math.cos(angles[2]) * v[1], v[2]];
            const v2 = [Math.cos(angles[1]) * v1[0] - Math.sin(angles[1]) * v1[2], v1[1], Math.sin(angles[1]) * v1[0] + Math.cos(angles[1]) * v1[2]];
            const v3 = [v2[0], Math.cos(angles[0]) * v2[1] - Math.sin(angles[0]) * v2[2], Math.sin(angles[0]) * v2[1] + Math.cos(angles[2]) * v2[2]];
            membranes.push({particle: addVector(volvox[i].center, v3), id: i});
        }
    }
    membranes.sort((a, b) => a.particle[2] - b.particle[2]);
    for (let i = 0; i < membranes.length; i++) {
        drawParticle(context, membranes[i].particle, membranes[i].id === 0 ? 1 : 0.2);
    }
}

const volvox = createVolvox([200, 200, 0], 100, 20);
const velocities = [];
const angular = [];
for (let i = 0; i < volvox.length; i++) {
    const [vBound, aBound] = (i === 0 ? [0.05, 0.005] : [0.2, 0.01]);
    velocities[i] = [generate(vBound), generate(vBound), generate(vBound)];
    angular[i] = [generate(aBound), generate(aBound), generate(aBound)];
}

function animate(context) {
    context.clearRect(0, 0, 1000, 1000);
    for (let i = 0; i < volvox.length; i++) {
        volvox[i].center = addVector(volvox[i].center, velocities[i]);
        volvox[i].angles = addVector(volvox[i].angles, angular[i]);
    }
    for (let i = 0; i < volvox.length; i++) {
        for (let s = i + 1; s < volvox.length; s++) {
            if (!intersectedSpheres(volvox[i], volvox[s])) {
                continue;
            }
            const v = subVector(volvox[s].center, volvox[i].center);
            const [vProject, vOrt] = projectToVector(velocities[i], v);
            const [uProject, uOrt] = projectToVector(velocities[s], subVector([0, 0, 0], v));
            velocities[i] = addVector(uProject, vOrt);
            velocities[s] = addVector(vProject, uOrt);
        }
    }
    drawVolvox(context, volvox);
}

const context = document.getElementById("canvas").getContext("2d");
// animate(context, 1000 / 50);
setInterval(() => animate(context), 1000 / 50);
