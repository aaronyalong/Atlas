import type { ReactNode } from 'react';
import type { EmblemName } from '../../lib/emblems';

/*
 * The picture in a trip's preview (TripPreview.tsx): a small deco scene of the place, in the
 * map's colours (navy sky, gold lines, cream for whatever is nearest).
 *
 * Every scene is drawn on a 300 × 300 square and cropped to fill its panel, whatever its shape:
 * the subject stays inside the middle (about x 45-255, y 50-250) and only sky and ground run to
 * the edges. The classes (.em-*) are in desk.css.
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
		<line className="em-mast" x1="150" y1="66" x2="150" y2="46" />
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

/** Iceland: the stepped church in Reykjavík under the northern lights. */
const church = (
	<>
		<circle className="em-sun" cx="232" cy="78" r="13" />
		{/* The aurora: ribbons of light across the sky. */}
		<path className="em-ring" d="M-20,112 Q50,62 120,96 T250,84 T330,60" />
		<path className="em-line" d="M-20,134 Q60,88 130,118 T260,104 T330,86" />
		<path className="em-fine" d="M-20,92 Q40,50 110,76 T240,62 T330,40" />
		<polygon className="em-far" points="-60,236 24,176 70,204 124,158 150,180 196,150 250,200 290,178 360,236" />
		<Ground y={236} />
		{/* The church: a tower between two wings that step down like organ pipes. */}
		<polygon
			className="em-near"
			points="77,236 77,216 86,216 86,202 95,202 95,188 104,188 104,174 113,174 113,160 122,160 122,146 131,146 131,132 140,132 140,110 150,72 160,110 160,132 169,132 169,146 178,146 178,160 187,160 187,174 196,174 196,188 205,188 205,202 214,202 214,216 223,216 223,236"
		/>
		{[86, 95, 104, 113, 122, 131, 140, 160, 169, 178, 187, 196, 205, 214].map((x) => (
			<line key={x} className="em-ink" x1={x} y1={Math.abs(x - 150) * 1.56 + 118} x2={x} y2="234" />
		))}
		<rect className="em-gold" x="145.5" y="218" width="9" height="18" />
		<line className="em-mast" x1="150" y1="72" x2="150" y2="56" />
		<line className="em-mast" x1="146" y1="62" x2="154" y2="62" />
	</>
);

/** Playa del Carmen: a palm on the beach, the sun low over the Caribbean. */
const palm = (
	<>
		<Rays cx={182} cy={150} from={52} />
		<circle className="em-sun" cx="182" cy="150" r="46" />
		<Ground y={196} lines={[10, 22, 36]} />
		<path className="em-near" d="M-60,330 L-60,238 Q70,216 180,236 T360,232 L360,330 Z" />
		{/* The palm: a leaning trunk, six fronds and a pair of coconuts. */}
		<path className="em-gold" d="M90,246 Q96,170 122,112 L131,114 Q108,172 104,246 Z" />
		<path className="em-near" d="M127,112 Q170,82 210,112 Q170,98 127,112 Z" />
		<path className="em-near" d="M127,112 Q160,58 202,62 Q160,76 127,112 Z" />
		<path className="em-near" d="M127,112 Q118,64 90,56 Q110,80 127,112 Z" />
		<path className="em-near" d="M127,112 Q86,82 48,112 Q88,98 127,112 Z" />
		<path className="em-near" d="M127,112 Q88,112 60,150 Q98,124 127,112 Z" />
		<path className="em-near" d="M127,112 Q168,112 194,152 Q160,124 127,112 Z" />
		<circle className="em-gold" cx="123" cy="119" r="4.2" />
		<circle className="em-gold" cx="132" cy="120" r="4.2" />
	</>
);

/** One tower of a cable-stayed bridge at x, with its fan of cables down to the deck. */
function StayTower({ x }: { x: number }) {
	return (
		<g>
			{[0, 1, 2, 3, 4, 5].flatMap((i) =>
				[-1, 1].map((side) => <line key={`${i}:${side}`} className="em-line" x1={x} y1={84 + i * 10} x2={x + side * (18 + i * 14)} y2="204" />),
			)}
			<polygon className="em-near" points={`${x - 4},70 ${x + 4},70 ${x + 6},150 ${x + 20},226 ${x + 10},226 ${x},168 ${x - 10},226 ${x - 20},226 ${x - 6},150`} />
		</g>
	);
}

/** Boston: the cable-stayed bridge over the Charles, the skyline behind. */
const bridge = (
	<>
		<Rays cx={150} cy={140} from={46} />
		<circle className="em-sun" cx="150" cy="140" r="40" />
		<polygon
			className="em-far"
			points="-60,226 -60,196 36,196 36,176 58,176 58,190 84,190 84,164 108,164 108,196 190,196 190,170 214,170 214,184 240,184 240,160 262,160 262,196 360,196 360,226"
		/>
		<Ground y={226} lines={[10, 22]} />
		<StayTower x={96} />
		<StayTower x={204} />
		<rect className="em-near" x="-60" y="204" width="420" height="8" />
	</>
);

