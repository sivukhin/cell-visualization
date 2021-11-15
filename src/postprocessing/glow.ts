/**
 https://www.shadertoy.com/view/Mdf3zr
 */

const EdgeGlowShader = {
    uniforms: {
        tDiffuse: { value: null },
    },

    vertexShader: /* glsl */ `
        varying vec2 vUv;
		void main() {
		    vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

        float lookup(vec2 p, float dx, float dy)
        {
            float d = 0.001;
            vec2 t = (p.xy + vec2(dx * d, dy * d));
            vec4 c = texture(tDiffuse, t.xy);
        
            // return as luma
            return 0.2126*c.r + 0.7152*c.g + 0.0722*c.b;
        }
        
        void main()
        {
            // simple sobel edge detection
            float gx = 0.0;
            gx += -1.0 * lookup(vUv, -1.0, -1.0);
            gx += -2.0 * lookup(vUv, -1.0,  0.0);
            gx += -1.0 * lookup(vUv, -1.0,  1.0);
            gx +=  1.0 * lookup(vUv,  1.0, -1.0);
            gx +=  2.0 * lookup(vUv,  1.0,  0.0);
            gx +=  1.0 * lookup(vUv,  1.0,  1.0);
            
            float gy = 0.0;
            gy += -1.0 * lookup(vUv, -1.0, -1.0);
            gy += -2.0 * lookup(vUv,  0.0, -1.0);
            gy += -1.0 * lookup(vUv,  1.0, -1.0);
            gy +=  1.0 * lookup(vUv, -1.0,  1.0);
            gy +=  2.0 * lookup(vUv,  0.0,  1.0);
            gy +=  1.0 * lookup(vUv,  1.0,  1.0);
            
            float g = gx*gx + gy*gy;
            
            vec4 col = texture(tDiffuse, vUv);
            if (col.a != 0.0) {
                col += vec4(0.0, g, 0.0, 1.0);
                gl_FragColor = col;
            }
        }`,
};

export { EdgeGlowShader };
