import { CanvasTexture, SRGBColorSpace } from 'three';
import { seededRandom } from './polaroidTexture';

/*
 * Textures for the room around the desk, drawn on canvases.
 */

export interface NightView {
	sky: CanvasTexture;
	lights: CanvasTexture;
}

/**
 * The view through the window: mountains under a night sky. Stars and a moon; ridges fading into
 * the distance; one big snow-capped volcanic peak in moonlight (a nod to the Mount Shasta photo on
 * the portfolio); a dark pine treeline in front. Two layers so the few lights can be much brighter
 * than the rest: `sky` is an ordinary picture, `lights` is the stars and cabin lights alone on
 * black, drawn additively and far brighter than white, so bloom makes them glow and depth of field
 * turns them into soft bokeh.
 */
export function createMountainView(width: number): NightView {
	const height = Math.round(width / 2);
	const rand = seededRandom('mountains');
	const sky = document.createElement('canvas');
	const lights = document.createElement('canvas');
	sky.width = lights.width = width;
	sky.height = lights.height = height;
	const s = sky.getContext('2d');
	const l = lights.getContext('2d');
	if (!s || !l) throw new Error('2D canvas unavailable');
	const u = width / 2048;

	// Sky: near-black navy above, a cold blue glow toward the horizon.
	const g = s.createLinearGradient(0, 0, 0, height * 0.7);
	g.addColorStop(0, '#04060c');
	g.addColorStop(0.6, '#0b1424');
	g.addColorStop(1, '#1b2b44');
	s.fillStyle = g;
	s.fillRect(0, 0, width, height);

	// Stars: faint ones in the picture, a few bright ones on the lights layer.
	for (let i = 0; i < 700; i++) {
		const y = Math.pow(rand(), 1.4) * height * 0.62;
		s.fillStyle = `rgba(220, 230, 255, ${0.2 + rand() * 0.5})`;
		const r = (0.5 + rand() * 1.1) * u;
		s.fillRect(rand() * width, y, r, r);
	}
	for (let i = 0; i < 40; i++) {
		l.fillStyle = 'rgba(225, 235, 255, 1)';
		l.globalAlpha = 0.3 + rand() * 0.5;
		l.beginPath();
		l.arc(rand() * width, Math.pow(rand(), 1.3) * height * 0.55, (1 + rand() * 1.2) * u, 0, Math.PI * 2);
		l.fill();
	}
	l.globalAlpha = 1;

	// Moon, high left, with a halo.
	const mx = width * 0.2;
	const my = height * 0.16;
	const halo = s.createRadialGradient(mx, my, 0, mx, my, 160 * u);
	halo.addColorStop(0, 'rgba(200, 215, 255, 0.28)');
	halo.addColorStop(1, 'rgba(200, 215, 255, 0)');
	s.fillStyle = halo;
	s.fillRect(mx - 160 * u, my - 160 * u, 320 * u, 320 * u);
	s.fillStyle = '#eef1f8';
	s.beginPath();
	s.arc(mx, my, 20 * u, 0, Math.PI * 2);
	s.fill();

	/** A mountain ridge: a jagged line across the canvas, filled below. */
	const ridge = (base: number, amplitude: number, roughness: number, colour: string) => {
		s.fillStyle = colour;
		s.beginPath();
		s.moveTo(0, height);
		let y = base;
		for (let x = 0; x <= width; x += 8 * u) {
			y += (rand() - 0.5) * roughness * u;
			y = Math.min(base + amplitude, Math.max(base - amplitude, y));
			s.lineTo(x, y);
		}
		s.lineTo(width, height);
		s.closePath();
		s.fill();
	};
	ridge(height * 0.6, 60 * u, 26, '#1c2a40');
	ridge(height * 0.66, 50 * u, 30, '#15202f');

	// The peak: a broad volcanic cone with a snowcap catching the moon.
	const px = width * 0.62;
	const top = height * 0.3;
	const foot = height * 0.74;
	const halfBase = width * 0.32;
	const cone = () => {
		s.beginPath();
		s.moveTo(px - halfBase, foot);
		s.quadraticCurveTo(px - halfBase * 0.35, top + (foot - top) * 0.25, px - 18 * u, top);
		s.lineTo(px + 22 * u, top + 4 * u);
		s.quadraticCurveTo(px + halfBase * 0.4, top + (foot - top) * 0.3, px + halfBase, foot);
		s.closePath();
	};
	s.fillStyle = '#1a2535';
	cone();
	s.fill();
	// Snow: the upper part, with a ragged lower edge and dark gullies.
	s.save();
	cone();
	s.clip();
	const snow = s.createLinearGradient(px - 200 * u, top, px + 200 * u, top + 200 * u);
	snow.addColorStop(0, '#c9d6ea');
	snow.addColorStop(1, '#7f93b2');
	s.fillStyle = snow;
	s.beginPath();
	s.moveTo(px - halfBase, top);
	for (let x = px - halfBase; x <= px + halfBase; x += 10 * u) {
		const d = Math.abs(x - px) / halfBase;
		s.lineTo(x, top + (60 + (1 - d) * 120 + (rand() - 0.5) * 50) * u);
	}
	s.lineTo(px + halfBase, top);
	s.closePath();
	s.fill();
	s.strokeStyle = 'rgba(26, 37, 53, 0.7)';
	s.lineWidth = 3 * u;
	for (let i = 0; i < 9; i++) {
		const gx = px + (rand() - 0.5) * 240 * u;
		s.beginPath();
		s.moveTo(gx, top + 20 * u);
		s.lineTo(gx + (rand() - 0.5) * 60 * u, top + (140 + rand() * 80) * u);
		s.stroke();
	}
	s.restore();

	// Foreground: a dark treeline of pines, with a few cabin lights among them.
	const treeline = height * 0.78;
	s.fillStyle = '#05080d';
	s.fillRect(0, treeline, width, height - treeline);
	for (let x = 0; x < width; x += (6 + rand() * 10) * u) {
		const h = (30 + rand() * 80) * u;
		const w = h * (0.28 + rand() * 0.12);
		s.beginPath();
		s.moveTo(x - w / 2, treeline + 4 * u);
		s.lineTo(x, treeline - h);
		s.lineTo(x + w / 2, treeline + 4 * u);
		s.fill();
	}
	for (let i = 0; i < 9; i++) {
		l.fillStyle = 'rgba(255, 200, 130, 1)';
		l.globalAlpha = 0.5 + rand() * 0.5;
		l.fillRect(rand() * width, treeline + (10 + rand() * 60) * u, 3 * u, 2.4 * u);
	}

	const skyTexture = new CanvasTexture(sky);
	skyTexture.colorSpace = SRGBColorSpace;
	const lightsTexture = new CanvasTexture(lights);
	lightsTexture.colorSpace = SRGBColorSpace;
	return { sky: skyTexture, lights: lightsTexture };
}

