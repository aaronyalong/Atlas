// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	// The site's public URL: canonical links (and later the sitemap and link previews) use it.
	site: 'https://travel.aaronyalong.com',
	// React is only for the 3D desk, mounted as a client-only island on the home page.
	// Every other page is plain Astro with no client JS.
	integrations: [react()],
});
