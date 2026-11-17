import { Html, RoundedBox, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, MathUtils, SRGBColorSpace, type Group, type MeshStandardMaterial } from 'three';
import { wake } from './pacing';
import { OPENING, WALL_Z } from './roomLayout';
import type { DeskTrip } from './types';
import { BRASS, BRONZE } from './Viewport';

/*
 * The gauge panel: an art deco bronze plate on the wall to the right of the viewport, with five
 * brass-bezelled instruments stacked down it, their ivory dials softly lit from behind.
 *
 * Two modes, swapped with a click:
 *   - Station: the top dial is a clock showing the visitor's own time; the other four are the
 *     station's instruments (cabin temperature, oxygen, altitude, speed), their needles
 *     trembling a little as real ones do.
 *   - World time: all five become clocks showing the time now at each trip's place (from the
 *     trips' `timeZone`).
 * Switching, the needles spin round several times and the backlights flicker as the dials change
 * over, one gauge after another. For visitors who ask for less motion, they just change.
 *
 * Dials are drawn on canvases (one per dial, per mode); the hands are thin boxes turned each frame.
 */

/** Where the panel hangs: right of the window, low enough to stay clear of the page's top bar. */
const PANEL_X = OPENING.right + 0.28;
const PANEL_Z = WALL_Z + 0.02;
/** The gauges' centres, top to bottom, and their size. */
const CENTRES = [0.59, 0.47, 0.35, 0.23, 0.11];
const RADIUS = 0.048;
const DIAL_PX = 512;
/** Seconds for the change-over (the last gauge starts a little after the first). */
const SWITCH = 1.6;

type Dial =
	| { kind: 'clock'; label: string; zone: string | null }
	| { kind: 'meter'; label: string; unit: string; min: number; max: number; value: number; wobble: number; majors: number };

const STATION: Dial[] = [
	{ kind: 'clock', label: 'Local time', zone: null },
	{ kind: 'meter', label: 'Cabin', unit: '°C', min: 0, max: 40, value: 21.5, wobble: 0.25, majors: 4 },
	{ kind: 'meter', label: 'Oxygen', unit: '%', min: 0, max: 30, value: 20.9, wobble: 0.12, majors: 3 },
	{ kind: 'meter', label: 'Altitude', unit: 'km', min: 300, max: 500, value: 408, wobble: 1.2, majors: 4 },
	{ kind: 'meter', label: 'Velocity', unit: 'km/s', min: 7, max: 8, value: 7.66, wobble: 0.008, majors: 5 },
];

/* ---------- Time ---------- */

const formatters = new Map<string, Intl.DateTimeFormat>();
/** The wall-clock time in a time zone (or here, for null) as hours, minutes, seconds. */
function clockIn(zone: string | null, now: Date): { h: number; m: number; s: number } {
	if (!zone) return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
	let f = formatters.get(zone);
	if (!f) {
		f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });
		formatters.set(zone, f);
	}
	const part = (type: string) => Number(f!.formatToParts(now).find((p) => p.type === type)?.value ?? 0);
	return { h: part('hour'), m: part('minute'), s: part('second') };
}

/* ---------- Dials ---------- */

const NUMERAL_FONT = "'Bodoni 72', Didot, 'Playfair Display', Georgia, serif";
const LABEL_FONT = "'Josefin Sans', Futura, 'Century Gothic', Avenir, sans-serif";

