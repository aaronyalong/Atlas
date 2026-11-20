import type { ReactNode } from 'react';
import type { EmblemName } from '../../lib/emblems';

/*
 * The picture on a trip's boarding pass: a small deco scene of the place, in the map's colours
 * (navy sky, gold lines, cream for whatever is nearest).
 *
 * Every scene is drawn on a 300 × 300 square and cropped to fill its panel, which is tall on the
 * wide pass and wide on the phone's: the subject stays inside the middle (about x 45-255,
 * y 50-250) and only sky and ground run to the edges. The classes (.em-*) are in desk.css.
 */

/** Sunbeams fanning out from a point: `count` thin wedges across the upper half. */
function Rays({ cx, cy, from = 0, count = 13 }: { cx: number; cy: number; from?: number; count?: number }) {
	const reach = 420;
	return (
		<g className="em-rays">
			{Array.from({ length: count }, (_, i) => {
				const a = Math.PI * (1 + (i + 0.5) / count);
				const half = (Math.PI / count) * 0.22;
				const point = (angle: number, r: number) => `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
				return <polygon key={i} points={`${point(a, from)} ${point(a - half, reach)} ${point(a + half, reach)}`} />;
			})}
		</g>
	);
}

/** Level lines across the foreground: water, or the desert floor. */
function Ground({ y, lines = [12, 26, 42] }: { y: number; lines?: number[] }) {
	return (
		<g>
			<rect className="em-deep" x="-60" y={y} width="420" height={300 - y + 60} />
			<line className="em-line" x1="-60" y1={y} x2="360" y2={y} />
			{lines.map((d) => (
				<line key={d} className="em-fine" x1="-60" y1={y + d} x2="360" y2={y + d} />
			))}
		</g>
	);
}

/** A star (or compass point set): `points` spikes, each split into a light and a dark facet. */
function FacetStar({ cx, cy, outer, inner, points = 5, turn = -Math.PI / 2 }: { cx: number; cy: number; outer: number; inner: number; points?: number; turn?: number }) {
	const at = (angle: number, r: number) => `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
	const step = Math.PI / points;
	return (
		<g>
			{Array.from({ length: points }, (_, i) => {
				const tip = turn + i * 2 * step;
				return (
					<g key={i}>
						<polygon className="em-near" points={`${cx},${cy} ${at(tip, outer)} ${at(tip - step, inner)}`} />
						<polygon className="em-gold" points={`${cx},${cy} ${at(tip, outer)} ${at(tip + step, inner)}`} />
					</g>
				);
			})}
		</g>
	);
}

/** Tokyo: a torii gate before Mount Fuji and the rising sun. */
const torii = (
	<>
		<Rays cx={150} cy={122} from={64} />
		<circle className="em-sun" cx="150" cy="122" r="58" />
		<polygon className="em-far" points="-20,250 124,116 138,108 162,108 176,116 320,250" />
		<polygon className="em-near" points="124,116 138,108 162,108 176,116 192,131 178,126 166,138 152,127 139,139 128,127 108,131" />
		<Ground y={236} />
		{/* The gate: two pillars, the curved lintel, the tie beam and the strut between them. */}
		<path className="em-near" d="M84,160 Q150,174 216,160 L220,148 Q150,163 80,148 Z" />
		<rect className="em-near" x="98" y="184" width="104" height="8" />
		<rect className="em-near" x="145" y="169" width="10" height="15" />
		<polygon className="em-near" points="108,168 119,169 121,250 106,250" />
		<polygon className="em-near" points="181,169 192,168 194,250 179,250" />
	</>
);

/** Seoul: the tower on Namsan above a palace roof. */
const tower = (
	<>
		<Rays cx={214} cy={92} from={36} count={15} />
		<circle className="em-sun" cx="214" cy="92" r="27" />
		<path className="em-far" d="M-60,260 Q40,150 170,260 Z" />
		<path className="em-mid" d="M-20,232 Q150,82 320,232 L320,320 L-20,320 Z" />
		<path className="em-fine" d="M40,232 Q150,128 260,232" />
		{/* The tower: shaft, the two observation decks, the lattice stage and the mast. */}
		<polygon className="em-near" points="143,160 147,112 153,112 157,160" />
		<rect className="em-near" x="134" y="98" width="32" height="14" rx="3" />
		<rect className="em-near" x="139" y="89" width="22" height="9" rx="2" />
		<polygon className="em-near" points="145,89 148,66 152,66 155,89" />
		<line className="em-mast" x1="150" y1="66" x2="150" y2="42" />
		<line className="em-mast" x1="145" y1="58" x2="155" y2="58" />
		{/* The roof: upswept eaves over a beam and its pillars. */}
		<path className="em-near" d="M70,226 Q150,198 230,226 Q246,220 262,204 Q250,232 238,238 L62,238 Q50,232 38,204 Q54,220 70,226 Z" />
		<rect className="em-gold" x="78" y="238" width="144" height="7" />
		<rect className="em-near" x="88" y="245" width="9" height="60" />
		<rect className="em-near" x="145.5" y="245" width="9" height="60" />
		<rect className="em-near" x="203" y="245" width="9" height="60" />
	</>
);

/** A fir: three stacked tiers on a trunk, its tip at (x, top). */
function Fir({ x, top, size, className = 'em-near' }: { x: number; top: number; size: number; className?: string }) {
	const tier = (i: number) => {
		const y0 = top + i * size * 0.26;
		const half = size * (0.17 + i * 0.07);
		return `${x},${y0} ${x + half},${y0 + size * 0.36} ${x - half},${y0 + size * 0.36}`;
	};
	return (
		<g>
			<rect className={className} x={x - size * 0.03} y={top + size * 0.8} width={size * 0.06} height={size * 0.2} />
			{[2, 1, 0].map((i) => (
				<polygon key={i} className={className} points={tier(i)} />
			))}
		</g>
	);
}

/** Portland: a waterfall down a basalt cliff, among firs. */
const falls = (
	<>
		<Rays cx={150} cy={84} from={34} />
		<circle className="em-sun" cx="150" cy="84" r="30" />
		{/* The cliff either side of the water, in basalt columns. */}
		<polygon className="em-mid" points="-60,84 112,84 122,102 118,186 132,196 126,320 -60,320" />
		<polygon className="em-mid" points="360,84 188,84 178,102 182,186 168,196 174,320 360,320" />
		{[62, 84, 102].map((x) => (
			<line key={x} className="em-fine" x1={x} y1="92" x2={x} y2="250" />
		))}
		{[198, 216, 238].map((x) => (
			<line key={x} className="em-fine" x1={x} y1="92" x2={x} y2="250" />
		))}
		{/* The water: a long drop, a ledge, a short drop into the pool. */}
		<polygon className="em-near" points="131,84 169,84 174,190 126,190" />
		<polygon className="em-near" points="138,198 162,198 166,244 134,244" />
		{[141, 150, 159].map((x) => (
			<line key={x} className="em-ink" x1={x} y1="92" x2={x} y2="184" />
		))}
		<line className="em-ink" x1="150" y1="204" x2="150" y2="238" />
		<Ground y={244} lines={[10, 22]} />
		<Fir x={98} top={184} size={62} className="em-far" />
		<Fir x={202} top={184} size={62} className="em-far" />
		<Fir x={68} top={140} size={108} />
		<Fir x={232} top={140} size={108} />
	</>
);

/** Dallas: the lone star over the skyline. */
const star = (
	<>
		<Rays cx={150} cy={128} from={84} count={17} />
		<circle className="em-ring" cx="150" cy="128" r="78" />
		<circle className="em-fine" cx="150" cy="128" r="84" />
		<FacetStar cx={150} cy={128} outer={64} inner={25} />
		{/* The skyline, with the tower's ball at its left end. */}
		<polygon
			className="em-mid"
			points="-60,250 -60,238 84,238 84,214 104,214 104,226 122,226 122,206 130,198 138,206 138,226 160,226 160,212 184,212 184,220 200,220 200,204 222,204 222,224 244,224 244,216 262,216 262,232 360,232 360,250"
		/>
		<line className="em-mast" x1="66" y1="238" x2="66" y2="202" />
		<circle className="em-near" cx="66" cy="194" r="9" />
		<Ground y={250} lines={[10, 24]} />
	</>
);

/** A rock tower with flat strata: `points` is its outline, `strata` the heights of its bands. */
function Butte({ points, x, strata }: { points: string; x: [number, number]; strata: number[] }) {
	return (
		<g>
			<polygon className="em-mid" points={points} />
			{strata.map((y) => (
				<line key={y} className="em-fine" x1={x[0]} y1={y} x2={x[1]} y2={y} />
			))}
		</g>
	);
}

/** Southern Utah: canyon towers and hoodoos under the desert sun. */
const canyon = (
	<>
		<Rays cx={150} cy={98} from={44} />
		<circle className="em-sun" cx="150" cy="98" r="38" />
		<polygon className="em-far" points="-60,250 -60,176 96,176 108,160 140,160 150,176 196,176 208,152 230,152 240,176 360,176 360,250" />
		<Butte points="34,250 46,112 62,94 96,94 108,114 120,250" x={[42, 112]} strata={[132, 160, 194, 224]} />
		<Butte points="186,250 196,128 212,108 246,108 260,130 272,250" x={[194, 264]} strata={[146, 172, 202, 228]} />
		<Ground y={250} lines={[10, 24]} />
		{/* Hoodoos: weathered spires with a wider cap. */}
		<path className="em-near" d="M136,250 L140,206 L135,198 L141,190 L137,180 L143,170 L141,162 L159,162 L157,170 L163,180 L159,190 L165,198 L160,206 L164,250 Z" />
		<path className="em-near" d="M172,250 L175,222 L171,216 L176,208 L174,202 L186,202 L184,208 L189,216 L185,222 L188,250 Z" />
		<path className="em-near" d="M112,250 L115,228 L111,222 L116,214 L126,214 L131,222 L127,228 L130,250 Z" />
	</>
);

/** A redwood trunk from below the frame to above it, widening toward the ground. */
function Trunk({ x, width, className, bark = 0 }: { x: number; width: number; className: string; bark?: number }) {
	const top = width * 0.36;
	return (
		<g>
			<polygon className={className} points={`${x - top},-40 ${x + top},-40 ${x + width / 2},340 ${x - width / 2},340`} />
			{Array.from({ length: bark }, (_, i) => {
				const o = (i + 1) / (bark + 1) - 0.5;
				return <line key={i} className="em-ink" x1={x + o * top * 2} y1="-40" x2={x + o * width} y2="340" />;
			})}
		</g>
	);
}

/** Northern California: redwoods with the sun low behind them, and someone small at their feet. */
const redwoods = (
	<>
		<Rays cx={150} cy={170} from={52} count={11} />
		<circle className="em-sun" cx="150" cy="170" r="46" />
		<Ground y={248} lines={[12, 28]} />
		<Trunk x={34} width={22} className="em-far" />
		<Trunk x={122} width={20} className="em-far" />
		<Trunk x={176} width={26} className="em-mid" />
		<Trunk x={262} width={22} className="em-far" />
		<Trunk x={78} width={40} className="em-near" bark={3} />
		<Trunk x={222} width={46} className="em-near" bark={4} />
		{/* Someone looking up. */}
		<circle className="em-gold" cx="150" cy="231" r="3.4" />
		<path className="em-gold" d="M146.5,236 L153.5,236 L152.5,248 L147.5,248 Z" />
		{/* Ferns at the trunks' feet. */}
		{[52, 104, 196, 250].map((x) => (
			<g key={x} className="em-line">
				<path d={`M${x},250 Q${x - 4},236 ${x - 14},232`} />
				<path d={`M${x},250 Q${x},234 ${x},228`} />
				<path d={`M${x},250 Q${x + 4},236 ${x + 14},232`} />
			</g>
		))}
	</>
);

/** No emblem set: a compass rose. */
const compass = (
	<>
		<Rays cx={150} cy={150} from={92} count={17} />
		<circle className="em-ring" cx="150" cy="150" r="84" />
		<circle className="em-fine" cx="150" cy="150" r="91" />
		<FacetStar cx={150} cy={150} outer={46} inner={15} points={4} turn={-Math.PI / 4} />
		<FacetStar cx={150} cy={150} outer={74} inner={15} points={4} />
		<circle className="em-sun" cx="150" cy="150" r="5" />
	</>
);

const SCENES: Record<EmblemName, ReactNode> = { torii, tower, falls, star, canyon, redwoods };

export function TripEmblem({ name }: { name: EmblemName | null }) {
	return (
		<svg className="pass-emblem" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
			<rect className="em-sky" x="-60" y="-60" width="420" height="420" />
			{name ? SCENES[name] : compass}
		</svg>
	);
}
