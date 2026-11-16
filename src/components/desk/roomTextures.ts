
/*
 * Textures for the room around the desk, drawn on canvases.
 */

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
