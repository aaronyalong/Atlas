import { useEffect, useMemo, useRef, useState } from 'react';
import { seededRandom } from './random';
import { TripEmblem } from './TripEmblem';
import type { DeskTrip } from './types';

/** The pass's size in px, wide and tall (desk.css lays it out; TripReveal.tsx scales it into the scene). */
export const PASS_PX = { wide: { width: 920, height: 400 }, tall: { width: 440, height: 760 } } as const;

/**
 * A trip's boarding pass: what opens when its place on the map is clicked. The place's emblem,
 * its name, where it is (coordinates, and the time there now), and on the tear-off stub the link
 * to the trip's page. No photos or dates: those are on the trip's page.
 *
 * Real HTML (crisp text, a real link, keyboard and screen-reader friendly), placed in 3D by the
 * caller with <Html>. `tall` is the phone's layout: the emblem on top and the stub at the bottom.
 */
export function BoardingPass({ trip, tall, onClose }: { trip: DeskTrip; tall: boolean; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the pass when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `pass-${trip.slug}`;
	const time = useLocalTime(trip.timeZone);

	return (
		<div className="pass-shadow">
			<article className={`pass${tall ? ' is-tall' : ''}`} role="dialog" aria-labelledby={titleId}>
				<button ref={closeRef} type="button" className="pass-close" onClick={onClose} aria-label="Close">
					×
				</button>
				<div className="pass-art">
					<TripEmblem name={trip.emblem} />
				</div>
				<div className="pass-main">
					<p className="pass-head">
						<span className="pass-brand">Atlas</span>
						<span>Boarding pass</span>
					</p>
					<div className="pass-destination">
						<p className="pass-label">Destination</p>
						<h2 id={titleId} className="pass-title">
							{trip.title}
						</h2>
						<p className="pass-place">{trip.place}</p>
					</div>
					<dl className="pass-fields">
						<div>
							<dt>Latitude</dt>
							<dd>{degrees(trip.lat, 'N', 'S')}</dd>
						</div>
						<div>
							<dt>Longitude</dt>
							<dd>{degrees(trip.lng, 'E', 'W')}</dd>
						</div>
						{time && (
							<div>
								<dt>Local time</dt>
								<dd>{time}</dd>
							</div>
						)}
					</dl>
				</div>
				<div className="pass-stub">
					<Barcode seed={trip.slug} />
					<a className="deco-tag pass-open" href={trip.href}>
						Open trip <span aria-hidden="true">→</span>
					</a>
				</div>
			</article>
		</div>
	);
}

/** 37.2982 → "37.30° N". */
function degrees(value: number, positive: string, negative: string) {
	return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

/** The time in a zone, as "2:14 PM", kept current; null without a zone. */
function useLocalTime(zone: string | null) {
	const format = useMemo(() => (zone ? new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }) : null), [zone]);
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		if (!format) return;
		const id = window.setInterval(() => setNow(new Date()), 10_000);
		return () => window.clearInterval(id);
	}, [format]);
	return format ? format.format(now) : null;
}

/** A barcode for show: bars whose widths come from the trip's slug, so each trip has its own. */
function Barcode({ seed }: { seed: string }) {
	const bars = useMemo(() => {
		const rand = seededRandom(`${seed}:barcode`);
		const out: { x: number; width: number }[] = [];
		let x = 0;
		while (x < 150) {
			const width = 1 + Math.floor(rand() * 4);
			if (x + width > 150) break;
			out.push({ x, width });
			x += width + 1 + Math.floor(rand() * 3);
		}
		return out;
	}, [seed]);
	return (
		<svg className="pass-barcode" viewBox="0 0 150 48" preserveAspectRatio="none" aria-hidden="true" focusable="false">
			{bars.map((bar) => (
				<rect key={bar.x} x={bar.x} y="0" width={bar.width} height="48" />
			))}
		</svg>
	);
}
