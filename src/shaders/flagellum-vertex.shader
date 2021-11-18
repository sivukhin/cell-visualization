attribute float orientation;
attribute float trace;

varying float v_orientation;
varying float v_trace;

void main() {
    v_orientation = orientation;
    v_trace = trace;

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
