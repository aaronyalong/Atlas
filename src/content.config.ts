import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Trips: one Markdown file per trip in src/content/trips/. The file name is the trip's URL slug
 * (tokyo.md → /trips/tokyo/). The Markdown body is the trip's journal text (phase 4).
 *
 * Only title, place and coordinates are required. Anything left out shows as a visible TODO on
 * the site rather than being made up.
 */
const trips = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/trips' }),
	schema: ({ image }) =>
		z.object({
			/** The main name, e.g. "Tokyo" or "Zion National Park". */
			title: z.string(),
			/** Where it is, e.g. "Japan" or "Utah". */
			place: z.string(),
			/** For the map pin (phase 3): decimal degrees, north and east positive. */
			lat: z.number().min(-90).max(90),
			lng: z.number().min(-180).max(180),
			/**
			 * The place's IANA time zone (e.g. Asia/Tokyo), for its world clock on the desk's gauge
			 * panel. Optional: a trip without one just gets no clock.
			 */
			timeZone: z
				.string()
				.refine((zone) => {
					try {
						new Intl.DateTimeFormat('en', { timeZone: zone });
						return true;
					} catch {
						return false;
					}
				}, 'Not a time zone Intl knows (use an IANA name like Asia/Tokyo).')
				.optional(),
			/** YYYY-MM-DD. `end` can be left out for a one-day trip. */
			start: z.coerce.date().optional(),
			end: z.coerce.date().optional(),
			/** One or two sentences: the card on the desk and the trip list. */
			blurb: z.string().optional(),
			/**
			 * Cover photo, relative to the trip file (e.g. ./tokyo/cover.jpg). Re-encoded at build
			 * time, which strips EXIF and GPS data; the original file is never published.
			 */
			cover: image().optional(),
			/** Describes the cover photo for screen readers. Required once there's a cover. */
			coverAlt: z.string().optional(),
			/**
			 * More photos, in order: shown fanned out over the map when the trip's pin is opened,
			 * and on the trip's page. Paths relative to the trip file, like `cover`; re-encoded the
			 * same way, so EXIF and GPS are stripped.
			 */
			photos: z
				.array(
					z.object({
						src: image(),
						/** For screen readers: what's in the photo. */
						alt: z.string(),
						/** Handwritten under the print. */
						caption: z.string().max(40).optional(),
					}),
				)
				.default([]),
		})
		.refine((trip) => !trip.cover || trip.coverAlt, {
			message: 'A cover photo needs coverAlt (what the photo shows, for screen readers).',
			path: ['coverAlt'],
		}),
});

export const collections = { trips };
