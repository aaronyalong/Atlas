/**
 * sitemap.xml: the desk, the trip list and every trip's page, with absolute URLs from
 * `site` in astro.config.mjs. Trips come from the collection, so new ones are listed automatically.
 * Left out on purpose: the 404 page, and the dev-only /dev/ pages (never built in production).
 * No <lastmod>: a guessed date would mislead crawlers more than none.
 */
import type { APIRoute } from 'astro';
import { getTrips, tripHref } from '../lib/trips';

export const GET: APIRoute = async ({ site }) => {
	const paths = ['/', '/trips/', ...(await getTrips()).map(tripHref)];
	const urls = paths.map((path) => `\t<url><loc>${new URL(path, site).href}</loc></url>`).join('\n');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
