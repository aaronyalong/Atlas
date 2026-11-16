import { CanvasTexture, SRGBColorSpace } from 'three';
import { CAPTION_FONT_FAMILY, seededRandom } from './polaroidTexture';

/*
 * Textures for the desk props, drawn on 2D canvases like the polaroids. Nothing printed on them
 * claims anything about a real trip: the tickets have their field labels and blank lines, the
 * passport has generic gold-foil lettering and no country's emblem.
 */

function makeCanvas(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('2D canvas unavailable');
	return { canvas, ctx };
}

/** Colour textures are sRGB; masks (alpha, roughness) hold data and stay linear. */
function toTexture(canvas: HTMLCanvasElement, colour = true) {
	const texture = new CanvasTexture(canvas);
	if (colour) texture.colorSpace = SRGBColorSpace;
	return texture;
}

/** Passport: 88 × 125 mm. */
export const PASSPORT_SIZE = { width: 0.088, length: 0.125 } as const;

/**
 * The passport's gold foil, as a mask: white where there's foil. It's used as the alpha map of a
 * thin metallic layer laid on the leather cover, so the foil is real metal under the lamp.
 */
export function createPassportFoil(width: number): CanvasTexture {
	const height = Math.round((width * PASSPORT_SIZE.length) / PASSPORT_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 88; // px per mm
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = '#fff';
	ctx.strokeStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	// Title, letter-spaced.
	ctx.font = `700 ${7.5 * u}px Georgia, 'Times New Roman', serif`;
	ctx.letterSpacing = `${1.6 * u}px`;
	ctx.fillText('PASSPORT', width / 2 + 0.8 * u, 24 * u);

	// A plain globe: outline, three parallels, three meridians.
	const cx = width / 2;
	const cy = 64 * u;
	const r = 17 * u;
	ctx.lineWidth = 1.1 * u;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	for (const k of [-0.5, 0, 0.5]) {
		ctx.beginPath();
		const y = cy + k * r;
		const half = Math.sqrt(1 - k * k) * r;
		ctx.moveTo(cx - half, y);
		ctx.lineTo(cx + half, y);
		ctx.stroke();
	}
	for (const k of [0.35, 0.75]) {
		ctx.beginPath();
		ctx.ellipse(cx, cy, r * k, r, 0, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.moveTo(cx, cy - r);
	ctx.lineTo(cx, cy + r);
	ctx.stroke();

	// The biometric-passport symbol (a chip outline), near the bottom.
	const w = 9 * u;
	const h = 6 * u;
	const top = 104 * u;
	ctx.lineWidth = 0.9 * u;
	ctx.strokeRect(cx - w / 2, top, w, h);
	ctx.beginPath();
	ctx.arc(cx, top + h / 2, 1.8 * u, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx - w / 2, top + h / 2);
	ctx.lineTo(cx - 1.8 * u, top + h / 2);
	ctx.moveTo(cx + 1.8 * u, top + h / 2);
	ctx.lineTo(cx + w / 2, top + h / 2);
	ctx.stroke();

	return toTexture(canvas, false);
}

/** A passport page: pale security print (fine guilloche waves) and a page number. */
export function createPassportPage(width: number, pageNumber: number): CanvasTexture {
	const height = Math.round((width * PASSPORT_SIZE.length) / PASSPORT_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 88;
	ctx.fillStyle = '#ece8d6';
	ctx.fillRect(0, 0, width, height);
	ctx.lineWidth = 0.18 * u;
	for (let i = 0; i < 46; i++) {
		ctx.strokeStyle = i % 2 ? 'rgba(80, 130, 120, 0.22)' : 'rgba(150, 110, 150, 0.16)';
		ctx.beginPath();
		const base = (i / 46) * height;
		for (let x = 0; x <= width; x += u) {
			const y = base + Math.sin((x / width) * Math.PI * 6 + i * 0.5) * 3.5 * u + Math.sin((x / width) * Math.PI * 17 + i) * 0.8 * u;
			if (x === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();
	}
	ctx.fillStyle = 'rgba(60, 70, 80, 0.7)';
	ctx.font = `600 ${4 * u}px ui-monospace, Menlo, Consolas, monospace`;
	ctx.textAlign = 'right';
	ctx.fillText(String(pageNumber), width - 5 * u, height - 5 * u);
	return toTexture(canvas);
}

/** Journal: an A5-ish notebook, 150 × 210 mm. */
export const JOURNAL_SIZE = { width: 0.15, length: 0.21 } as const;

/** The journal's first page: ruled lines, a margin rule, and "Travel journal" in handwriting. */
export function createJournalPage(width: number): CanvasTexture {
	const height = Math.round((width * JOURNAL_SIZE.length) / JOURNAL_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 150;
	ctx.fillStyle = '#f6f0e1';
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = 'rgba(70, 110, 170, 0.28)';
	ctx.lineWidth = 0.3 * u;
	for (let y = 28 * u; y < height - 8 * u; y += 7 * u) {
		ctx.beginPath();
		ctx.moveTo(8 * u, y);
		ctx.lineTo(width - 8 * u, y);
		ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(200, 80, 80, 0.35)';
	ctx.beginPath();
	ctx.moveTo(24 * u, 0);
	ctx.lineTo(24 * u, height);
	ctx.stroke();
	ctx.fillStyle = 'rgba(42, 38, 34, 0.88)';
	ctx.font = `600 ${15 * u}px ${CAPTION_FONT_FAMILY}, cursive`;
	ctx.textAlign = 'left';
	ctx.save();
	ctx.translate(30 * u, 19 * u);
	ctx.rotate(-0.02);
	ctx.fillText('Travel journal', 0, 0);
	ctx.restore();
	return toTexture(canvas);
}

/** The edge of a stack of pages: fine horizontal lines on cream. */
export function createPageEdges(): CanvasTexture {
	const { canvas, ctx } = makeCanvas(64, 256);
	ctx.fillStyle = '#efe7d3';
	ctx.fillRect(0, 0, 64, 256);
	const rand = seededRandom('page-edges');
	for (let y = 0; y < 256; y += 2) {
		ctx.fillStyle = `rgba(120, 100, 70, ${0.08 + rand() * 0.12})`;
		ctx.fillRect(0, y, 64, 1);
	}
	return toTexture(canvas);
}

/** Boarding pass: 200 × 80 mm. */
export const BOARDING_PASS_SIZE = { width: 0.2, length: 0.08 } as const;

/** A generic boarding pass: header band, field labels with blank lines, a barcode, a stub. */
export function createBoardingPass(width: number): CanvasTexture {
	const height = Math.round((width * BOARDING_PASS_SIZE.length) / BOARDING_PASS_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 200;
	const rand = seededRandom('boarding-pass');
	const stubX = 146 * u;

	ctx.fillStyle = '#f7f4ec';
	ctx.fillRect(0, 0, width, height);

	// Header band, in the portfolio's accent blue.
	ctx.fillStyle = '#2f5bd3';
	ctx.fillRect(0, 0, width, 14 * u);
	ctx.fillStyle = '#fff';
	ctx.font = `700 ${6 * u}px system-ui, sans-serif`;
	ctx.letterSpacing = `${1.2 * u}px`;
	ctx.textBaseline = 'middle';
	ctx.fillText('BOARDING PASS', 8 * u, 7 * u);
	ctx.font = `700 ${4.2 * u}px system-ui, sans-serif`;
	ctx.fillText('BOARDING PASS', stubX + 6 * u, 7 * u);

	// Fields: label above a blank line.
	const field = (label: string, x: number, y: number, w: number) => {
		ctx.fillStyle = 'rgba(60, 60, 70, 0.75)';
		ctx.font = `600 ${3 * u}px system-ui, sans-serif`;
		ctx.letterSpacing = `${0.5 * u}px`;
		ctx.fillText(label, x, y);
		ctx.strokeStyle = 'rgba(60, 60, 70, 0.35)';
		ctx.lineWidth = 0.3 * u;
		ctx.beginPath();
		ctx.moveTo(x, y + 9 * u);
		ctx.lineTo(x + w, y + 9 * u);
		ctx.stroke();
	};
	field('PASSENGER', 8 * u, 22 * u, 80 * u);
	field('FROM', 8 * u, 38 * u, 36 * u);
	field('TO', 52 * u, 38 * u, 36 * u);
	field('FLIGHT', 96 * u, 22 * u, 40 * u);
	field('GATE', 96 * u, 38 * u, 16 * u);
	field('SEAT', 120 * u, 38 * u, 16 * u);
	field('SEAT', stubX + 6 * u, 22 * u, 40 * u);
	field('GATE', stubX + 6 * u, 38 * u, 40 * u);

	// Barcodes: bars of random widths.
	const barcode = (x: number, y: number, w: number, h: number) => {
		ctx.fillStyle = 'rgba(30, 30, 35, 0.85)';
		let cx = x;
		while (cx < x + w) {
			const bar = (0.3 + rand() * 1.1) * u;
			if (rand() > 0.35) ctx.fillRect(cx, y, bar, h);
			cx += bar + (0.3 + rand() * 0.6) * u;
		}
	};
	barcode(8 * u, 56 * u, 128 * u, 16 * u);
	barcode(stubX + 6 * u, 56 * u, 42 * u, 16 * u);

	// Perforation between pass and stub.
	ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
	for (let y = 2 * u; y < height; y += 3 * u) ctx.fillRect(stubX - 0.4 * u, y, 0.8 * u, 1.4 * u);

	return toTexture(canvas);
}

/** Train ticket: 110 × 55 mm. */
export const TRAIN_TICKET_SIZE = { width: 0.11, length: 0.055 } as const;

/**
 * A generic rail ticket on salmon card stock, with a conductor's punch hole. The hole is
 * transparent: the material uses alphaTest, so you see (and the lamp shines through) the desk.
 */
export function createTrainTicket(width: number): CanvasTexture {
	const height = Math.round((width * TRAIN_TICKET_SIZE.length) / TRAIN_TICKET_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 110;
	ctx.fillStyle = '#e8c9a7';
	ctx.fillRect(0, 0, width, height);
	// Fine security pattern.
	ctx.strokeStyle = 'rgba(160, 90, 60, 0.18)';
	ctx.lineWidth = 0.2 * u;
	for (let x = -height; x < width; x += 2 * u) {
		ctx.beginPath();
		ctx.moveTo(x, height);
		ctx.lineTo(x + height, 0);
		ctx.stroke();
	}
	ctx.fillStyle = 'rgba(90, 40, 30, 0.85)';
	ctx.textBaseline = 'middle';
	ctx.font = `800 ${6 * u}px system-ui, sans-serif`;
	ctx.letterSpacing = `${1 * u}px`;
	ctx.fillText('RAIL TICKET', 6 * u, 9 * u);
	ctx.font = `600 ${3 * u}px system-ui, sans-serif`;
	ctx.letterSpacing = `${0.5 * u}px`;
	for (const [label, x, y] of [
		['FROM', 6, 22],
		['TO', 6, 34],
		['CLASS', 62, 22],
		['VALID', 62, 34],
	] as const) {
		ctx.fillText(label, x * u, y * u);
		ctx.strokeStyle = 'rgba(90, 40, 30, 0.35)';
		ctx.beginPath();
		ctx.moveTo((x + 12) * u, (y + 1) * u);
		ctx.lineTo((x + 40) * u, (y + 1) * u);
		ctx.stroke();
	}
	ctx.font = `700 ${3.4 * u}px system-ui, sans-serif`;
	ctx.fillText('ADMIT ONE', 6 * u, 47 * u);
	punchHole(ctx, 96 * u, 44 * u, 3.2 * u);
	return toTexture(canvas);
}

/**
 * The back of the rail ticket: plain card, a line of small print, and the same punch hole. Turning
 * the ticket over mirrors it top to bottom, so the hole is drawn mirrored to line up.
 */
export function createTrainTicketBack(width: number): CanvasTexture {
	const height = Math.round((width * TRAIN_TICKET_SIZE.length) / TRAIN_TICKET_SIZE.width);
	const { canvas, ctx } = makeCanvas(width, height);
	const u = width / 110;
	ctx.fillStyle = '#e2c3a1';
	ctx.fillRect(0, 0, width, height);
	ctx.fillStyle = 'rgba(90, 40, 30, 0.5)';
	ctx.font = `500 ${2.4 * u}px system-ui, sans-serif`;
	ctx.textBaseline = 'middle';
	for (let i = 0; i < 4; i++) ctx.fillRect(8 * u, (16 + i * 6) * u, (72 - i * 9) * u, 0.5 * u);
	ctx.fillText('Not transferable. Keep this ticket for inspection.', 8 * u, 46 * u);
	punchHole(ctx, 96 * u, height - 44 * u, 3.2 * u);
	return toTexture(canvas);
}

/** Cuts a round hole through the card (transparent pixels; the material's alphaTest drops them). */
function punchHole(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
	ctx.globalCompositeOperation = 'destination-out';
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
}
