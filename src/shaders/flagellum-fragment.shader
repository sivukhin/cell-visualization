uniform vec3 u_color;

varying float v_orientation;

#define PI 3.1415

void main() {
    gl_FragColor = vec4(u_color, smoothstep(1.0, 0.5, abs(v_orientation)));
}
