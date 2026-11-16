import { useEffect, useRef } from 'react';
import type { DeskTrip } from './types';

/**
 * The trip card: title, dates, blurb and the link to the trip's page. Real HTML (crisp text, a
 * real link, keyboard and screen-reader friendly), placed in 3D by the caller with <Html>.
 *
 * Two looks: the card printed on a polaroid's back, and the luggage tag that swings up from a
 * map pin. Same content and behaviour; the CSS (src/styles/desk.css) does the rest.
 */
export function TripCard({ trip, onClose, variant = 'card' }: { trip: DeskTrip; onClose: () => void; variant?: 'card' | 'tag' }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the card when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-${variant}-${trip.slug}`;

	return (
		<article className={variant === 'tag' ? 'trip-card trip-tag' : 'trip-card'} role="dialog" aria-labelledby={titleId}>
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
