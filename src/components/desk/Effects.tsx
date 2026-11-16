import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import type { Vector3Tuple } from 'three';
import type { DeviceProfile } from './device';

interface EffectsProps {
	profile: DeviceProfile;
	/** Where an opened polaroid is held, or null: the point the lens focuses on. */
	focus: Vector3Tuple | null;
	/** What the lens focuses on when nothing is open: the camera's orbit target. */
	target: Vector3Tuple;
}

/**
 * Screen-space effects, applied to the finished frame in order.
 *
 * How it works: instead of drawing straight to the screen, the scene is drawn into an off-screen
 * buffer (in half-float, so brightness above 1 survives), each effect reads that buffer and
 * writes a new one, and the last writes to the screen. The composer turns the renderer's own
 * tone mapping off, since that only applies when drawing to the screen; the ToneMapping effect
 * at the end puts AgX back.
 *
 *   - N8AO (ambient occlusion): darkens creases and the places where objects meet, from every
 *     direction, which a single light's shadow can't do. Desktop only: it reads depth and
 *     normals many times per pixel.
 *   - Depth of field: blurs what's further from the focus point than a real lens would keep
 *     sharp. Gentle at the desk (Earth outside should still read), stronger while a place is
 *     open. Focus follows the opened place. Desktop only (it blurs the frame several times).
 *   - Bloom: the glow a camera sensor records around a bare bulb. The threshold is well above
 *     1, so only the bulb and the inside of the shade (drawn far brighter than white) bloom.
 *   - Vignette: slight darkening toward the corners, which pulls the eye to the map.
 *   - Noise: light film grain. It also hides the banding that smooth dark gradients show on
 *     8-bit screens.
 */
export function Effects({ profile, focus, target }: EffectsProps) {
	const mobile = profile.isMobile;
	return (
		<EffectComposer multisampling={mobile ? 0 : 4}>
			{mobile ? <></> : <N8AO quality="medium" aoRadius={0.12} distanceFalloff={0.4} intensity={2.5} halfRes />}
			{mobile ? (
				<></>
			) : (
				<DepthOfField target={focus ?? target} worldFocusRange={focus ? 0.5 : 2.2} bokehScale={focus ? 3 : 1.4} />
			)}
			{/* Threshold well above 1: only things drawn far brighter than white bloom (the ceiling
			    light's fitting, the rocket's flame, a shooting star); a highlight on glossy paper
			    (just over 1) must not, or prints start to sparkle. */}
			<Bloom luminanceThreshold={1.8} luminanceSmoothing={0.4} intensity={0.7} mipmapBlur radius={0.6} />
			<Vignette offset={0.25} darkness={0.65} />
			<Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={profile.reducedMotion ? 0 : 0.18} />
			<ToneMapping mode={ToneMappingMode.AGX} />
		</EffectComposer>
	);
}
