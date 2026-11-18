import { PerspectiveCamera, Vector3 } from 'three';
import type { Framing } from './camera';

/*
 * Which side of its pin each place's name goes, so that no two names overlap and no name covers
 * another pin.
 *
 * The names are screen-space tags (Pins.tsx), so whether two collide depends on where they land
 * on screen. That's worked out for the starting view (where the pins are closest together: zooming
 * in only spreads them apart): each pin is projected through the starting camera, each name's tag
 * is sized from its length, and the sides are tried for each group of nearby pins, keeping the
 * arrangement with the least overlap (and the least off screen) and, among those, the most
 * natural sides (above, then beside, then the upper corners, then below). The West Coast trips (Portland, Northern California,
 * Southern Utah) sit within about 100 px of each other on a laptop screen, so this matters.
 *
 * The boxes match the .pin-label-* rules in desk.css.
 */

export type LabelSide = 'above' | 'right' | 'left' | 'above-right' | 'above-left' | 'below' | 'below-right' | 'below-left';

/** In order of preference, with a cost for each. */
const SIDES: [LabelSide, number][] = [
	['above', 0],
	['right', 1],
	['left', 1],
	['above-right', 2],
	['above-left', 2],
	['below', 3],
	['below-right', 4],
	['below-left', 4],
];

/** The label's anchor (where drei's <Html> puts its top left): this far above the pin's foot (m). */
export const LABEL_HEIGHT = 0.044;
/** Space kept clear around every tag (px). */
const GAP = 3;
/** A group bigger than this is placed one pin at a time instead of every combination being tried. */
const MAX_SEARCH = 7;

interface Box {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/** The tag's box for a side, around the anchor (ax, ay), for a tag w × h px. Mirrors desk.css. */
function tagBox(side: LabelSide, ax: number, ay: number, w: number, h: number): Box {
	// Beside: 10px off the anchor, raised 30% of the tag. Above: sitting on the anchor. Below: 34px
	// under it, clear of the pin. Corners: overlapping the anchor by 12px, so they still read as
	// the pin's.
	const [x0, y0] = (() => {
		switch (side) {
			case 'above':
				return [ax - w / 2, ay - h];
			case 'above-right':
				return [ax - 12, ay - h];
			case 'above-left':
				return [ax + 12 - w, ay - h];
			case 'right':
				return [ax + 10, ay - 0.3 * h];
			case 'left':
				return [ax - 10 - w, ay - 0.3 * h];
			case 'below':
				return [ax - w / 2, ay + 34];
			case 'below-right':
				return [ax - 12, ay + 34];
			case 'below-left':
				return [ax + 12 - w, ay + 34];
		}
	})();
	return { x0: x0 - GAP, y0: y0 - GAP, x1: x0 + w + GAP, y1: y0 + h + GAP };
}

function overlap(a: Box, b: Box) {
	const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
	const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
	return w > 0 && h > 0 ? w * h : 0;
}

/**
 * The side for each label, in order.
 * @param pins each pin's foot on the desk (world space) and its name
 * @param viewport the canvas size (CSS px)
 */
export function placeLabels(pins: { position: [number, number, number]; title: string }[], framing: Framing, viewport: { width: number; height: number }): LabelSide[] {
	const { width, height } = viewport;
	if (pins.length === 0 || width === 0 || height === 0) return pins.map(() => 'above');

	const camera = new PerspectiveCamera(framing.fov, width / height, 0.05, 200);
	camera.position.set(...framing.position);
	camera.lookAt(...framing.target);
	camera.updateMatrixWorld();
	const toScreen = (x: number, y: number, z: number) => {
		const v = new Vector3(x, y, z).project(camera);
		return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height];
	};

	// The tag's size: .pin-label's font size, letter spacing and padding (smaller on narrow screens).
	const narrow = width <= 640;
	const font = (narrow ? 0.6 : 0.66) * 16;
	const pad = (narrow ? 0.45 : 0.6) * 16;
	const tagHeight = narrow ? 23 : 26;

	const items = pins.map(({ position: [x, y, z], title }) => {
		const [ax, ay] = toScreen(x, y + LABEL_HEIGHT, z);
		const [, footY] = toScreen(x, y, z);
		return {
			ax,
			ay,
			w: title.length * font * 0.84 + 2 * pad,
			// The pin itself, from its head to its foot: a name mustn't cover another pin.
			pin: { x0: ax - 7, y0: ay, x1: ax + 7, y1: footY + 4 },
		};
	});
	const boxes = items.map(({ ax, ay, w }) => SIDES.map(([side]) => tagBox(side, ax, ay, w, tagHeight)));

	// How much tag i on side s overlaps tag j on side t...
	const clash = (i: number, s: number, j: number, t: number) => overlap(boxes[i][s], boxes[j][t]);
	// ...and how much of it covers other pins or falls off the screen.
	const screen = { x0: 0, y0: 0, x1: width, y1: height };
	const offScreen = (box: Box) => (box.x1 - box.x0) * (box.y1 - box.y0) - overlap(box, screen);
	const onPins = boxes.map((sides, i) => sides.map((box) => offScreen(box) + items.reduce((sum, item, j) => (j === i ? sum : sum + overlap(box, item.pin)), 0)));

	// Groups of pins whose tags could touch: only those need placing together.
	const reach = (i: number, j: number) => {
		const all = (k: number) => boxes[k].reduce((b, c) => ({ x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) }));
		return overlap(all(i), all(j)) > 0;
	};
	const group = items.map((_, i) => i);
	const find = (i: number): number => (group[i] === i ? i : (group[i] = find(group[i])));
	for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (reach(i, j)) group[find(i)] = find(j);

	const chosen = items.map(() => 0);
	const groups = new Map<number, number[]>();
	items.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));

	for (const members of groups.values()) {
		// Overlap counts far more than a less natural side.
		const cost = (i: number, s: number, placed: number[]) => onPins[i][s] * 1000 + SIDES[s][1] + placed.reduce((sum, j) => sum + clash(i, s, j, chosen[j]) * 1000, 0);

		if (members.length > MAX_SEARCH) {
			// Too many to try every combination: one at a time, each taking its best side.
			const placed: number[] = [];
			for (const i of members) {
				let best = 0;
				for (let s = 1; s < SIDES.length; s++) if (cost(i, s, placed) < cost(i, best, placed)) best = s;
				chosen[i] = best;
				placed.push(i);
			}
			continue;
		}

		// Every combination, depth first, abandoning a branch once it costs more than the best so far.
		let best = Infinity;
		let bestSides: number[] = [];
		const sides: number[] = [];
		const search = (k: number, total: number) => {
			if (total >= best) return;
			if (k === members.length) {
				best = total;
				bestSides = [...sides];
				return;
			}
			const i = members[k];
			for (let s = 0; s < SIDES.length; s++) {
				chosen[i] = s;
				sides.push(s);
				search(k + 1, total + cost(i, s, members.slice(0, k)));
				sides.pop();
			}
		};
		search(0, 0);
		members.forEach((i, k) => (chosen[i] = bestSides[k]));
	}

	return chosen.map((s) => SIDES[s][0]);
}
