/**
 * A trip as the 3D desk sees it: plain, serialisable data prepared at build time by
 * src/pages/index.astro (dates already formatted, photo already processed). `null` means
 * "not written yet": the desk shows a visible TODO in its place.
 */
export interface DeskTrip {
	/** URL slug and stable id, e.g. "tokyo". */
	slug: string;
	title: string;
	place: string;
	/** Handwritten on the polaroid. */
	caption: string;
	dates: string | null;
	blurb: string | null;
	/** The trip's page. */
	href: string;
	/** Processed cover photo (WebP, metadata stripped). */
	photo: { src: string; alt: string } | null;
}
