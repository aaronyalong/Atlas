import { getCollection, type CollectionEntry } from 'astro:content';

export type Trip = CollectionEntry<'trips'>;

/** Every trip, most recent first; trips without dates go last, alphabetically. */
export async function getTrips(): Promise<Trip[]> {
	const trips = await getCollection('trips');
	return trips.sort((a, b) => {
		const ta = a.data.start?.getTime();
		const tb = b.data.start?.getTime();
		if (ta !== undefined && tb !== undefined && ta !== tb) return tb - ta;
		if (ta === undefined && tb !== undefined) return 1;
		if (tb === undefined && ta !== undefined) return -1;
		return a.data.title.localeCompare(b.data.title);
	});
}

/** The trip's scrapbook page. */
export const tripHref = (trip: Trip) => `/trips/${trip.id}/`;

/** "Tokyo, Japan". */
export const tripName = (trip: Trip) => `${trip.data.title}, ${trip.data.place}`;

// Dates are calendar days (YAML dates parse as UTC midnight), so format them in UTC: otherwise
// a visitor west of Greenwich would see the day before.
const DAY = new Intl.DateTimeFormat('en-US', {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
	timeZone: 'UTC',
});

/** The trip's journal text has been written (the body isn't empty or just an HTML comment). */
export const hasJournal = (trip: Trip) => (trip.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;

/** "35.68° N, 139.65° E". */
export function formatCoordinates(lat: number, lng: number): string {
	const ns = lat >= 0 ? 'N' : 'S';
	const ew = lng >= 0 ? 'E' : 'W';
	return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lng).toFixed(2)}° ${ew}`;
}

/** How many days the trip ran, counting both ends (Mar 3 – 10 is 8), or null without dates. */
export function tripDays(trip: Trip): number | null {
	const { start, end } = trip.data;
	if (!start) return null;
	return Math.round(((end ?? start).getTime() - start.getTime()) / 86_400_000) + 1;
}

/** "Mar 3 – 10, 2025", "Mar 3, 2025", or null when the trip has no dates yet. */
export function formatTripDates(trip: Trip): string | null {
	const { start, end } = trip.data;
	if (!start) return null;
	return end && end.getTime() !== start.getTime() ? DAY.formatRange(start, end) : DAY.format(start);
}
