/**
 * Dev-only: serves a screenshot from src/dev-shots/ for /dev/compare (see src/lib/dev-shots.ts).
 * getStaticPaths lists nothing outside dev, so a production build emits nothing for this route.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { listShots, readShot } from '../../../lib/dev-shots';

export const getStaticPaths = (async () => {
	if (!import.meta.env.DEV) return [];
	return (await listShots()).map((file) => ({ params: { file } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) => {
	const bytes = await readShot(String(params.file));
	if (!bytes) return new Response('Not found', { status: 404 });
	return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' } });
};
