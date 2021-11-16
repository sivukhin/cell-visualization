uniform sampler2D u_texture;
uniform float u_time;
uniform float u_r;
uniform vec2[15] u_centers;
uniform vec3[15] u_colors;
uniform float[15] u_weights;

varying vec2 v_position;
#define PI 3.1415

void main() {
    vec2 wobbled = vec2(v_position.x + sin(v_position.y / 5.0 + u_time / 1000.0), v_position.y + cos(v_position.x / 5.0 + u_time / 1000.0));
    float r = length(v_position);
    float best_dist = distance(wobbled, u_centers[0]) * u_weights[0];
    float scnd_dist = 100000.0;
    int best_point = 0;
    for (int i = 1; i < 15; i++) {
        float curr_dist = distance(wobbled, u_centers[i]) * (1.0 + 0.1 * sin(float(i) + u_time / 1000.0));
        if (curr_dist < best_dist) {
          scnd_dist = best_dist;
          best_dist = curr_dist;
          best_point = i;
        } else if (curr_dist < scnd_dist) {
          scnd_dist = curr_dist;
        }
    }
    vec2 offset = vec2(cos(u_centers[best_point][0]), sin(u_centers[best_point][1])) * 0.1;
    float grayscale = texture(u_texture, smoothstep(-1.0, 1.0, (wobbled - u_centers[best_point]) / (0.5 * u_r + offset))).r + 0.2;
    float d = pow(best_dist / scnd_dist, 2.0);
    float t = smoothstep(0.9 + 0.2 * sin(u_time / 1000.0), 0.5, d);
    t *= smoothstep(1.2 * scnd_dist, 0.0, best_dist);
    t *= smoothstep(0.0, 80.0, u_r - r);
    gl_FragColor = vec4(vec3(grayscale), t * grayscale);
}
