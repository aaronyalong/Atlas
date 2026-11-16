/**
 * Dev-only: lists and reads the local screenshots in src/dev-shots/ for /dev/compare.
 *
 * Read from disk at request time (never imported through Vite), so no screenshot can end up in a
 * production build. Node's `fs` is loaded by a computed specifier with just the two functions
 * typed here, which keeps the project free of @types/node for one dev page.
 */
interface Fs {
	readdirSync(path: string): string[];
	readFileSync(path: string): Uint8Array<ArrayBuffer>;
}

const nodeProcess = (globalThis as unknown as { process: { cwd(): string } }).process;
const DIR = `${nodeProcess.cwd()}/src/dev-shots`;
const loadFs = (): Promise<Fs> => import(/* @vite-ignore */ ['node', 'fs'].join(':'));

/** File names of the screenshots, or [] if the folder doesn't exist (e.g. a fresh clone). */
export async function listShots(): Promise<string[]> {
	try {
		return (await loadFs()).readdirSync(DIR).filter((f) => /^[\w.-]+\.jpg$/.test(f));
	} catch {
		return [];
	}
}

/** A screenshot's bytes, or null for anything that isn't a plain .jpg name in the folder. */
export async function readShot(file: string): Promise<Uint8Array<ArrayBuffer> | null> {
	if (!/^[\w.-]+\.jpg$/.test(file)) return null;
	try {
		return (await loadFs()).readFileSync(`${DIR}/${file}`);
	} catch {
		return null;
	}
}