/** Las Vegas: the welcome sign, without its words, over the desert. */
const sign = (
	<>
		<Rays cx={150} cy={160} from={104} count={17} />
		<polygon className="em-far" points="-60,244 -60,214 30,214 44,200 96,200 108,214 206,214 220,196 262,196 274,214 360,214 360,244" />
		<Ground y={244} lines={[8]} />
		<rect className="em-gold" x="111" y="186" width="9" height="60" />
		<rect className="em-gold" x="180" y="186" width="9" height="60" />
		{/* The sign: a wide diamond, a row of discs above it and a starburst on top. */}
		<polygon className="em-near" points="58,160 150,106 242,160 150,214" />
		<polygon className="em-ink" points="76,160 150,117 224,160 150,203" />
		<polygon className="em-gold" points="104,160 150,134 196,160 150,186" />
		{[96, 114, 132, 150, 168, 186, 204].map((x) => (
			<circle key={x} className="em-near" cx={x} cy={92 + Math.abs(x - 150) * 0.2} r="8" />
		))}
		<FacetStar cx={150} cy={66} outer={16} inner={5} points={8} />
	</>
);

/** The Southern California dunes: ridges of sand under a hard sun. */
const dunes = (
	<>
		<Rays cx={200} cy={104} from={40} />
		<circle className="em-sun" cx="200" cy="104" r="34" />
		<path className="em-far" d="M-60,170 Q60,120 150,156 T360,130 L360,330 L-60,330 Z" />
		<path className="em-mid" d="M-60,196 Q40,166 120,186 Q200,206 260,160 Q300,142 360,168 L360,330 L-60,330 Z" />
		{/* The near dune: sunlit to the left of its crest, in shade to the right. */}
		<path className="em-near" d="M-60,236 Q60,186 150,206 Q210,220 262,198 Q310,180 360,208 L360,330 L-60,330 Z" />
		<path className="em-gold" d="M150,206 Q210,220 262,198 Q236,250 226,330 L130,330 Q156,262 150,206 Z" />
		{[0, 1, 2].map((i) => (
			<path key={i} className="em-ink" d={`M${-40 + i * 14},${246 + i * 4} Q${40 + i * 10},${214 + i * 6} ${118 + i * 6},${224 + i * 8}`} />
		))}
		<path className="em-fine" d="M-60,150 Q40,112 120,136" />
		<path className="em-fine" d="M180,182 Q230,176 262,146" />
	</>
);

/** Toronto: the tower over the skyline and the stadium's dome, on the lake. */
const needle = (
	<>
		<Rays cx={84} cy={98} from={32} count={15} />
		<circle className="em-sun" cx="84" cy="98" r="26" />
		<polygon
			className="em-mid"
			points="-60,236 -60,206 44,206 44,178 66,178 66,196 88,196 88,160 112,160 112,206 128,206 128,236 176,236 176,214 246,214 246,184 268,184 268,202 360,202 360,236"
		/>
		<path className="em-near" d="M178,236 Q208,196 238,236 Z" />
		<path className="em-ink" d="M193,236 Q208,206 223,236" />
		<Ground y={236} />
		{/* The tower: the shaft, the pod two thirds of the way up, and the mast. */}
		<polygon className="em-near" points="142,236 147,128 153,128 158,236" />
		<polygon className="em-near" points="135,128 165,128 161,116 139,116" />
		<polygon className="em-near" points="142,116 158,116 155,106 145,106" />
		<polygon className="em-near" points="147,106 153,106 151.5,78 148.5,78" />
		<line className="em-mast" x1="150" y1="78" x2="150" y2="50" />
	</>
);

/** One spire of the basilica: slender, swelling a little before it tapers to a point. */
function Spire({ x, top, width }: { x: number; top: number; width: number }) {
	const rungs = Array.from({ length: Math.floor((216 - top - 44) / 15) + 1 }, (_, i) => top + 44 + i * 15);
	return (
		<g>
			<polygon className="em-near" points={`${x - width},236 ${x - width},${top + 62} ${x - width * 0.45},${top + 18} ${x},${top} ${x + width * 0.45},${top + 18} ${x + width},${top + 62} ${x + width},236`} />
			{rungs.map((y) => (
				<line key={y} className="em-ink" x1={x - width * 0.55} y1={y} x2={x + width * 0.55} y2={y} />
			))}
			<circle className="em-gold" cx={x} cy={top - 2} r="4" />
		</g>
	);
}

/** Barcelona: the basilica's spires against the sun. */
const spires = (
	<>
		<Rays cx={150} cy={128} from={56} />
		<circle className="em-sun" cx="150" cy="128" r="50" />
		<Ground y={236} />
		<Spire x={92} top={110} width={13} />
		<Spire x={208} top={110} width={13} />
		<Spire x={130} top={72} width={14} />
		<Spire x={170} top={72} width={14} />
		{/* The façade between them: a gable, a rose window and the portal. */}
		<polygon className="em-near" points="122,236 122,196 150,164 178,196 178,236" />
		<circle className="em-ring" cx="150" cy="198" r="8" />
		<path className="em-deep" d="M143,236 L143,222 Q150,208 157,222 L157,236 Z" />
	</>
);

