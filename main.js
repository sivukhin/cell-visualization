function drawLine(context, a, b) {
  context.beginPath();
  context.moveTo(a[0], a[1]);
  context.lineTo(b[0], b[1]);
  context.stroke();
  context.closePath();
}

function drawPolygon(context, polygon) {
  const n = polygon.length;
  context.beginPath();

  const start = multVector(addVector(polygon[0], polygon[1 % n]), 0.5);
  context.moveTo(start[0], start[1]);
  for (let i = 1; i <= n; i++) {
    const b = multVector(addVector(polygon[i % n], polygon[(i + 1) % n]), 0.5);
    context.bezierCurveTo(polygon[i % n][0], polygon[i % n][1], polygon[i % n][0], polygon[i % n][1], b[0], b[1]);
  }
  context.stroke();
  context.closePath();
}

function drawCircle(context, center, r) {
  context.beginPath();
  context.arc(center[0], center[1], r, 0, Math.PI * 2, true);
  context.stroke();
  context.closePath();
}

function createRegularPolygon(n, r) {
  let next = [];
  for (let i = 0; i < n; i++) {
    const degree = i / n * (2 * Math.PI);
    next.push([Math.cos(degree) * r, Math.sin(degree) * r]);
  }
  return next;
}

const eps = 1e-6;

function eq(a, b) {
  return Math.abs(a - b) < eps;
}

function ls(a, b) {
  return a < b && !eq(a, b);
}

function gr(a, b) {
  return a > b && !eq(a, b);
}

function lsEq(a, b) {
  return a < b || eq(a, b);
}

function grEq(a, b) {
  return a > b || eq(a, b);
}

function eqVector(v, u) {
  return eq(v[0], u[0]) && eq(v[1], u[1]);
}

function addVector(v, u) {
  return [v[0] + u[0], v[1] + u[1]];
}

function subVector(v, u) {
  return [v[0] - u[0], v[1] - u[1]];
}

function multVector(v, k) {
  return [v[0] * k, v[1] * k];
}

function lengthVector(v) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

function normalizeVector(v) {
  return multVector(v, 1 / lengthVector(v));
}

function dotProduct(v, u) {
  return v[0] * u[0] + v[1] * u[1];
}

function crossProduct(v, u) {
  return v[0] * u[1] - v[1] * u[0];
}

function rotateVector(v, angle) {
  return [Math.cos(angle) * v[0] - Math.sin(angle) * v[1], Math.sin(angle) * v[0] + Math.cos(angle) * v[1]];
}

function ortVector(v) {
  return [-v[1], v[0]];
}

function getH(p, a, b) {
  const v = subVector(b, a);
  const k = dotProduct(subVector(p, a), v) / dotProduct(v, v);
  return addVector(a, multVector(v, k));
}

function onLine(p, a, b) {
  return eq(crossProduct(subVector(p, a), subVector(b, a)), 0);
}

function onSegment(p, a, b) {
  return onLine(p, a, b) && lsEq(dotProduct(subVector(p, a), subVector(p, b)), 0);
}

function getNearest(p, a, b) {
  const h = getH(p, a, b);
  if (onSegment(h, a, b)) {
    return h;
  }
  const va = subVector(p, a);
  const vb = subVector(p, b);
  return lengthVector(va) < lengthVector(vb) ? a : b;
}

function gravitateVector(v, positions, masses) {
  let force = [0, 0];
  for (let i = 0; i < positions.length; i++) {
    const distanceVector = subVector(positions[i], v);
    const distance = lengthVector(distanceVector);
    const direction = normalizeVector(distanceVector);
    const k = masses[i] / (distance * distance);
    const current = multVector(direction, k);

    force = addVector(force, current);
  }
  return force;
}

function rotateVectorAround(v, c, angle) {
  const r = subVector(v, c);
  return addVector(c, rotateVector(r, angle));
}

function areaPolygon(polygon) {
  let area = 0;
  for (let i = 2; i < polygon.length; i++) {
    area += crossProduct(subVector(polygon[i - 1], polygon[0]), subVector(polygon[i], polygon[0]));
  }
  return Math.abs(area);
}

