uniform vec3 u_color;

varying float v_orientation;
varying float v_trace;

#define PI 3.1415

void main() {
    vec3 color = u_color;
    float k = smoothstep(0.5, 1.0, v_trace) * 0.7;
    color = max(color, vec3(k));
    gl_FragColor = vec4(color, smoothstep(1.0, 0.5, abs(v_orientation)));
}
