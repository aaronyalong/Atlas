import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { EMBLEMS } from './lib/emblems';

/**
 * Trips: one Markdown file per trip in src/content/trips/. The file name is the trip's URL slug
 * (tokyo.md → /trips/tokyo/). The Markdown body is the trip's journal text, optional.
 *
 * Only title, place and coordinates are required. Missing dates or photos show as a visible TODO
 * on the site rather than being made up; a missing blurb or journal is simply left out.
 */
const trips = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/trips' }),
	schema: ({ image }) =>
		z.object({
			/** The main name, e.g. "Tokyo" or "Southern Utah". */
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
			/**
			 * The picture on its design card, on the desk (one of src/lib/emblems.ts). Optional: a
			 * trip without one gets a compass rose.
			 */
			emblem: z.enum(EMBLEMS).optional(),
			/** YYYY-MM-DD. `end` can be left out for a one-day trip. */
			start: z.coerce.date().optional(),
			end: z.coerce.date().optional(),
			/** One or two sentences, on the trip list and the trip's page. */
			blurb: z.string().optional(),
			/**
			 * Cover photo, also the one photo in its preview on the desk. Relative to the trip file (e.g. ./tokyo/cover.jpg). Re-encoded at build
			 * time, which strips EXIF and GPS data; the original file is never published.
			 */
			cover: image().optional(),
			/** Describes the cover photo for screen readers. Required once there's a cover. */
			coverAlt: z.string().optional(),
			/**
			 * More photos, in order, on the trip's page. Paths relative to the trip file, like `cover`; re-encoded the same way, so EXIF
			 * and GPS are stripped.
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