/** Draws a dial face: ivory enamel, a gold ring, ticks and numerals in deco type, and its label. */
function drawDial(canvas: HTMLCanvasElement, dial: Dial, meridiem: string) {
	const ctx = canvas.getContext('2d')!;
	const size = canvas.width;
	const c = size / 2;
	const r = size / 2;
	ctx.clearRect(0, 0, size, size);

	// Enamel, aged a little toward the rim.
	const face = ctx.createRadialGradient(c, c * 0.92, 0, c, c, r);
	face.addColorStop(0, '#f7efdc');
	face.addColorStop(0.75, '#ebdfc0');
	face.addColorStop(1, '#cdb88a');
	ctx.fillStyle = face;
	ctx.beginPath();
	ctx.arc(c, c, r, 0, Math.PI * 2);
	ctx.fill();

	// Rings: gold, then a fine dark line inside it.
	ctx.lineWidth = r * 0.035;
	ctx.strokeStyle = '#a67b33';
	ctx.beginPath();
	ctx.arc(c, c, r * 0.93, 0, Math.PI * 2);
	ctx.stroke();
	ctx.lineWidth = r * 0.008;
	ctx.strokeStyle = '#2a2318';
	ctx.beginPath();
	ctx.arc(c, c, r * 0.885, 0, Math.PI * 2);
	ctx.stroke();

	const ink = '#1d1a14';
	const tick = (angle: number, r0: number, r1: number, width: number, colour = ink) => {
		ctx.strokeStyle = colour;
		ctx.lineWidth = width;
		ctx.beginPath();
		ctx.moveTo(c + Math.cos(angle) * r0, c + Math.sin(angle) * r0);
		ctx.lineTo(c + Math.cos(angle) * r1, c + Math.sin(angle) * r1);
		ctx.stroke();
	};
	const text = (s: string, x: number, y: number, font: string, colour = ink, maxWidth = r * 1.15) => {
		ctx.fillStyle = colour;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		let px = Number(/(\d+(\.\d+)?)px/.exec(font)?.[1] ?? 20);
		ctx.font = font;
		while (ctx.measureText(s).width > maxWidth && px > 8) {
			px -= 1;
			ctx.font = font.replace(/\d+(\.\d+)?px/, `${px}px`);
		}
		ctx.fillText(s, x, y);
	};
	const spaced = (s: string) => s.toUpperCase().split('').join(' ');

	if (dial.kind === 'clock') {
		for (let i = 0; i < 60; i++) {
			const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
			if (i % 5) tick(a, r * 0.86, r * 0.81, r * 0.008);
			else tick(a, r * 0.86, r * (i % 15 ? 0.76 : 0.72), r * (i % 15 ? 0.02 : 0.03));
		}
		[
			['12', 0],
			['3', 3],
			['6', 6],
			['9', 9],
		].forEach(([n, h]) => {
			const a = ((h as number) / 12) * Math.PI * 2 - Math.PI / 2;
			text(n as string, c + Math.cos(a) * r * 0.56, c + Math.sin(a) * r * 0.56, `700 ${r * 0.22}px ${NUMERAL_FONT}`);
		});
		text(meridiem, c, c - r * 0.3, `700 ${r * 0.11}px ${LABEL_FONT}`, '#5a4a2c');
		text(spaced(dial.label), c, c + r * 0.32, `700 ${r * 0.13}px ${LABEL_FONT}`);
	} else {
		// A 270° scale from lower left, round over the top, to lower right.
		const start = Math.PI * 0.75;
		const sweep = Math.PI * 1.5;
		const minors = dial.majors * 5;
		// The red zone at the top of the scale.
		ctx.strokeStyle = '#9b3322';
		ctx.lineWidth = r * 0.05;
		ctx.beginPath();
		ctx.arc(c, c, r * 0.8, start + sweep * 0.85, start + sweep);
		ctx.stroke();
		for (let i = 0; i <= minors; i++) {
			const a = start + (i / minors) * sweep;
			if (i % 5) tick(a, r * 0.86, r * 0.8, r * 0.008);
			else tick(a, r * 0.86, r * 0.72, r * 0.022);
		}
		for (let i = 0; i <= dial.majors; i++) {
			const a = start + (i / dial.majors) * sweep;
			const v = dial.min + ((dial.max - dial.min) * i) / dial.majors;
			text(String(Number(v.toFixed(1))), c + Math.cos(a) * r * 0.57, c + Math.sin(a) * r * 0.57, `700 ${r * 0.15}px ${NUMERAL_FONT}`, ink, r * 0.42);
		}
		text(dial.unit, c, c + r * 0.3, `700 ${r * 0.13}px ${NUMERAL_FONT}`, '#5a4a2c');
		text(spaced(dial.label), c, c + r * 0.55, `700 ${r * 0.13}px ${LABEL_FONT}`);
	}
}