function translatePolygon(polygon, v) {
  let next = [];
  for (let i = 0; i < polygon.length; i++) {
    next.push(addVector(polygon[i], v));
  }
  return next;
}

function rotatePolygonAround(polygon, c, angle) {
  let next = [];
  for (let i = 0; i < polygon.length; i++) {
    next.push(rotateVectorAround(polygon[i], c, angle));
  }
  return next;
}

function moveVerticesPolygon(polygon, velocities) {
  let next = [];
  for (let i = 0; i < polygon.length; i++) {
    next.push(addVector(polygon[i], velocities[i]));
  }
  return next;
}

function pullIntersectedPolygon(polygon, centers, radiuses) {
  const n = polygon.length;
  let velocities = [];
  for (let i = 0; i < polygon.length; i++) {
    velocities.push([0, 0]);
  }
  for (let i = 0; i < polygon.length; i++) {
    for (let s = 0; s < centers.length; s++) {
      const nearest = getNearest(centers[s], polygon[i], polygon[(i + 1) % n]);
      const distance = lengthVector(subVector(centers[s], nearest));
      if (distance >= radiuses[s]) {
        continue;
      }
      const direction = subVector(nearest, centers[s]);
      const pull = multVector(direction, 1 / lengthVector(direction) * (radiuses[s] - distance));
      if (eqVector(nearest, polygon[i])) {
        velocities[i] = addVector(velocities[i], pull);
      }
      if (eqVector(nearest, polygon[(i + 1) % n])) {
        velocities[(i + 1) % n] = addVector(velocities[(i + 1) % n], pull);
      }
      if (!eqVector(nearest, polygon[i]) && !eqVector(nearest, polygon[(i + 1) % n])) {
        velocities[i] = addVector(velocities[i], pull);
        velocities[(i + 1) % n] = addVector(velocities[(i + 1) % n], pull);
      }
    }
  }
  return moveVerticesPolygon(polygon, velocities);
}

function restoreArea(polygon, area) {
  const n = polygon.length;
  let innerForces = [];
  for (let i = 0; i < polygon.length; i++) {
    let a = subVector(polygon[i], polygon[(i + n - 1) % n]);
    let b = subVector(polygon[(i + 1) % n], polygon[i]);
    let aN = ortVector(a);
    let bN = ortVector(b);
    let direction = addVector(aN, bN);
    let directionLength = lengthVector(direction);
    let force = multVector(direction, 1 / directionLength);
    innerForces.push(force);
  }
  const currentArea = areaPolygon(polygon);
  let k = (area - currentArea) * 0.001;
  if (Math.abs(k) > 1) {
    k = Math.sign(k);
  }
  return moveVerticesPolygon(polygon, innerForces.map(x => multVector(x, -k)));
}

function restoreEdges(polygon, lengths) {
  let innerForces = [];
  for (let i = 0; i < polygon.length; i++) {
    innerForces.push([0, 0]);
  }
  let deltas = [];
  for (let i = 0; i < polygon.length; i++) {
    const v = subVector(polygon[(i + 1) % polygon.length], polygon[i]);
    const current = lengthVector(v);
    const delta = current - lengths[i];
    innerForces[i] = addVector(innerForces[i], multVector(v, delta / current));
    innerForces[(i + 1) % polygon.length] = addVector(innerForces[(i + 1) % polygon.length], multVector(v, -delta / current));
  }
  return moveVerticesPolygon(polygon, innerForces.map(x => multVector(x, 0.01)));
}

