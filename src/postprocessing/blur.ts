/**
 https://www.shadertoy.com/view/Xltfzj
 */

const BlurShader = {
    uniforms: {
        tDiffuse: { value: null },
        u_size: { value: 0.01 },
    },

    vertexShader: /* glsl */ `
        varying vec2 vUv;
		void main() {
		    vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float u_size;

varying vec2 vUv;

float Pi = 6.28318530718;
float Directions = 8.0;
float Quality = 2.0;

void main() {
    vec4 color = texture(tDiffuse, vUv);
    for (float d=0.0; d<Pi; d+=Pi/Directions) {
        for (float i=1.0/Quality; i<=1.0; i+=1.0/Quality) {
            color += texture(tDiffuse, vUv+vec2(cos(d),sin(d))*u_size*i);		
        }
    }
    color /= Quality * Directions;
    gl_FragColor = color;
}`,
};

export { BlurShader };
