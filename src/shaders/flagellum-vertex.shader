attribute float orientation;
varying float v_orientation;

void main() {
    v_orientation = orientation;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
