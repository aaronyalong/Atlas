/**
 * Colours of the desk scene. WebGL materials can't read CSS variables, so the ones shared with the
 * page (scene background, lamp) are duplicated in src/styles/global.css; keep them in sync.
 */
export const PALETTE = {
	/** What's beyond the room (barely seen); also the fog colour, so the far room recedes into it. */
	sceneBg: '#0d0e10',
	/** Warm tungsten light, about 2700K. */
	lamp: '#ffc28a',
	/** The bulb itself: brighter and paler than the light it throws. */
	bulb: '#fff1dc',
	/** Cool fill from above, like moonlight through a window. Tinted toward the portfolio accent. */
	moonlight: '#9fb6ff',
	/** Light bounced up off the floor and walls. */
	bounce: '#1c1814',

	/** Cream card stock (polaroid backs) and handwriting ink. Shared with global.css. */
	paper: '#f4ecdc',
	ink: '#2a2622',

	brass: '#b5893f',
	/** The banker's lamp shade: emerald cased glass, and the green light that comes through it. */
	shadeGreen: '#0c4f33',
	shadeGlow: '#1f8a55',
	/** The room: charcoal plaster. */
	wall: '#1c1e22',
} as const;
