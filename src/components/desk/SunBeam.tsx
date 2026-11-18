import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Vector3, type PerspectiveCamera, type ShaderMaterial, type Vector3Tuple } from 'three';
import { seededRandom } from './polaroid';

/*
 * The sunbeam: the shaft of sunlight from the viewport down onto the desk, made visible by the
 * dust in the air, with motes of dust glinting in it. No real light is involved (the light on the
 * desk is Room.tsx's Sunlight); this is just the glow in the air.
 *
 * The shaft is ray-marched. A mesh shaped like the beam (the window's shape, swept from the glass
 * down to the lit patch on the desk) is drawn with a shader that, for each pixel, follows the
 * line of sight through the beam: it finds where the line leaves the beam (the beam's six faces
 * are planes, so that's a little algebra), takes a dozen or two steps between, and at each one
 * asks how much sun reaches that point. It does that by tracing back toward the sun to the
 * glass: the frame and the two struts block it, so they show in the shaft as darker bands. The
 * light at each step is added up, so the shaft glows more where you look through more of it.
 */

export interface BeamWindow {
	left: number;
	right: number;
	bottom: number;
	top: number;
	/** The glass's z. */
	z: number;
	/** Frame width, and the struts' centres (as fractions across) and width (metres). */
	frame: number;
	struts: number[];
	strutWidth: number;
}

interface SunBeamProps {
	/** Where the sunlight comes from (a point behind the wall). */
	sun: Vector3Tuple;
	window: BeamWindow;
	/** Steps per pixel through the beam (more is smoother and costs more); 0 leaves the shaft out
	 *  (phones: without the sun's shadows there's no window shape on the desk for it to match, and
	 *  head-on on a tall screen it just greys the map). The dust stays. */
	steps: number;
	motes: number;
	reducedMotion: boolean;
}

const BEAM_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorld = world.xyz;
	gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const beamFragment = (steps: number) => /* glsl */ `
uniform float uTime;
uniform float uDensity;
uniform vec3 uColour;
uniform vec3 uSun;
uniform vec4 uWindow;   // left, right, bottom, top
uniform float uGlassZ;
uniform vec2 uFrame;    // frame width as a fraction of the window's width and height
uniform vec3 uStruts;   // x, y: strut centres (fractions across); z: half their width (fraction)
uniform vec3 uPlaneN[6];
uniform vec3 uPlaneP[6];
varying vec3 vWorld;

// A hash without sin(): a few multiply-adds (Dave Hoskins' "hash without sine"). The noise below
// calls it 8 times a step, so this is most of the shaft's cost.
float hash(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
		f.z);
}

// How much sun reaches x: trace back to the glass and look at what's there.
float sunAt(vec3 x) {
	float s = (uGlassZ - uSun.z) / (x.z - uSun.z);
	vec3 q = uSun + (x - uSun) * s;
	vec2 uv = vec2((q.x - uWindow.x) / (uWindow.y - uWindow.x), (q.y - uWindow.z) / (uWindow.w - uWindow.z));
	vec2 e = min(uv, 1.0 - uv);
	float open = smoothstep(uFrame.x * 0.8, uFrame.x * 1.6, e.x) * smoothstep(uFrame.y * 0.8, uFrame.y * 1.6, e.y);
	float strut = min(abs(uv.x - uStruts.x), abs(uv.x - uStruts.y));
	return open * (0.45 + 0.55 * smoothstep(uStruts.z * 0.8, uStruts.z * 2.2, strut));
}

void main() {
	vec3 o = cameraPosition;
	vec3 d = normalize(vWorld - o);
	// In at this face; out at the nearest of the beam's faces ahead.
	float t0 = length(vWorld - o);
	float t1 = 1e5;
	for (int i = 0; i < 6; i++) {
		float denom = dot(uPlaneN[i], d);
		if (denom > 1e-4) t1 = min(t1, dot(uPlaneN[i], uPlaneP[i] - o) / denom);
	}
	if (t1 <= t0) discard;
	float dt = (t1 - t0) / float(${steps});
	// Start each pixel's steps at a slightly different place: hides the stepping (the film grain
	// covers the rest).
	float t = t0 + dt * hash(vWorld * 91.0 + uTime);
	float light = 0.0;
	for (int i = 0; i < ${steps}; i++) {
		vec3 x = o + d * t;
		// Soft where the shaft meets the desk, and clear for the first metre from the glass (or
		// looking out through it, the haze would fog Earth). Patchy, slowly drifting dust.
		float fade = smoothstep(0.0, 0.2, x.y) * smoothstep(uGlassZ + 0.2, uGlassZ + 1.2, x.z);
		float dust = 0.45 + 0.9 * noise(x * 2.4 + vec3(0.0, uTime * 0.05, uTime * 0.03));
		light += sunAt(x) * fade * dust;
		t += dt;
	}
	light *= dt * uDensity;
	gl_FragColor = vec4(uColour * light, 1.0);
}
`;

const MOTE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uScale;
attribute float aSeed;
varying float vAlpha;
void main() {
	vec3 p = position;
	// Each mote wanders on its own slow loop, and sinks or rises a little.
	float t = uTime * 0.15;
	p.x += sin(t * 1.3 + aSeed * 40.0) * 0.05;
	p.y += sin(t * 0.7 + aSeed * 17.0) * 0.06;
	p.z += cos(t * 1.1 + aSeed * 23.0) * 0.05;
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	gl_Position = projectionMatrix * mv;
	float size = mix(0.003, 0.007, fract(aSeed * 13.7));
	gl_PointSize = size * uScale / -mv.z;
	// Glint as they turn; fade out near the desk.
	vAlpha = smoothstep(0.02, 0.12, p.y) * (0.25 + 0.75 * pow(0.5 + 0.5 * sin(uTime * (0.5 + fract(aSeed * 3.1)) + aSeed * 50.0), 3.0));
}
`;

const MOTE_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
varying float vAlpha;
void main() {
	float r = length(gl_PointCoord - 0.5);
	float a = smoothstep(0.5, 0.0, r) * vAlpha;
	if (a < 0.01) discard;
	gl_FragColor = vec4(uColour * a, 1.0);
}
`;

