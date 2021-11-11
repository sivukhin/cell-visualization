uniform vec3 u_color;
uniform float u_start;
uniform float u_glow;
uniform float u_visibility;
uniform sampler2D u_texture;

varying vec2 v_uv;
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
    float b = texture(u_texture, v_uv)[0];
    vec3 color = vec3(u_color);
    color[2] *= 1.0 - pow(((1.0 - b) / 2.0), 1.0);
    color[2] += 0.5 * (1.0 - color[2]) * u_glow * smoothstep(1.0, 0.0, v_distance);
    color[0] *= 1.0 - u_glow;
    if (v_distance >= u_start) {
        color[2] *= smoothstep(1.5, 0.0, (v_distance - u_start) / (1.0 - u_start));
        gl_FragColor = vec4(hsl2rgb(color), u_visibility);
    } else {
        gl_FragColor = vec4(hsl2rgb(color), u_visibility);
    }
}