/** A dial's canvas texture, redrawn when what it shows changes (the clock's AM/PM). */
function makeDialTexture(dial: Dial, meridiem: string): CanvasTexture {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = DIAL_PX;
	drawDial(canvas, dial, meridiem);
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

/* ---------- The panel ---------- */

interface GaugePanelProps {
	trips: DeskTrip[];
	reducedMotion: boolean;
}

export function GaugePanel({ trips, reducedMotion }: GaugePanelProps) {
	const [world, setWorld] = useState(false);
	const [hovered, setHovered] = useState(false);
	useCursor(hovered);

	// World time: a clock for each trip with a time zone (the first five); any spare dials show
	// the visitor's own time.
	const worldDials = useMemo<Dial[]>(() => {
		const clocks: Dial[] = trips.filter((t) => t.timeZone).slice(0, 5).map((t) => ({ kind: 'clock', label: t.title, zone: t.timeZone }));
		while (clocks.length < 5) clocks.push({ kind: 'clock', label: 'Local time', zone: null });
		return clocks;
	}, [trips]);
	const modes = useMemo(() => [STATION, worldDials], [worldDials]);

	// Textures: [mode][gauge]. Clocks are redrawn when their AM/PM changes.
	const textures = useMemo(() => modes.map((dials) => dials.map((d) => ({ texture: makeDialTexture(d, ''), meridiem: '' }))), [modes]);
	useEffect(() => () => textures.flat().forEach((t) => t.texture.dispose()), [textures]);
	// A canvas draws with whatever fonts are loaded at the time; once Josefin Sans has arrived,
	// draw every dial again in it.
	useEffect(() => {
		let live = true;
		document.fonts.load(`700 20px 'Josefin Sans'`).then(() => {
			if (!live) return;
			textures.forEach((dials, mode) =>
				dials.forEach((slot, i) => {
					drawDial(slot.texture.image as HTMLCanvasElement, modes[mode][i], slot.meridiem);
					slot.texture.needsUpdate = true;
				}),
			);
		});
		return () => {
			live = false;
		};
	}, [textures, modes]);

	// Per gauge: which mode its dial currently shows (they change over one by one), its parts.
	const shown = useRef<number[]>([0, 0, 0, 0, 0]);
	const switchStart = useRef<number | null>(null);
	const dialMaterials = useRef<(MeshStandardMaterial | null)[]>([]);
	const hands = useRef<{ hour: Group | null; minute: Group | null; second: Group | null; needle: Group | null }[]>(CENTRES.map(() => ({ hour: null, minute: null, second: null, needle: null })));

	const toggle = () => {
		setWorld((w) => !w);
		switchStart.current = reducedMotion ? -Infinity : performance.now() / 1000;
	};

	useFrame(({ clock }) => {
		const now = new Date();
		const t = clock.elapsedTime;
		const wanted = world ? 1 : 0;
		const since = switchStart.current === null ? Infinity : performance.now() / 1000 - switchStart.current;
		// Switching modes: the spin and the flicker run at the full frame rate.
		if (since < SWITCH + 0.6) wake();

		CENTRES.forEach((_, i) => {
			// This gauge's part of the change-over: 0 → 1, staggered down the panel.
			const k = MathUtils.clamp((since - i * 0.12) / (SWITCH - 0.48), 0, 1);
			if (k >= 0.4 && shown.current[i] !== wanted) shown.current[i] = wanted;
			const mode = shown.current[i];
			const dial = modes[mode][i];
			const slot = textures[mode][i];

			// Clock faces: redraw when AM/PM changes.
			const time = dial.kind === 'clock' ? clockIn(dial.zone, now) : null;
			if (time) {
				const meridiem = time.h < 12 ? 'AM' : 'PM';
				if (slot.meridiem !== meridiem) {
					drawDial(slot.texture.image as HTMLCanvasElement, dial, meridiem);
					slot.texture.needsUpdate = true;
					slot.meridiem = meridiem;
				}
			}
			const material = dialMaterials.current[i];
			if (material) {
				if (material.map !== slot.texture) {
					material.map = slot.texture;
					material.emissiveMap = slot.texture;
					material.needsUpdate = true;
				}
				// The backlight stutters as the dial changes over, like an old instrument's bulb.
				const flicker = k > 0.25 && k < 0.6 ? 0.15 + 0.6 * Math.abs(Math.sin(t * 47 + i * 3)) : 1;
				material.emissiveIntensity = 0.55 * flicker;
			}

			// The spin: three fast turns (six and nine for the minute and second hands), slowing to a
			// stop on the new reading. Whole turns, so a gauge that hasn't started yet doesn't jump.
			const spin = (1 - k) ** 3 * Math.PI * 2 * 3;
			const h = hands.current[i];
			if (time) {
				const hour = (((time.h % 12) + time.m / 60) / 12) * Math.PI * 2;
				const minute = ((time.m + time.s / 60) / 60) * Math.PI * 2;
				const second = (time.s / 60) * Math.PI * 2;
				if (h.hour) h.hour.rotation.z = -hour - spin;
				if (h.minute) h.minute.rotation.z = -minute - spin * 2;
				if (h.second) h.second.rotation.z = -second - spin * 3;
			} else if (dial.kind === 'meter' && h.needle) {
				const v = dial.value + dial.wobble * (Math.sin(t * 0.7 + i * 1.3) + 0.5 * Math.sin(t * 2.9 + i * 4.1));
				const f = MathUtils.clamp((v - dial.min) / (dial.max - dial.min), 0, 1);
				// 0 → lower left (135° on the dial), 1 → lower right, clockwise over the top.
				h.needle.rotation.z = Math.PI * 0.75 - f * Math.PI * 1.5 - spin * 2;
			}
			if (h.hour) h.hour.visible = !!time;
			if (h.minute) h.minute.visible = !!time;
			if (h.second) h.second.visible = !!time;
			if (h.needle) h.needle.visible = !time;
		});
	});

	const plateHeight = CENTRES[0] - CENTRES[4] + RADIUS * 2 + 0.05;
	const plateY = (CENTRES[0] + CENTRES[4]) / 2;
	const plateTop = plateY + plateHeight / 2;

	return (
		<group
			position={[PANEL_X, 0, PANEL_Z]}
			onPointerOver={(e: ThreeEvent<PointerEvent>) => {
				e.stopPropagation();
				setHovered(true);
			}}
			onPointerOut={() => setHovered(false)}
			onClick={(e: ThreeEvent<MouseEvent>) => {
				e.stopPropagation();
				if (e.delta <= 4) toggle();
			}}
		>
			{/* The plate: bronze, with brass pinstripes down its edges and a stepped crown and foot. */}
			<RoundedBox args={[0.15, plateHeight, 0.014]} radius={0.005} smoothness={2} position={[0, plateY, 0.007]} material={BRONZE} castShadow receiveShadow />
			{[-1, 1].map((s) => (
				<mesh key={s} position={[s * 0.066, plateY, 0.0145]} material={BRASS}>
					<boxGeometry args={[0.004, plateHeight - 0.02, 0.003]} />
				</mesh>
			))}
			{[
				[0.11, 0.022],
				[0.07, 0.02],
				[0.03, 0.018],
			].map(([w, hgt], i, steps) => {
				const y = plateTop + steps.slice(0, i).reduce((sum, [, sh]) => sum + sh, 0) + hgt / 2;
				return <RoundedBox key={i} args={[w, hgt, 0.012]} radius={0.003} smoothness={2} position={[0, y, 0.006]} material={i % 2 ? BRONZE : BRASS} />;
			})}
			<RoundedBox args={[0.11, 0.016, 0.012]} radius={0.003} smoothness={2} position={[0, plateY - plateHeight / 2 - 0.008, 0.006]} material={BRASS} />

			{CENTRES.map((y, i) => (
				<group key={i} position={[0, y, 0.014]}>
					{/* Brass cup and bezel. */}
					<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.006]} material={BRASS}>
						<cylinderGeometry args={[RADIUS, RADIUS, 0.012, 48, 1, true]} />
					</mesh>
					<mesh position={[0, 0, 0.012]} material={BRASS}>
						<torusGeometry args={[RADIUS - 0.002, 0.005, 12, 48]} />
					</mesh>
					{/* The dial, lit from behind. */}
					<mesh position={[0, 0, 0.004]}>
						<circleGeometry args={[RADIUS - 0.004, 48]} />
						<meshStandardMaterial
							ref={(m) => {
								dialMaterials.current[i] = m;
							}}
							map={textures[0][i].texture}
							emissiveMap={textures[0][i].texture}
							emissive="#ffcf8f"
							emissiveIntensity={0.55}
							roughness={0.55}
						/>
					</mesh>
					{/* Hands: blackened steel, a red second hand, a brass cap. */}
					<Hand ref={(g) => (hands.current[i].hour = g)} length={0.024} width={0.0042} tail={0.005} z={0.006} colour="#15130f" />
					<Hand ref={(g) => (hands.current[i].minute = g)} length={0.036} width={0.003} tail={0.006} z={0.0072} colour="#15130f" />
					<Hand ref={(g) => (hands.current[i].second = g)} length={0.039} width={0.0011} tail={0.011} z={0.0084} colour="#8f2a1c" />
					<Hand ref={(g) => (hands.current[i].needle = g)} length={0.037} width={0.0026} tail={0.008} z={0.0072} colour="#15130f" />
					<mesh position={[0, 0, 0.0095]} rotation={[Math.PI / 2, 0, 0]} material={BRASS}>
						<cylinderGeometry args={[0.0035, 0.0035, 0.003, 16]} />
					</mesh>
					{/* Glass. */}
					<mesh position={[0, 0, 0.0125]}>
						<circleGeometry args={[RADIUS - 0.003, 48]} />
						<meshStandardMaterial color="#ffffff" transparent opacity={0.07} roughness={0.15} metalness={0} depthWrite={false} />
					</mesh>
				</group>
			))}

			{hovered && (
				<Html position={[0, plateTop + 0.12, 0.02]} center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}>
					<span className="deco-tag desk-label">{world ? 'World time: click for the station’s gauges' : 'Station gauges: click for world time'}</span>
				</Html>
			)}
		</group>
	);
}

/** A hand or needle: a thin box turning about the dial's centre (pointing up at rotation 0). */
function Hand({ ref, length, width, tail, z, colour }: { ref: (g: Group | null) => void; length: number; width: number; tail: number; z: number; colour: string }) {
	return (
		<group ref={ref} position={[0, 0, z]}>
			<mesh position={[0, (length - tail) / 2, 0]}>
				<boxGeometry args={[width, length + tail, 0.001]} />
				<meshStandardMaterial color={colour} metalness={0.6} roughness={0.4} />
			</mesh>
		</group>
	);
}
