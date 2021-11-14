/**
 * RGB Shift Shader
 * Shifts red and blue channels from center in opposite directions
 * Ported from http://kriss.cx/tom/2009/05/rgb-shift/
 * by Tom Butterworth / http://kriss.cx/tom/
 *
 * amount: shift distance (1 is width of input)
 * angle: shift angle in radians
 */

const RGBShiftShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.01 },
        angle: { value: 0.0 },
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform float amount;
		uniform float angle;
		varying vec2 vUv;
		void main() {
			vec2 offset = amount * vec2( cos(angle), sin(angle));
			vec4 orig = texture(tDiffuse, vUv);
			vec4 crb = texture(tDiffuse, vUv + offset);
			gl_FragColor = vec4(orig.r, orig.g, crb.b, orig.a);
		}`,
};

export { RGBShiftShader };