function fixAngles(polygon) {
  const n = polygon.length;
  let innerForces = [];
  let velocities = [];
  for (let i = 0; i < polygon.length; i++) {
    let a = subVector(polygon[i], polygon[(i + n - 1) % n]);
    let b = subVector(polygon[(i + 1) % n], polygon[i]);
    let aN = ortVector(a);
    let bN = ortVector(b);
    let direction = addVector(aN, bN);
    let directionLength = lengthVector(direction);
    let force = multVector(direction, 1 / directionLength);
    innerForces.push(force);
    velocities.push([0, 0]);
  }
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[(i + n - 1) % n];
    const b = polygon[i];
    const c = polygon[(i + 1) % n];
    const v = subVector(a, b);
    const u = subVector(c, b);
    const angle = Math.atan2(crossProduct(u, v), dotProduct(u, v));
    if (angle < 0) {
      const k = Math.abs(angle) * 0.1;
      velocities[(i + n - 1) % n] = addVector(velocities[(i + n - 1) % n], multVector(innerForces[(i + n - 1) % n], k));
      velocities[i] = addVector(velocities[i], multVector(innerForces[i], -k));
      velocities[(i + 1) % n] = addVector(velocities[(i + 1) % n], multVector(innerForces[(i + 1) % n], k));
    } else if (angle < Math.PI / 2) {
      const k = (Math.PI / 2 - angle) * 0.1;
      velocities[(i + n - 1) % n] = addVector(velocities[(i + n - 1) % n], multVector(innerForces[(i + n - 1) % n], -k));
      velocities[i] = addVector(velocities[i], multVector(innerForces[i], k));
      velocities[(i + 1) % n] = addVector(velocities[(i + 1) % n], multVector(innerForces[(i + 1) % n], -k));
    }
  }
  return velocities;
}

function createGravitationalCell(polygon) {
  const area = areaPolygon(polygon);
  const lengths = [];
  for (let i = 0; i < polygon.length; i++) {
    lengths.push(lengthVector(subVector(polygon[(i + 1) % polygon.length], polygon[i])));
  }
  let current = polygon;
  let velocities = [];
  for (let i = 0; i < polygon.length; i++) {
    velocities.push([0, 0]);
  }

  let v;
  let angle = 0;
  return {
    draw(context) {
      drawPolygon(context, current);
      //for (let i = 0; i < current.length; i++) {
      //  drawLine(context, current[i], addVector(current[i], multVector(v[i], 10)));
      //}
    //  for (let i = 0; i < current.length; i++) {
    //    drawLine(context, current[i], addVector(current[i], multVector(velocities[i], 100)));
    //  }
    },
    tick(delta) {
      angle += delta;
      const n = polygon.length;
      let innerForces = [];
      let maxX = polygon[0][0], minX = polygon[0][0];
      for (let i = 0; i < polygon.length; i++) {
        maxX = Math.max(maxX, polygon[i][0]);;
        minX = Math.min(minX, polygon[i][0]);;

        let a = subVector(polygon[i], polygon[(i + n - 1) % n]);
        let b = subVector(polygon[(i + 1) % n], polygon[i]);
        let aN = ortVector(a);
        let bN = ortVector(b);
        let direction = addVector(aN, bN);
        let directionLength = lengthVector(direction);
        let force = multVector(direction, 1 / directionLength);
        innerForces.push(force);
      }
      let k = angle;
      for (let i = 0; i < n; i++) {
        let r = 0.1 + Math.random() * 0.9;
        velocities[i] = addVector(velocities[i], multVector(innerForces[i], 0.01 * r * Math.sin(k / 100)));
        const p = 0.5 + 0.5 * (1 - (maxX - polygon[i][0]) / (maxX - minX));
  //      velocities[i] = addVector(velocities[i], [Math.cos(angle / 1000) * p * 0.01, Math.sin(angle / 1000) * p * 0.01]);
      }
      for (let i = 0; i < n; i++) {
      }
      current = moveVerticesPolygon(current, velocities); 
      current = restoreArea(current, area);
      current = restoreEdges(current, lengths);
      //v = fixAngles(current, lengths);
      //current = moveVerticesPolygon(current, v);
    }
  };
}


let polygon = createRegularPolygon(30, 120);
polygon = translatePolygon(polygon, [400, 300]);
const { draw, tick } = createGravitationalCell(polygon);

function animate(context) {
  context.clearRect(0, 0, 1000, 1000);
  tick(1000 / 50);
  draw(context);
}

const context = document.getElementById("canvas").getContext("2d");
// animate(context, 1000 / 50);
setInterval(() => animate(context), 1000 / 50);
