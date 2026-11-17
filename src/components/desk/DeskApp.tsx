import { useProgress, type CameraControlsImpl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AgXToneMapping } from 'three';
import { framingFor } from './camera';
import { getDeviceProfile, hasWebGL } from './device';
import { FramePacer } from './pacing';
import { Scene } from './Scene';
import type { DeskMap, DeskTrip } from './types';

/**
 * The 3D desk island (mounted by src/pages/index.astro with client:only="react").
 *
 * Two layers: the WebGL <Canvas>, and plain HTML on top of it (loading screen, hint, reset
 * button, and a visually hidden list of every item on the desk for keyboard and screen-reader
 * users). HTML is better than 3D for buttons and text: it's accessible, crisp, and styled with
 * the site's CSS. If there's no WebGL, or the scene crashes, the visitor gets a short note and
 * the link to the plain list of trips instead.
 */
export default function DeskApp({ trips, map }: { trips: DeskTrip[]; map: DeskMap }) {
	// Read once from the browser at startup. (Safe: client:only never runs this on the server.)
	const [profile] = useState(getDeviceProfile);
	const [framing, setFraming] = useState(() => framingFor(window.innerWidth / window.innerHeight));
	const [webgl] = useState(hasWebGL);
	const [ready, setReady] = useState(false);
	// The opened place and the hovered one (by pointer, over the map or a pin, or by keyboard
	// focus). They live here, above the Canvas, so both the 3D scene and the HTML controls
	// (Reset view, Escape, the list of places) can read and change them.
	const [selected, setSelected] = useState<string | null>(null);
	const [hovered, setHovered] = useState<string | null>(null);
	const controlsRef = useRef<CameraControlsImpl | null>(null);
	const onReady = useCallback(() => setReady(true), []);

	const close = useCallback(() => {
		setSelected((current) => {
			// Hand keyboard focus back to the place's button, so Tab carries on from where it was.
			if (current) document.getElementById(`place-${current}`)?.focus({ preventScroll: true });
			return null;
		});
	}, []);

	// Turning a phone between portrait and landscape: switch to the other framing (lens, starting
	// shot, reveal layout) and close any open place. Plain resizes within the same
	// orientation keep the current view; the canvas itself always resizes.
	useEffect(() => {
		const onResize = () => {
			const aspect = window.innerWidth / window.innerHeight;
			setFraming((current) => {
				if (aspect < 1 === current.portrait) return current;
				setSelected(null);
				return framingFor(aspect);
			});
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	// Escape closes an open card.
	useEffect(() => {
		if (!selected) return;
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [selected, close]);

	// Reset view: closing a card already flies home (see CameraRig); otherwise go home directly.
	const resetView = () => (selected ? close() : controlsRef.current?.reset(true));

	if (!webgl) return <Fallback reason="Your browser can't show the 3D desk." />;

	const places = trips.filter((t) => t.map);

	return (
		<SceneErrorBoundary>
			<div className="desk-canvas">
				<Canvas
					// "percentage" = PCF shadows (three.js removed the old "soft" PCF type in r18x;
					// each light's shadow-radius does the softening now).
					shadows="percentage"
					// FramePacer draws the frames: about 60 a second while the desk is in use, fewer
					// while it sits still (pacing.ts).
					frameloop="never"
					dpr={profile.dpr}
					// Far plane: Earth and the stars are tens of metres outside the viewport.
					camera={{ fov: framing.fov, near: 0.05, far: 200, position: framing.position }}
					gl={{ antialias: true, powerPreference: 'high-performance' }}
					// Tone mapping squeezes the scene's unlimited light range into what a screen can
					// show. R3F defaults to ACES, which pushes warm light toward saturated orange; AgX
					// rolls bright warm light off toward cream, like a photo of a tungsten lamp.
					// (With the effect composer on, its ToneMapping pass does this instead.)
					onCreated={({ gl }) => {
						gl.toneMapping = AgXToneMapping;
						gl.toneMappingExposure = 1.15;
					}}
					// A click that hits nothing at all (the dark room) also closes the card.
					onPointerMissed={close}
				>
					<FramePacer />
					<Scene
						profile={profile}
						framing={framing}
						controlsRef={controlsRef}
						trips={trips}
						map={map}
						selected={selected}
						hovered={hovered}
						onHover={setHovered}
						onSelect={setSelected}
						onClose={close}
						onReady={onReady}
						ready={ready}
					/>
				</Canvas>
			</div>

			{/* Keyboard and screen-reader access to the map: one button per place. Tab moves the
			    focus (the pin lifts and its label lights up, the same as hovering), Enter opens it.
			    Visually hidden: the map is the visible version of this list. */}
			<ul className="visually-hidden" aria-label="Places on the map">
				{places.map((t) => (
					<li key={t.slug}>
						<button
							type="button"
							id={`place-${t.slug}`}
							onFocus={() => setHovered(t.slug)}
							onBlur={() => setHovered((h) => (h === t.slug ? null : h))}
							onClick={() => setSelected(t.slug)}
						>
							{t.title}, {t.place}
						</button>
					</li>
				))}
			</ul>

			<div className="desk-hud">
				<div>
					<p className="desk-hint">
						{profile.isMobile ? 'Tap a place on the map · drag to look · pinch to zoom' : 'Click a place on the map · drag to look around · scroll to zoom · right-drag to move'}
					</p>
					{/* Earth's textures are CC BY 4.0: the licence asks for this credit wherever they're shown. */}
					<p className="desk-credit">
						Earth imagery: <a href="https://www.solarsystemscope.com/textures/">Solar System Scope</a>,{' '}
						<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
					</p>
				</div>
				<button type="button" className="deco-tag desk-pill" onClick={resetView}>
					<ResetIcon />
					Reset view
				</button>
			</div>

			<Loader done={ready} />
		</SceneErrorBoundary>
	);
}

/**
 * The loading screen: same markup as the fallback in index.astro, so the hand-over from HTML to
 * React is seamless. useProgress reports drei/three's loading manager (textures, models). The
 * bar sweeps until there's a byte count, then fills, then fades once the first frame is drawn.
 */
function Loader({ done }: { done: boolean }) {
	const { active, progress } = useProgress();
	return (
		<div className={done ? 'loader is-done' : 'loader'} role="status" aria-hidden={done}>
			<p className="loader-title">Unpacking the scrapbook…</p>
			<div className="loader-bar" data-indeterminate={active || done ? undefined : ''}>
				<span style={active || done ? { transform: `scaleX(${done ? 1 : progress / 100})` } : undefined} />
			</div>
		</div>
	);
}

function Fallback({ reason }: { reason: string }) {
	return (
		<div className="desk-notice">
			<p>{reason}</p>
			<a className="deco-tag desk-pill" href="/trips/">
				See every trip as a list
			</a>
		</div>
	);
}

/** If anything in the 3D scene throws (e.g. the GPU context is lost), show the fallback. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };

	static getDerivedStateFromError() {
		return { failed: true };
	}

	componentDidCatch(error: unknown) {
		console.error('3D desk failed:', error);
	}

	render() {
		return this.state.failed ? (
			<Fallback reason="Something went wrong drawing the 3D desk." />
		) : (
			this.props.children
		);
	}
}

function ResetIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
			<polyline points="3.5 3.5 3.5 8.5 8.5 8.5" />
		</svg>
	);
}