/**
 * A terminal session on the shelf monitor, drawn on a canvas that's redrawn to blink the cursor.
 * The lines are real: `uname -s` (it's Linux) and `ls trips/` listing the trips on the desk.
 */
export function drawTerminal(canvas: HTMLCanvasElement, tripSlugs: string[], cursorOn: boolean) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const { width, height } = canvas;
	const u = width / 640;
	ctx.fillStyle = '#0b0e13';
	ctx.fillRect(0, 0, width, height);
	ctx.font = `500 ${18 * u}px ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace`;
	ctx.textBaseline = 'top';
	const prompt = (y: number, command: string) => {
		let x = 18 * u;
		for (const [text, colour] of [
			['aaron@atlas', '#7fd88f'],
			[':', '#e6e6e6'],
			['~', '#8aa8ff'],
			[`$ ${command}`, '#e6e6e6'],
		] as const) {
			ctx.fillStyle = colour;
			ctx.fillText(text, x, y);
			x += ctx.measureText(text).width;
		}
		return x;
	};
	const line = 30 * u;
	let y = 20 * u;
	prompt(y, 'uname -s');
	y += line;
	ctx.fillStyle = '#d0d0d0';
	ctx.fillText('Linux', 18 * u, y);
	y += line;
	prompt(y, 'ls trips/');
	y += line;
	ctx.fillStyle = '#8aa8ff';
	ctx.fillText(tripSlugs.join('  '), 18 * u, y);
	y += line;
	const end = prompt(y, '');
	if (cursorOn) {
		ctx.fillStyle = '#e6e6e6';
		ctx.fillRect(end + 2 * u, y, 10 * u, 20 * u);
	}
	// Faint scanline sheen.
	ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
	for (let sy = 0; sy < height; sy += 4 * u) ctx.fillRect(0, sy, width, 1.5 * u);
}

/** Dark book cloth: blacks, charcoals, navy, olive, a little brown and tan, one red. */
export const BOOK_COLOURS = [
	'#151619',
	'#1b1d21',
	'#22252b',
	'#2a2e35',
	'#1a2233',
	'#1e2a3d',
	'#26301f',
	'#30382a',
	'#3a2c22',
	'#5a5f68',
	'#7a6a52',
	'#6e2620',
];
