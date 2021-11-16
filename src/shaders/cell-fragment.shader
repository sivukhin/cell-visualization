uniform vec3 u_color;
uniform float u_start;

varying float v_distance;
varying float v_thickness;

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
    float current = u_start + (1.0 - u_start) * (1.0 - smoothstep(0.0, 1.0, v_distance));
    if (v_distance >= current) {
        float m = 5.0 * PI / (1.0 - current);
        vec3 color = vec3(u_color);
        float intensity = 1.0 - pow(smoothstep(current, 1.0, v_distance), 1.0);
        color[2] += sin((v_distance - current) * m * intensity) * intensity * min(color[2] - 0.2, 0.8 - color[2]);
        gl_FragColor = vec4(hsl2rgb(color), v_distance * intensity);
    } else {
        gl_FragColor = vec4(hsl2rgb(u_color), 0.2 + 0.8 * v_distance);
    }
}
