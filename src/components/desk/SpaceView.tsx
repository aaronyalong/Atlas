import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
	AdditiveBlending,
	BackSide,
	BufferAttribute,
	BufferGeometry,
	Color,
	type Group,
	IcosahedronGeometry,
	MathUtils,
	type Mesh,
	type Points,
	Quaternion,
	type ShaderMaterial,
	SRGBColorSpace,
	Vector3,
	type Vector3Tuple,
} from 'three';
import { seededRandom } from './polaroidTexture';

/*
 * The view through the viewport: the desk is on a station in orbit, and outside is space.
 *
 *   - Earth, below and ahead: Solar System Scope's day, night-lights and cloud maps (made from
 *     NASA imagery; CC BY 4.0, credited on /credits), on a sphere with its own shader: sunlit day
 *     side with sun glint off the oceans, city lights glowing across the night side, clouds over
 *     both, a warm band at the terminator, and a blue atmospheric rim. It turns slowly, and the
 *     clouds drift.
 *   - A glowing atmosphere shell around it, brightest at the limb on the sunlit side.
 *   - Stars, thickest along a Milky Way band.
 *   - Every so often, in turn: a shooting star burning up in the atmosphere over Earth's limb, a
 *     meteor tumbling past, and a rocket crossing with its engine lit and an exhaust trail.
 *     (Not for visitors who ask for reduced motion.)
 *
 * Positions are in metres, in the room's coordinates (the viewport's glass is at z ≈ -0.96). Earth
 * is drawn at a much smaller scale than real (it only has to look right through the viewport), and
 * everything out here ignores the room's fog.
 */

/** Earth's centre and radius, and the sun's direction (from Earth toward the sun). */
export const EARTH = { center: [-4.5, -19.8, -26] as Vector3Tuple, radius: 13 };
/** From the left and a little behind Earth: the near side is split by the terminator, so the
 * sunlit half shows its oceans and clouds and the night half its city lights. */
const SUN = new Vector3(-0.82, 0.3, -0.3).normalize();

export interface EarthTextures {
	day: string;
	night: string;
	clouds: string;
}

export function SpaceView({ textures, reducedMotion, events }: { textures: EarthTextures; reducedMotion: boolean; events: boolean }) {
	return (
		<group>
			<Stars />
			<Earth textures={textures} reducedMotion={reducedMotion} />
			{events && !reducedMotion && <SkyEvents />}
		</group>
	);
}

/* ---------- Earth ---------- */

