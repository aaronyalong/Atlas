/**
 * robots.txt, built from `site` in astro.config.mjs: everything may be crawled, and the sitemap's
 * absolute URL follows the site's domain. (Same as the portfolio's.)
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const sitemap = new URL('/sitemap.xml', site).href;
	return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
