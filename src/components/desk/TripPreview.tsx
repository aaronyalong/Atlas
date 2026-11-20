import { useEffect, useRef } from 'react';
import { TripEmblem } from './TripEmblem';
import type { DeskTrip } from './types';

/** The panel's size in px, wide and tall (desk.css lays it out; TripReveal.tsx scales it into the scene). */
export const PREVIEW_PX = { wide: { width: 900, height: 500 }, tall: { width: 440, height: 780 } } as const;

/**
 * A trip's preview: one dark panel in two halves. On the left one photo of the trip, edge to
 * edge; on the right its design (the place's emblem, its name, and the link to the trip's page
 * as a wide gold button). `tall` is the phone's layout: the photo on top, the design below.
 *
 * Real HTML (crisp text, a real link, keyboard and screen-reader friendly), placed in 3D by the
 * caller with <Html>.
 */
export function TripPreview({ trip, tall, onClose }: { trip: DeskTrip; tall: boolean; onClose: () => void }) {
	const closeRef = useRef<HTMLButtonElement>(null);
	// Move keyboard focus into the panel when it opens. <Html> renders its contents in a separate
	// React root and attaches them to the page a moment later, so wait a frame.
	useEffect(() => {
		const id = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
		return () => cancelAnimationFrame(id);
	}, []);
	const titleId = `trip-preview-${trip.slug}`;

	return (
		<article className={`trip-preview${tall ? ' is-tall' : ''}`} role="dialog" aria-labelledby={titleId}>
			<button ref={closeRef} type="button" className="trip-preview-close" onClick={onClose} aria-label="Close">
				×
			</button>
			<div className="trip-preview-photo">
				{trip.photo ? <img src={trip.photo.src} alt={trip.photo.alt} draggable={false} decoding="async" /> : <span className="todo">TODO: photo</span>}
			</div>
			<div className="trip-preview-design">
				<div className="trip-preview-art">
					<TripEmblem name={trip.emblem} />
				</div>
				<div className="trip-preview-text">
					<p className="trip-preview-place">{trip.place}</p>
					<h2 id={titleId} className="trip-preview-title">
						{trip.title}
					</h2>
					<a className="deco-tag trip-preview-open" href={trip.href}>
						Open trip <span aria-hidden="true">→</span>
					</a>
				</div>
			</div>
		</article>
	);
}
