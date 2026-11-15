/**
 * Colours of the desk scene. WebGL materials can't read CSS variables, so the ones shared with the
 * page (scene background, lamp) are duplicated in src/styles/global.css; keep them in sync.
 */
export const PALETTE = {
	/** The dark room around the desk; also the fog colour, so far edges fade into it. */
	sceneBg: '#0f0c0a',
	/** Warm tungsten light, about 2700K. */
	lamp: '#ffc28a',
	/** The bulb itself: brighter and paler than the light it throws. */
	bulb: '#fff1dc',
	/** Cool fill from above, like moonlight through a window. Tinted toward the portfolio accent. */
	moonlight: '#9fb6ff',
	/** Light bounced up off the floor and walls. */
	bounce: '#2a1c12',

	wood: { base: '#6a4b35', dark: '#3b2518', light: '#a57a55' },
	lampPaint: '#2f3b36',
	brass: '#b08a4a',
} as const;
