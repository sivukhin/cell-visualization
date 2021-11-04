varying float v_distance;

void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    if (length(position) > 0.1) {
        v_distance = 1.0;
    } else {
        v_distance = 0.0;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