const EARTH_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
	vUv = uv;
	vNormalW = normalize(mat3(modelMatrix) * normal);
	vec4 w = modelMatrix * vec4(position, 1.0);
	vPosW = w.xyz;
	gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const EARTH_FRAGMENT = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uCloudShift;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
	vec3 n = normalize(vNormalW);
	vec3 v = normalize(cameraPosition - vPosW);
	float ndl = dot(n, uSun);
	// 1 on the day side, 0 on the night side, with a soft twilight band between.
	float day = smoothstep(-0.12, 0.22, ndl);

	vec3 dayCol = texture2D(uDay, vUv).rgb;
	vec3 nightCol = texture2D(uNight, vUv).rgb;
	float cloud = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;
	cloud = smoothstep(0.22, 0.95, cloud) * 0.85;

	// Oceans: bluer than they are red. They get the sun's glint.
	float ocean = smoothstep(0.015, 0.06, dayCol.b - dayCol.r) * (1.0 - cloud);
	vec3 h = normalize(uSun + v);
	float glint = pow(max(dot(n, h), 0.0), 70.0) * ocean * day;

	vec3 col = dayCol * (max(ndl, 0.0) * 1.5 + 0.015);
	// Twilight: a warm band where the sun is setting.
	float dusk = smoothstep(-0.12, 0.0, ndl) * smoothstep(0.22, 0.0, ndl);
	col += vec3(1.0, 0.42, 0.18) * dusk * 0.05;
	col += glint * vec3(1.0, 0.92, 0.8) * 1.4;

	// Clouds over everything, lit by the sun.
	vec3 cloudCol = vec3(0.95) * (max(ndl, 0.0) * 1.4 + 0.01);
	col = mix(col, cloudCol, cloud);

	// City lights on the night side, dimmed under cloud.
	col += nightCol * vec3(1.0, 0.82, 0.55) * (1.0 - day) * (1.0 - cloud * 0.85) * 2.4;

	// The atmosphere seen edge-on: a blue haze toward the limb, on the lit side.
	float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.0);
	col += vec3(0.32, 0.58, 1.0) * fresnel * (0.15 + 0.85 * day) * 0.9;

	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uSun;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
	vec3 n = normalize(vNormalW);
	vec3 v = normalize(cameraPosition - vPosW);
	// Drawn from inside (back faces): 0 at the shell's outer edge, rising to the planet's limb.
	float x = -dot(n, v);
	float glow = smoothstep(0.0, 0.27, x);
	glow *= glow;
	float lit = smoothstep(-0.35, 0.45, dot(n, uSun));
	vec3 blue = vec3(0.3, 0.55, 1.0);
	vec3 warm = vec3(1.0, 0.55, 0.3);
	vec3 col = mix(warm, blue, smoothstep(0.0, 0.5, dot(n, uSun) + 0.2));
	gl_FragColor = vec4(col * glow * lit * 1.6, 1.0);
}
`;

function Earth({ textures: urls, reducedMotion }: { textures: EarthTextures; reducedMotion: boolean }) {
	const textures = useTexture({ ...urls });
	useLayoutEffect(() => {
		textures.day.colorSpace = SRGBColorSpace;
		textures.night.colorSpace = SRGBColorSpace;
		for (const t of Object.values(textures)) {
			t.anisotropy = 8;
			t.needsUpdate = true;
		}
	}, [textures]);

	const earth = useRef<Mesh>(null);
	const material = useRef<ShaderMaterial>(null);
	const uniforms = useMemo(
		() => ({
			uDay: { value: textures.day },
			uNight: { value: textures.night },
			uClouds: { value: textures.clouds },
			uSun: { value: SUN },
			uCloudShift: { value: 0 },
		}),
		[textures],
	);
	const atmosphereUniforms = useMemo(() => ({ uSun: { value: SUN } }), []);

	useFrame((_, delta) => {
		if (reducedMotion) return;
		if (earth.current) earth.current.rotation.y += delta * 0.006;
		if (material.current) material.current.uniforms.uCloudShift.value += delta * 0.0008;
	});

	return (
		<group position={EARTH.center}>
			{/* Turned so the Pacific faces the viewport, with the Americas going into night. */}
			<mesh ref={earth} rotation={[0.38, -1.55, 0.12]}>
				<sphereGeometry args={[EARTH.radius, 128, 96]} />
				<shaderMaterial ref={material} vertexShader={EARTH_VERTEX} fragmentShader={EARTH_FRAGMENT} uniforms={uniforms} />
			</mesh>
			<mesh scale={1.035}>
				<sphereGeometry args={[EARTH.radius, 96, 64]} />
				<shaderMaterial
					vertexShader={EARTH_VERTEX}
					fragmentShader={ATMOSPHERE_FRAGMENT}
					uniforms={atmosphereUniforms}
					side={BackSide}
					transparent
					depthWrite={false}
					blending={AdditiveBlending}
				/>
			</mesh>
		</group>
	);
}

/* ---------- Stars ---------- */

const STAR_VERTEX = /* glsl */ `
attribute float aSize;
attribute vec3 aColour;
varying vec3 vColour;
void main() {
	vColour = aColour;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_PointSize = aSize;
}
`;
const STAR_FRAGMENT = /* glsl */ `
varying vec3 vColour;
void main() {
	float r = length(gl_PointCoord - 0.5);
	float a = smoothstep(0.5, 0.0, r);
	if (a < 0.02) discard;
	gl_FragColor = vec4(vColour * a, 1.0);
}
`;

/** Stars on a far sphere, a third of them crowded into a Milky Way band across the sky. */
function Stars() {
	const geometry = useMemo(() => {
		const rand = seededRandom('stars');
		const count = 3200;
		const positions = new Float32Array(count * 3);
		const sizes = new Float32Array(count);
		const colours = new Float32Array(count * 3);
		const band = new Vector3(0.3, 0.9, -0.3).normalize(); // the band's pole
		const v = new Vector3();
		for (let i = 0; i < count; i++) {
			// Uniform on the sphere, then a third pulled toward the band's great circle.
			v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
			if (i % 3 === 0) v.addScaledVector(band, -v.dot(band) * (0.85 + rand() * 0.15)).normalize();
			v.multiplyScalar(140);
			positions.set([v.x, v.y, v.z], i * 3);
			const bright = Math.pow(rand(), 6);
			sizes[i] = 1.2 + bright * 3.4;
			const tint = rand();
			const c = new Color(tint < 0.15 ? '#ffd2a8' : tint < 0.3 ? '#bcd0ff' : '#ffffff').multiplyScalar(0.35 + bright * 3);
			colours.set([c.r, c.g, c.b], i * 3);
		}
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(positions, 3));
		g.setAttribute('aSize', new BufferAttribute(sizes, 1));
		g.setAttribute('aColour', new BufferAttribute(colours, 3));
		return g;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);

	return (
		<points geometry={geometry} frustumCulled={false}>
			<shaderMaterial vertexShader={STAR_VERTEX} fragmentShader={STAR_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} fog={false} />
		</points>
	);
}

/* ---------- Events: shooting star, meteor, rocket ---------- */

type EventKind = 'shootingStar' | 'meteor' | 'rocket';
const SEQUENCE: EventKind[] = ['shootingStar', 'meteor', 'rocket'];

/**
 * Plays the events one after another, with a pause of 9–18 s between them (the first comes a few
 * seconds after the scene appears).
 */
function SkyEvents() {
	const [active, setActive] = useState<{ kind: EventKind; id: number; slow: number } | null>(null);
	const next = useRef(5);
	const index = useRef(0);
	const rand = useMemo(() => seededRandom(`events-${Date.now()}`), []);

	// Dev builds only (stripped from production): play an event on demand, optionally slowed down.
	useEffect(() => {
		if (!import.meta.env.DEV) return;
		const w = window as unknown as { __skyEvent?: (kind: EventKind, slow?: number) => void };
		w.__skyEvent = (kind, slow = 1) => setActive({ kind, id: Date.now(), slow });
		return () => void delete w.__skyEvent;
	}, []);

	useFrame((_, delta) => {
		if (active) return;
		next.current -= delta;
		if (next.current <= 0) {
			setActive({ kind: SEQUENCE[index.current % SEQUENCE.length], id: index.current, slow: 1 });
			index.current += 1;
		}
	});

	const done = () => {
		next.current = 9 + rand() * 9;
		setActive(null);
	};

	if (!active) return null;
	if (active.kind === 'shootingStar') return <ShootingStar key={active.id} slow={active.slow} onDone={done} />;
	if (active.kind === 'meteor') return <Meteor key={active.id} slow={active.slow} onDone={done} />;
	return <Rocket key={active.id} slow={active.slow} onDone={done} />;
}

/**
 * A point just above Earth's surface, a fraction `t` of the way from direction `a` to direction `b`
 * (both from Earth's centre), following the curve of the planet: a straight line between two
 * surface points would cut through it, and the middle of the streak would vanish inside.
 */
function alongEarth(a: Vector3, b: Vector3, t: number, out: Vector3, height = 1.012): Vector3 {
	const angle = Math.acos(MathUtils.clamp(a.dot(b), -1, 1));
	const sa = Math.sin((1 - t) * angle) / Math.sin(angle);
	const sb = Math.sin(t * angle) / Math.sin(angle);
	return out
		.copy(a)
		.multiplyScalar(sa)
		.addScaledVector(b, sb)
		.multiplyScalar(EARTH.radius * height)
		.add(new Vector3(...EARTH.center));
}

/**
 * A shooting star: a meteor burning up in the atmosphere, seen from above as a bright streak
 * racing across the planet just inside its limb, a fading trail behind. Under a second.
 */
function ShootingStar({ slow, onDone }: { slow: number; onDone: () => void }) {
	// From the upper left of the planet's visible face to the upper right, inside the viewport in
	// the starting view and clear of the lamp's shade.
	const start = useMemo(() => new Vector3(-0.317, 0.93, 0.183).normalize(), []);
	const end = useMemo(() => new Vector3(0.253, 0.956, 0.146).normalize(), []);
	const DURATION = 0.9 * slow;
	const TRAIL = 0.35; // trail length as a fraction of the path
	const t = useRef(0);
	const line = useRef<Points>(null);

	const geometry = useMemo(() => {
		const n = 90; // enough points that they overlap into one continuous streak
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
		g.setAttribute('aSize', new BufferAttribute(new Float32Array(n), 1));
		g.setAttribute('aColour', new BufferAttribute(new Float32Array(n * 3), 3));
		return g;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);

	useFrame((_, delta) => {
		t.current += delta / DURATION;
		const head = Math.min(1, t.current);
		const position = geometry.attributes.position as BufferAttribute;
		const size = geometry.attributes.aSize as BufferAttribute;
		const colour = geometry.attributes.aColour as BufferAttribute;
		const p = new Vector3();
		const n = position.count;
		// Fade in, then out as it burns up.
		const life = Math.sin(Math.min(1, t.current) * Math.PI);
		for (let i = 0; i < n; i++) {
			const k = i / (n - 1); // 0 = head, 1 = tail end
			const s = MathUtils.clamp(head - k * TRAIL, 0, 1);
			alongEarth(start, end, s, p);
			position.setXYZ(i, p.x, p.y, p.z);
			const fade = (1 - k) * life;
			size.setX(i, (i === 0 ? 9 : 4) * (0.4 + fade));
			// A white-hot head, the trail cooling to a pale green-blue (burning in the air).
			colour.setXYZ(i, (i === 0 ? 4 : 1.6) * fade, (i === 0 ? 4 : 2.6) * fade, (i === 0 ? 4 : 2.4) * fade);
		}
		position.needsUpdate = size.needsUpdate = colour.needsUpdate = true;
		if (t.current >= 1.25) onDone();
	});

	return (
		<points ref={line} geometry={geometry} frustumCulled={false}>
			<shaderMaterial vertexShader={STAR_VERTEX} fragmentShader={STAR_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} fog={false} />
		</points>
	);
}

/** Simple sunlit shading for things outside: they're lit by the sun, not the room's lamps. */
const SUNLIT_VERTEX = EARTH_VERTEX;
const SUNLIT_FRAGMENT = /* glsl */ `
uniform vec3 uColour;
uniform vec3 uSun;
uniform float uGlow;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
	vec3 n = normalize(vNormalW);
	vec3 v = normalize(cameraPosition - vPosW);
	float lambert = max(dot(n, uSun), 0.0);
	// A little blue earthlight from below fills the shadow side.
	float earthlight = max(dot(n, vec3(0.0, -1.0, 0.0)), 0.0) * 0.12;
	float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.25;
	vec3 col = uColour * (lambert * 1.6 + 0.04) + vec3(0.35, 0.5, 0.8) * earthlight * uColour + rim * vec3(0.6, 0.75, 1.0) + uColour * uGlow;
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}
`;

function sunlit(colour: string, glow = 0) {
	return { uColour: { value: new Color(colour) }, uSun: { value: SUN }, uGlow: { value: glow } };
}

/** A meteor: a lumpy dark rock tumbling past outside, a few metres away, over about five seconds. */
function Meteor({ slow, onDone }: { slow: number; onDone: () => void }) {
	const rock = useRef<Mesh>(null);
	const t = useRef(0);
	const DURATION = 5.5 * slow;
	// Positions chosen to cross the viewport in the starting view (above Earth's limb).
	const start = new Vector3(-4.6, -1.1, -6.5);
	const end = new Vector3(1.0, -1.45, -6.2);

	const geometry = useMemo(() => {
		const g = new IcosahedronGeometry(0.24, 3);
		const rand = seededRandom('meteor');
		const pos = g.attributes.position as BufferAttribute;
		const v = new Vector3();
		// Lumpy: push each vertex in or out by a few smooth bumps.
		const bumps = Array.from({ length: 7 }, () => new Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize());
		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i);
			const d = v.clone().normalize();
			let k = 1;
			for (const b of bumps) k += 0.18 * Math.pow(Math.max(0, d.dot(b)), 3) - 0.06;
			v.multiplyScalar(k * (0.9 + rand() * 0.06));
			pos.setXYZ(i, v.x, v.y, v.z);
		}
		g.computeVertexNormals();
		return g;
	}, []);
	useEffect(() => () => geometry.dispose(), [geometry]);
	const uniforms = useMemo(() => sunlit('#8a7d70'), []);

	useFrame((_, delta) => {
		t.current += delta / DURATION;
		const r = rock.current;
		if (r) {
			r.position.lerpVectors(start, end, t.current);
			r.rotation.x += delta * 0.9;
			r.rotation.y += delta * 0.6;
		}
		if (t.current >= 1) onDone();
	});

	return (
		<mesh ref={rock} geometry={geometry} position={start}>
			<shaderMaterial vertexShader={SUNLIT_VERTEX} fragmentShader={SUNLIT_FRAGMENT} uniforms={uniforms} fog={false} />
		</mesh>
	);
}

/**
 * A rocket crossing outside: white body, black interstage band and fins, its engine burning with
 * a flickering flame and leaving a trail of exhaust that spreads and fades. About eight seconds.
 */
function Rocket({ slow, onDone }: { slow: number; onDone: () => void }) {
	const group = useRef<Group>(null);
	const flame = useRef<Mesh>(null);
	const trail = useRef<Points>(null);
	const t = useRef(0);
	const DURATION = 8 * slow;
	// Right to left across the viewport in the starting view, climbing a little.
	const start = useMemo(() => new Vector3(1.4, -2.15, -9), []);
	const end = useMemo(() => new Vector3(-6.2, -1.6, -9), []);
	const direction = useMemo(() => end.clone().sub(start).normalize(), [start, end]);

	// Exhaust: a ring buffer of particles left behind the engine, each with a birth time.
	const PARTICLES = 160;
	const trailGeometry = useMemo(() => {
		const g = new BufferGeometry();
		g.setAttribute('position', new BufferAttribute(new Float32Array(PARTICLES * 3).fill(9999), 3));
		g.setAttribute('aSize', new BufferAttribute(new Float32Array(PARTICLES), 1));
		g.setAttribute('aColour', new BufferAttribute(new Float32Array(PARTICLES * 3), 3));
		return g;
	}, []);
	useEffect(() => () => trailGeometry.dispose(), [trailGeometry]);
	const births = useRef(new Float32Array(PARTICLES).fill(-99));
	const drift = useRef(new Float32Array(PARTICLES * 3));
	const head = useRef(0);
	const emit = useRef(0);
	const rand = useMemo(() => seededRandom('rocket'), []);

	const white = useMemo(() => sunlit('#e8e8ea'), []);
	const black = useMemo(() => sunlit('#18181b'), []);

	useFrame(({ clock }, delta) => {
		t.current += delta / DURATION;
		const now = clock.elapsedTime;
		const g = group.current;
		if (!g) return;
		const p = new Vector3().lerpVectors(start, end, t.current);
		g.position.copy(p);
		if (flame.current) {
			const f = 0.85 + Math.sin(now * 40) * 0.08 + Math.sin(now * 23) * 0.06;
			flame.current.scale.set(1, f, 1);
		}
		// Emit exhaust from the nozzle (behind the rocket).
		const nozzle = p.clone().addScaledVector(direction, -0.26);
		emit.current += delta * 60;
		while (emit.current >= 1 && t.current < 1) {
			emit.current -= 1;
			const i = head.current;
			head.current = (head.current + 1) % PARTICLES;
			(trailGeometry.attributes.position as BufferAttribute).setXYZ(i, nozzle.x, nozzle.y, nozzle.z);
			births.current[i] = now;
			drift.current.set([(rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12], i * 3);
		}
		const position = trailGeometry.attributes.position as BufferAttribute;
		const size = trailGeometry.attributes.aSize as BufferAttribute;
		const colour = trailGeometry.attributes.aColour as BufferAttribute;
		for (let i = 0; i < PARTICLES; i++) {
			const age = now - births.current[i];
			if (age > 3) {
				colour.setXYZ(i, 0, 0, 0);
				continue;
			}
			position.setXYZ(i, position.getX(i) + drift.current[i * 3] * delta, position.getY(i) + drift.current[i * 3 + 1] * delta, position.getZ(i) + drift.current[i * 3 + 2] * delta);
			// Hot and orange at the nozzle, cooling to a faint grey plume.
			const hot = Math.max(0, 1 - age * 4);
			const fade = Math.max(0, 1 - age / 3);
			size.setX(i, 3 + age * 9);
			colour.setXYZ(i, (0.25 + hot * 2.2) * fade, (0.25 + hot * 1.1) * fade, (0.28 + hot * 0.3) * fade);
		}
		position.needsUpdate = size.needsUpdate = colour.needsUpdate = true;
		if (t.current >= 1.35) onDone();
	});

	// Point the rocket's nose (+y) along its path.
	const quaternion = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction), [direction]);

	return (
		<>
			<group ref={group} position={start}>
				<group quaternion={quaternion}>
					<mesh>
						<cylinderGeometry args={[0.035, 0.035, 0.36, 24]} />
						<shaderMaterial vertexShader={SUNLIT_VERTEX} fragmentShader={SUNLIT_FRAGMENT} uniforms={white} fog={false} />
					</mesh>
					<mesh position={[0, 0.06, 0]}>
						<cylinderGeometry args={[0.0355, 0.0355, 0.03, 24]} />
						<shaderMaterial vertexShader={SUNLIT_VERTEX} fragmentShader={SUNLIT_FRAGMENT} uniforms={black} fog={false} />
					</mesh>
					<mesh position={[0, 0.24, 0]}>
						<coneGeometry args={[0.035, 0.12, 24]} />
						<shaderMaterial vertexShader={SUNLIT_VERTEX} fragmentShader={SUNLIT_FRAGMENT} uniforms={white} fog={false} />
					</mesh>
					{[0, 1, 2, 3].map((i) => (
						<mesh key={i} position={[Math.sin((i * Math.PI) / 2) * 0.045, -0.15, Math.cos((i * Math.PI) / 2) * 0.045]} rotation={[0, (i * Math.PI) / 2, 0]}>
							<boxGeometry args={[0.004, 0.07, 0.03]} />
							<shaderMaterial vertexShader={SUNLIT_VERTEX} fragmentShader={SUNLIT_FRAGMENT} uniforms={black} fog={false} />
						</mesh>
					))}
					{/* The engine flame: a bright cone pointing back, flickering. */}
					<mesh ref={flame} position={[0, -0.24, 0]} rotation={[Math.PI, 0, 0]}>
						<coneGeometry args={[0.028, 0.14, 16]} />
						<meshBasicMaterial color={[6, 3.6, 1.6]} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
					</mesh>
				</group>
			</group>
			<points ref={trail} geometry={trailGeometry} frustumCulled={false}>
				<shaderMaterial vertexShader={STAR_VERTEX} fragmentShader={STAR_FRAGMENT} transparent depthWrite={false} blending={AdditiveBlending} fog={false} />
			</points>
		</>
	);
}
