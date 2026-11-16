import { useEffect, useRef } from 'react';
import type { DeskTrip } from './types';

/**
 * The trip card: title, dates, blurb and the link to the trip's page. Real HTML (crisp text, a
 * real link, keyboard and screen-reader friendly), placed in 3D by the caller with <Html>.
 *
 * Shown beside the trip's photos when its place on the map is opened (TripReveal.tsx).
 */
export function TripCard({ trip, onClose }: { trip: DeskTrip; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the card when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-card-${trip.slug}`;

	return (
		<article className="trip-card" role="dialog" aria-labelledby={titleId}>
			<button ref={closeRef} type="button" className="trip-card-close" onClick={onClose} aria-label="Close">
				×
			</button>
			<p className="trip-card-place">{trip.place}</p>
			<h2 id={titleId} className="trip-card-title">
				{trip.title}
			</h2>
			<p className="trip-card-dates">{trip.dates ?? <span className="todo">TODO: dates</span>}</p>
			<p className="trip-card-blurb">{trip.blurb ?? <span className="todo">TODO: blurb</span>}</p>
			<a className="trip-card-open" href={trip.href}>
				Open trip <span aria-hidden="true">→</span>
			</a>
		</article>
	);
}
