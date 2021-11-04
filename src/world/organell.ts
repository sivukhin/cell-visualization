import { createAliveMembrane } from "./membrane";
import { MembraneConfiguration, Unwrap } from "../configuration";
import { Color, ColorRepresentation, Mesh, MeshBasicMaterial, ShaderMaterial, Uniform, Vector3 } from "three";
import OrganellVertexShader from "../shaders/organell-vertex.shader";
import OrganellFragmentShader from "../shaders/organell-fragment.shader";
import { interpolate } from "../utils/math";

export function createAliveOrganell(membraneConfig: Unwrap<MembraneConfiguration>) {
    const { geometry, tick: membraneTick } = createAliveMembrane(membraneConfig);

    const organellColor = new Color(membraneConfig.color);
    const organellColorHsl = { h: 0, s: 0, l: 0 };
    organellColor.getHSL(organellColorHsl);
    const material = new ShaderMaterial({
        uniforms: {
            u_color: new Uniform(new Vector3(organellColorHsl.h, organellColorHsl.s, organellColorHsl.l)),
            u_start: new Uniform(0.9),
            u_glow: new Uniform(0.0),
        },
        vertexShader: OrganellVertexShader,
        fragmentShader: OrganellFragmentShader,
        transparent: true,
    });

    const organell = new Mesh(geometry, material);
    organell.renderOrder = 0;
    let startGlow = 0;
    let finishGlow = 0;
    let lastTime = 0;
    return {
        object: organell,
        tick: (time: number) => {
            lastTime = time;
            if (startGlow < time && time < finishGlow) {
                const d = time - startGlow;
                const delta = finishGlow - startGlow;
                if (d < delta / 4) {
                    material.uniforms.u_glow.value = d / (delta / 4);
                } else {
                    material.uniforms.u_glow.value = 1 - (d - delta / 4) / ((3 * delta) / 4);
                }
            } else if (time > finishGlow) {
                startGlow = finishGlow = 0;
            }
            membraneTick(time);
        },
        glow: (start: number, finish: number) => {
            if (startGlow != 0) {
                startGlow = Math.min(startGlow, start);
                finishGlow = Math.max(finishGlow, finish);
            } else {
                startGlow = start;
                finishGlow = finish;
            }
        },
    };
}
