/**
 * Colours of the desk scene. WebGL materials can't read CSS variables, so the ones shared with the
 * page (scene background, lamp, ink) are duplicated in src/styles/global.css; keep them in sync.
 */
export const PALETTE = {
	/** What's beyond the room (barely seen); also the fog colour, so the far room recedes into it. */
	sceneBg: '#0d0e10',
	/** The banker's lamp: warm tungsten light, about 2700K. Shared with global.css. */
	lamp: '#ffc28a',
	/** The bulb itself: brighter and paler than the light it throws. */
	bulb: '#fff1dc',
	brass: '#b5893f',
	/** The lamp's shade: emerald cased glass, and the green light that comes through it. */
	shadeGreen: '#0c4f33',
	shadeGlow: '#1f8a55',
	/** Cool fill from above. Tinted toward the portfolio accent. */
	moonlight: '#9fb6ff',
	/** Light bounced up off the floor and walls. */
	bounce: '#1c1814',
	/** Handwriting ink on the photo prints. Shared with global.css. */
	ink: '#2a2622',
	/** The room: dark graphite wall panels, and the darker seams between them. */
	wall: '#2a2e34',
	seam: '#0e0f11',
	/** Dark oiled bronze: the viewport's frame and the gauge panel. */
	bronze: '#3a2c1d',
	/** The viewport's gold cove light, as light: brighter than white, so it blooms. */
	goldLight: [3.2, 1.95, 0.6] as [number, number, number],
	/** Its glow washing down the bronze beside it (added on top). */
	goldWash: [0.55, 0.32, 0.09] as [number, number, number],
} as const;
