import { useEffect, useRef } from 'react';
import type { DeskMap, DeskTrip } from './types';

/** The locator stamp's picture (px), and how wide the whole map sheet is drawn behind it. */
const STAMP = 132;
const ZOOM_WIDTH = 1500;

/**
 * The trip card: title, dates, then the blurb (or, without one, a postage-stamp locator cut from
 * the desk's map, as on the trip's page), how long the trip ran and how many photos it has, and
 * the link to the trip's page. Real HTML (crisp text, a real link, keyboard and screen-reader
 * friendly), placed in 3D by the caller with <Html>.
 *
 * Shown beside the trip's photos when its place on the map is opened (TripReveal.tsx).
 */
export function TripCard({ trip, map, onClose }: { trip: DeskTrip; map: DeskMap; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the card when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-card-${trip.slug}`;
	const photos = trip.photos.length;
	const facts = [trip.days && `${trip.days} ${trip.days === 1 ? 'day' : 'days'}`, photos > 0 && `${photos} ${photos === 1 ? 'photo' : 'photos'}`].filter(Boolean).join(' · ');

	return (
		<article className="trip-card" role="dialog" aria-labelledby={titleId}>
			<button ref={closeRef} type="button" className="trip-card-close" onClick={onClose} aria-label="Close">
				×
			</button>
			<p className="trip-card-place">
				<span>{trip.place}</span>
			</p>
			<h2 id={titleId} className="trip-card-title">
				{trip.title}
			</h2>
			<p className="trip-card-dates">{trip.dates ?? <span className="todo">TODO: dates</span>}</p>
			<div className="trip-card-middle">
				{trip.blurb ? <p className="trip-card-blurb">{trip.blurb}</p> : trip.map && <Stamp map={map} at={trip.map} />}
				{facts && <p className="trip-card-facts">{facts}</p>}
			</div>
			<a className="deco-tag trip-card-open" href={trip.href}>
				Open trip <span aria-hidden="true">→</span>
			</a>
		</article>
	);
}

/** The map around the pin, on a perforated stamp with a brass pin in the middle. */
function Stamp({ map, at: [u, v] }: { map: DeskMap; at: [number, number] }) {
	const aspect = map.width / map.depth;
	return (
		<div className="trip-card-stamp" aria-hidden="true">
			<div
				className="trip-card-stamp-picture"
				style={{
					width: STAMP,
					height: STAMP,
					backgroundImage: `url(${map.src})`,
					backgroundSize: `${ZOOM_WIDTH}px auto`,
					backgroundPosition: `${STAMP / 2 - u * ZOOM_WIDTH}px ${STAMP / 2 - (v * ZOOM_WIDTH) / aspect}px`,
				}}
			>
				<span className="trip-card-stamp-pin" />
			</div>
		</div>
	);
}
