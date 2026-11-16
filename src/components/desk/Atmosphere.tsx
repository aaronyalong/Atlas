import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, type PerspectiveCamera, type ShaderMaterial } from 'three';
import { LAMP_POSITION } from './BankersLamp';
import { seededRandom } from './polaroidTexture';

/*
 * Dust drifting through the lamplight: a tiny shader program on the GPU (no per-frame JavaScript
 * beyond a clock). It holds still for visitors who ask for reduced motion.
 */

/* ---------- Dust motes ---------- */

const DUST_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform vec3 uLight;
attribute float aSeed;
varying float vAlpha;

void main() {
	vec3 p = position;
	// Each mote drifts on its own slow loop, with a slight upward creep that wraps round.
	float t = uTime * 0.12;
	p.x += sin(t * 1.3 + aSeed * 40.0) * 0.035;
	p.z += cos(t * 1.1 + aSeed * 23.0) * 0.035;
	p.y = mod(p.y + t * (0.02 + 0.03 * fract(aSeed * 7.3)), 0.42) + 0.03;
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	gl_Position = projectionMatrix * mv;
	float size = mix(0.0012, 0.0034, fract(aSeed * 13.7));
	gl_PointSize = size * uScale / -mv.z;
	// Only motes in the lamplight show: fade with distance from the lit volume under the shade,
	// and twinkle as they turn.
	float d = length((p - uLight) * vec3(1.0, 1.6, 1.3));
	float lit = exp(-d * d * 7.0);
	float edge = smoothstep(0.03, 0.08, p.y) * smoothstep(0.45, 0.3, p.y);
	vAlpha = lit * edge * (0.45 + 0.55 * sin(uTime * (0.6 + fract(aSeed * 3.1)) + aSeed * 50.0));
}
`;

const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
varying float vAlpha;
void main() {
	float r = length(gl_PointCoord - 0.5);
	float a = smoothstep(0.5, 0.0, r) * vAlpha;
	if (a < 0.01) discard;
	gl_FragColor = vec4(uColour, a * 0.6);
}
`;

export function DustMotes({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
	const material = useRef<ShaderMaterial>(null);
	const { size, camera, viewport } = useThree();

	const geometry = useMemo(() => {
		const rand = seededRandom('dust');
		const positions = new Float32Array(count * 3);
		const seeds = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			positions[i * 3] = -0.7 + rand() * 1.1;
			positions[i * 3 + 1] = rand() * 0.42;
			positions[i * 3 + 2] = -0.45 + rand() * 0.75;
			seeds[i] = rand();
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(positions, 3));
		g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
		return g;
	}, [count]);

	const uniforms = useMemo(
		() => ({
			uTime: { value: 0 },
			uScale: { value: 1000 },
			uLight: { value: [LAMP_POSITION[0] + 0.25, 0.16, LAMP_POSITION[2] + 0.22] },
			uColour: { value: [1, 0.86, 0.68] },
		}),
		[],
	);

	useFrame(({ clock }) => {
		const m = material.current;
		if (!m) return;
		if (!reducedMotion) m.uniforms.uTime.value = clock.elapsedTime;
		// Pixels per metre at 1 m away: so a mote's size is in metres, like everything else.
		const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
		m.uniforms.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan(fov / 2));
	});

	return (
		<points geometry={geometry} frustumCulled={false}>
			<shaderMaterial
				ref={material}
				vertexShader={DUST_VERTEX}
				fragmentShader={DUST_FRAGMENT}
				uniforms={uniforms}
				transparent
				depthWrite={false}
				blending={AdditiveBlending}
			/>
		</points>
	);
}