/** London: the clock tower over the river and the bridge. */
const clock = (
	<>
		<Rays cx={216} cy={96} from={30} count={15} />
		<circle className="em-sun" cx="216" cy="96" r="24" />
		{/* The palace to the left, the bridge to the right. */}
		<polygon className="em-mid" points="-60,236 -60,190 50,190 50,176 56,176 56,190 84,190 84,176 90,176 90,190 118,190 118,176 124,176 124,190 133,190 133,236" />
		<rect className="em-mid" x="167" y="210" width="200" height="9" />
		{[196, 244, 292].map((x) => (
			<g key={x}>
				<rect className="em-mid" x={x} y="219" width="9" height="17" />
				<path className="em-fine" d={`M${x - 39},236 Q${x - 19},214 ${x},236`} />
			</g>
		))}
		<Ground y={236} />
		{/* The tower: the shaft, the clock stage a little wider, and the stepped roof. */}
		<rect className="em-near" x="133" y="124" width="34" height="112" />
		{[141.5, 150, 158.5].map((x) => (
			<line key={x} className="em-ink" x1={x} y1="132" x2={x} y2="232" />
		))}
		<rect className="em-near" x="129" y="92" width="42" height="34" />
		<circle className="em-deep" cx="150" cy="109" r="12.5" />
		<circle className="em-ring" cx="150" cy="109" r="12.5" />
		<path className="em-line" d="M150,100 L150,109 L157,113" />
		<polygon className="em-near" points="129,92 136,78 164,78 171,92" />
		<polygon className="em-near" points="139,78 150,54 161,78" />
	</>
);

/** A row of arched openings along a wall, standing on y = `foot`. */
function Arcade({ from, to, foot }: { from: number; to: number; foot: number }) {
	return (
		<g>
			{Array.from({ length: Math.floor((to - from) / 16) + 1 }, (_, i) => from + i * 16).map((x) => (
				<path key={x} className="em-deep" d={`M${x},${foot} L${x},${foot - 12} A5,5 0 0 1 ${x + 10},${foot - 12} L${x + 10},${foot} Z`} />
			))}
		</g>
	);
}

/** Italy: the Colosseum, its outer wall still standing on one side. */
const arches = (
	<>
		<Rays cx={170} cy={116} from={50} />
		<circle className="em-sun" cx="170" cy="116" r="44" />
		<Ground y={236} />
		<polygon className="em-near" points="50,236 50,132 148,132 148,160 250,160 250,236" />
		<line className="em-ink" x1="50" y1="160" x2="148" y2="160" />
		<line className="em-ink" x1="50" y1="186" x2="250" y2="186" />
		<line className="em-ink" x1="50" y1="212" x2="250" y2="212" />
		<Arcade from={57} to={137} foot={156} />
		<Arcade from={57} to={233} foot={182} />
		<Arcade from={57} to={233} foot={208} />
		<Arcade from={57} to={233} foot={234} />
	</>
);

/** Greece: the temple on its rock. */
const temple = (
	<>
		<Rays cx={150} cy={108} from={50} />
		<circle className="em-sun" cx="150" cy="108" r="44" />
		<polygon className="em-mid" points="-60,250 16,228 56,204 244,204 284,228 360,250" />
		<Ground y={244} lines={[8]} />
		{/* Two cypresses on the slope. */}
		<path className="em-far" d="M36,230 Q26,186 36,156 Q46,186 36,230 Z" />
		<path className="em-far" d="M264,230 Q254,192 264,166 Q274,192 264,230 Z" />
		{/* The temple: steps, eight columns, the beam across them and the pediment. */}
		<rect className="em-near" x="66" y="197" width="168" height="7" />
		<rect className="em-near" x="72" y="190" width="156" height="7" />
		{Array.from({ length: 8 }, (_, i) => 77.5 + i * 19.4).map((x) => (
			<g key={x}>
				<rect className="em-near" x={x} y="124" width="9" height="66" />
				<line className="em-ink" x1={x + 4.5} y1="128" x2={x + 4.5} y2="186" />
			</g>
		))}
		<rect className="em-near" x="70" y="110" width="160" height="14" />
		<line className="em-ink" x1="72" y1="117" x2="228" y2="117" />
		<polygon className="em-near" points="66,110 150,76 234,110" />
		<polygon className="em-ink" points="88,106 150,82 212,106" />
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

const SCENES: Record<EmblemName, ReactNode> = { torii, tower, falls, star, canyon, redwoods, church, palm, bridge, sign, dunes, needle, spires, clock, arches, temple };

export function TripEmblem({ name }: { name: EmblemName | null }) {
	return (
		<svg className="trip-emblem" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
			<rect className="em-sky" x="-60" y="-60" width="420" height="420" />
			{name ? SCENES[name] : compass}
		</svg>
	);
}