export function SunBeam({ sun, window: w, steps, motes, reducedMotion }: SunBeamProps) {
	const { size, camera, viewport } = useThree();

	// The beam's shape: the glass's four corners, and where the sun's rays through them land on
	// the desk (y = 0). Six faces, each also kept as a plane (outward normal and a point on it)
	// for the shader.
	const beam = useMemo(() => {
		const L = new Vector3(...sun);
		const corner = (u: number, v: number) => new Vector3(u ? w.right : w.left, v ? w.top : w.bottom, w.z);
		const onDesk = (p: Vector3) => L.clone().lerp(p, L.y / (L.y - p.y));
		const g = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]; // glass: bl, br, tr, tl
		const e = g.map(onDesk); // the same corners on the desk
		const faces = [
			[g[0], g[1], g[2], g[3]], // the glass
			[e[0], e[1], e[2], e[3]], // the desk
			[g[3], g[2], e[2], e[3]], // top
			[g[0], g[1], e[1], e[0]], // bottom (along the sill)
			[g[0], g[3], e[3], e[0]], // left
			[g[1], g[2], e[2], e[1]], // right
		];
		const centre = [...g, ...e].reduce((a, b) => a.add(b), new Vector3()).divideScalar(8);
		const positions: number[] = [];
		const normals: Vector3[] = [];
		const points: Vector3[] = [];
		for (const [a, b, c, dd] of faces) {
			let n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
			// Wind each face so it faces out of the beam (the shader draws front faces).
			let quad = [a, b, c, dd];
			if (n.dot(a.clone().sub(centre)) < 0) {
				n = n.negate();
				quad = [a, dd, c, b];
			}
			normals.push(n);
			points.push(a);
			for (const v of [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]]) positions.push(v.x, v.y, v.z);
		}
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
		return { geometry, normals, points };
	}, [sun, w]);
	useEffect(() => () => beam.geometry.dispose(), [beam]);

	// Dust: scattered through the shaft (a random point of the glass, a random way along its ray
	// to the desk), kept inside the room.
	const dust = useMemo(() => {
		const rand = seededRandom('sunbeam');
		const L = new Vector3(...sun);
		const positions = new Float32Array(motes * 3);
		const seeds = new Float32Array(motes);
		let n = 0;
		while (n < motes) {
			const p = new Vector3(w.left + rand() * (w.right - w.left), w.bottom + rand() * (w.top - w.bottom), w.z);
			const end = L.clone().lerp(p, L.y / (L.y - p.y));
			const q = p.lerp(end, 0.1 + rand() * 0.85);
			if (q.z < w.z + 0.4 || q.y < 0.05) continue;
			positions.set([q.x, q.y, q.z], n * 3);
			seeds[n] = rand();
			n++;
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(positions, 3));
		g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
		return g;
	}, [sun, w, motes]);
	useEffect(() => () => dust.dispose(), [dust]);

	const beamUniforms = useMemo(
		() => ({
			uTime: { value: 0 },
			// Glow per metre of beam looked through.
			uDensity: { value: 0.1 },
			uColour: { value: new Vector3(0.85, 0.9, 1.0) },
			uSun: { value: new Vector3(...sun) },
			uWindow: { value: [w.left, w.right, w.bottom, w.top] },
			uGlassZ: { value: w.z },
			uFrame: {
				value: [w.frame / (w.right - w.left), w.frame / (w.top - w.bottom)],
			},
			uStruts: {
				value: new Vector3(w.struts[0], w.struts[1], w.strutWidth / 2 / (w.right - w.left)),
			},
			uPlaneN: { value: beam.normals },
			uPlaneP: { value: beam.points },
		}),
		[sun, w, beam],
	);
	const moteUniforms = useMemo(
		() => ({
			uTime: { value: 0 },
			uScale: { value: 1000 },
			uColour: { value: new Vector3(0.9, 0.87, 0.82) },
		}),
		[],
	);
	const fragmentShader = useMemo(() => beamFragment(steps), [steps]);

	const beamMaterial = useRef<ShaderMaterial>(null);
	const mote = useRef<ShaderMaterial>(null);
	useFrame(({ clock }) => {
		const t = reducedMotion ? 0 : clock.elapsedTime;
		if (beamMaterial.current) beamMaterial.current.uniforms.uTime.value = t;
		if (mote.current) {
			mote.current.uniforms.uTime.value = t;
			// Pixels per metre at 1 m away, so a mote's size is in metres like everything else.
			const fov = ((camera as PerspectiveCamera).fov * Math.PI) / 180;
			mote.current.uniforms.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan(fov / 2));
		}
	});

	return (
		<group>
			{steps > 0 && (
				<mesh geometry={beam.geometry} frustumCulled={false} renderOrder={2}>
					<shaderMaterial
						ref={beamMaterial}
						vertexShader={BEAM_VERTEX}
						fragmentShader={fragmentShader}
						uniforms={beamUniforms}
						transparent
						depthWrite={false}
						blending={AdditiveBlending}
					/>
				</mesh>
			)}
			<points geometry={dust} frustumCulled={false} renderOrder={3}>
				<shaderMaterial ref={mote} vertexShader={MOTE_VERTEX} fragmentShader={MOTE_FRAGMENT} uniforms={moteUniforms} transparent depthWrite={false} blending={AdditiveBlending} />
			</points>
		</group>
	);
}
