import { useEffect, useRef } from 'react';
import { TripEmblem } from './TripEmblem';
import type { DeskTrip } from './types';

/**
 * The design card of a trip's preview: the place's emblem, its name, and the link to the trip's
 * page as a wide button underneath. It sits to the right of the trip's photo (TripReveal.tsx),
 * on the same card stock and at the same size.
 *
 * Real HTML (crisp text, a real link, keyboard and screen-reader friendly), placed in 3D by the
 * caller with <Html>.
 */
export function TripPoster({ trip, onClose }: { trip: DeskTrip; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the card when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-poster-${trip.slug}`;

	return (
		<article className="trip-poster" role="dialog" aria-labelledby={titleId}>
			<button ref={closeRef} type="button" className="trip-poster-close" onClick={onClose} aria-label="Close">
				×
			</button>
			<div className="trip-poster-art">
				<TripEmblem name={trip.emblem} />
			</div>
			<div className="trip-poster-name">
				<p className="trip-poster-place">
					<span>{trip.place}</span>
				</p>
				<h2 id={titleId} className="trip-poster-title">
					{trip.title}
				</h2>
			</div>
			<a className="deco-tag trip-poster-open" href={trip.href}>
				Open trip <span aria-hidden="true">→</span>
			</a>
		</article>
	);
}
