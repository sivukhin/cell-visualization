uniform sampler2D u_texture;
uniform float u_time;
uniform float u_r;
uniform float u_curvature;
uniform vec2[15] u_centers;
uniform vec3[15] u_colors;
uniform float[15] u_weights;
uniform float[15] u_trans_start;
uniform float[15] u_trans_finish;

varying vec2 v_position;
#define PI 3.1415

float hue2rgb(float f1, float f2, float hue) {
    if (hue < 0.0)
    hue += 1.0;
    else if (hue > 1.0)
    hue -= 1.0;
    float res;
    if ((6.0 * hue) < 1.0)
    res = f1 + (f2 - f1) * 6.0 * hue;
    else if ((2.0 * hue) < 1.0)
    res = f2;
    else if ((3.0 * hue) < 2.0)
    res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
    else
    res = f1;
    return res;
}

vec3 hsl2rgb(vec3 hsl) {
    vec3 rgb;

    if (hsl.y == 0.0) {
        rgb = vec3(hsl.z); // Luminance
    } else {
        float f2;

        if (hsl.z < 0.5)
        f2 = hsl.z * (1.0 + hsl.y);
        else
        f2 = hsl.z + hsl.y - hsl.y * hsl.z;

        float f1 = 2.0 * hsl.z - f2;

        rgb.r = hue2rgb(f1, f2, hsl.x + (1.0/3.0));
        rgb.g = hue2rgb(f1, f2, hsl.x);
        rgb.b = hue2rgb(f1, f2, hsl.x - (1.0/3.0));
    }
    return rgb;
}

void main() {
    vec2 wobbled = vec2(v_position.x + sin(v_position.y / 5.0 + u_time / 1000.0), v_position.y + cos(v_position.x / 5.0 + u_time / 1000.0));
    float r = length(v_position);
    float best_dist = 100000.0;
    float scnd_dist = 100000.0;
    int best_point = -1;
    for (int i = 0; i < 15; i++) {
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
    vec2 direction = wobbled - u_centers[best_point];
    float grayscale = texture(u_texture, 0.5 + 0.5 * smoothstep(-20.0, 20.0, wobbled - u_centers[best_point])).r;
    float d = (1.0 - step(0.9, pow(best_dist / scnd_dist, 1.0))) * smoothstep(0.1, 0.15, (u_r - r) / u_r) * smoothstep(0.0, u_r / 8.0 * (1.0 + 0.1 * sin(u_time / 1000.0 + float(best_point))), (scnd_dist - best_dist));
    vec3 color = u_colors[best_point];
    color[2] *= 0.5 * (1.0 + d * grayscale);
    color[1] *= 0.5 * (1.0 + d * grayscale);
    if (u_time > u_trans_start[best_point] && u_time < u_trans_finish[best_point]) {
        float duration = u_trans_finish[best_point] - u_trans_start[best_point];
        color[0] *= smoothstep(u_trans_start[best_point] + duration / 2.0, u_trans_start[best_point], u_time) + smoothstep(u_trans_start[best_point] + duration / 2.0, u_trans_finish[best_point], u_time);
    }
    gl_FragColor = vec4(hsl2rgb(color), smoothstep(0.0, 1.5, d));
}
