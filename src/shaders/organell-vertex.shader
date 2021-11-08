attribute float thickness;

varying float v_distance;
varying float v_thickness;
varying vec2 v_uv;

void main() {
    v_uv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    v_thickness = thickness;
    if (length(position) > 0.1) {
        v_distance = 1.0;
    } else {
        v_distance = 0.0;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
