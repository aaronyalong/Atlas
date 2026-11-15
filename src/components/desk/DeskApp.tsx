import { useProgress, type CameraControlsImpl } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Component, useCallback, useRef, useState, type ReactNode } from 'react';
import { AgXToneMapping } from 'three';
import { framingFor } from './camera';
import { getDeviceProfile, hasWebGL } from './device';
import { Scene } from './Scene';

/**
 * The 3D desk island (mounted by src/pages/index.astro with client:only="react").
 *
 * Two layers: the WebGL <Canvas>, and plain HTML on top of it (loading screen, hint, reset
 * button). HTML is better than 3D for buttons and text: it's accessible, crisp, and styled with
 * the site's CSS. If there's no WebGL, or the scene crashes, the visitor gets a short note and
 * the link to the plain list of trips instead.
 */
export default function DeskApp() {
	// Read once from the browser at startup. (Safe: client:only never runs this on the server.)
	const [profile] = useState(getDeviceProfile);
	const [framing] = useState(() => framingFor(window.innerWidth / window.innerHeight));
	const [webgl] = useState(hasWebGL);
	const [ready, setReady] = useState(false);
	const controlsRef = useRef<CameraControlsImpl | null>(null);
	const onReady = useCallback(() => setReady(true), []);

	if (!webgl) return <Fallback reason="Your browser can't show the 3D desk." />;

	return (
		<SceneErrorBoundary>
			<div className="desk-canvas">
				<Canvas
					// "percentage" = PCF shadows (three.js removed the old "soft" PCF type in r18x;
					// the Lamp's shadow-radius does the softening now).
					shadows="percentage"
					dpr={profile.dpr}
					camera={{ fov: framing.fov, near: 0.05, far: 20, position: framing.position }}
					gl={{ antialias: true, powerPreference: 'high-performance' }}
					// Tone mapping squeezes the scene's unlimited light range into what a screen can
					// show. R3F defaults to ACES, which pushes warm light toward saturated orange; AgX
					// rolls bright warm light off toward cream, like a photo of a tungsten lamp.
					onCreated={({ gl }) => {
						gl.toneMapping = AgXToneMapping;
						gl.toneMappingExposure = 1.15;
					}}
				>
					<Scene profile={profile} framing={framing} controlsRef={controlsRef} onReady={onReady} />
				</Canvas>
			</div>

			<div className="desk-hud">
				<p className="desk-hint">
					{profile.isMobile ? 'Drag to look · pinch to zoom' : 'Drag to look around · scroll to zoom'}
				</p>
				<button type="button" className="desk-pill" onClick={() => controlsRef.current?.reset(true)}>
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
 * React is seamless. useProgress reports drei/three's loading manager (models, image textures).
 * Phase 1 downloads nothing, so it shows the sweep until the first frame is drawn, then fades.
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
			<a className="desk-pill" href="/trips">
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
