# Atlas: travel.aaronyalong.com

Aaron Yalong's travel scrapbook, a companion to [aaronyalong.com](https://aaronyalong.com).
The home page is a 3D desk on an observation deck in orbit (React Three Fiber in an Astro
island): a large world map across the desk with a pin for every trip and a banker's lamp at
its corner, under a broad viewport onto Earth, where a shooting star, a meteor and a rocket go by now and then. Click a place on
the map and that trip's photos rise out of it with its details. Every trip is also
reachable without the 3D at [`/trips`](src/pages/trips.astro).

## Commands

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Dev server at `localhost:4321`                |
| `npm run build`   | Build the static site to `./dist/`            |
| `npm run preview` | Serve the build locally                       |
| `npm run build:deploy` | Build, list visible TODOs, then fail on broken internal links or image metadata (what Cloudflare runs) |
| `npm run map`     | Redraw the map texture from `src/lib/map/config.ts` |
| `npm run og`      | Redraw the link-preview card (`public/og/home.jpg`) |

## Where things live

- `src/components/desk/`: the 3D scene. Start at `DeskApp.tsx` (the island) → `Scene.tsx`.
  Camera framing, orbit limits and the opening shot are in `camera.ts`; colours in `palette.ts`.
  The room (wall panels, brass trim, sunlight and lights) is `Room.tsx`, its measurements
  `roomLayout.ts`; the art deco viewport (bronze and brass recess, gold cove light) is
  `Viewport.tsx`; the gauge panel (station gauges / world clocks, click to swap) is `Gauges.tsx`;
  Earth, the stars and the passing events are `SpaceView.tsx`; the desk is `Desk.tsx`; the lamp
  is `BankersLamp.tsx`; the shaft of sunlight and its dust are `SunBeam.tsx`; the map and its
  pins are `WorldMap.tsx` and `Pins.tsx`; what opens when a place is clicked is `TripReveal.tsx`.
  `pacing.ts` keeps it light when idle: about 60 frames a second while it's in use, 30 to 40
  while it sits still, and shadows drawn once, then again only when something casting one
  moves. An animation calls `wake()` each frame it runs, plus `refreshShadows()` if its object
  casts a shadow. It rests at 15 frames a second after 30 s untouched, and 10 while the window is
  in the background. If frames are slow while it's in use, it steps down the quality ladder in
  `device.ts` (resolution, then ambient occlusion); the browser remembers the step it settled on,
  and if even the lowest is too slow, the desk offers the list of trips. Browsers that would draw
  3D without a graphics card (`webglSupport()` in `device.ts`) get the list straight away.
- `src/content/trips/`: one Markdown file per trip (schema in `src/content.config.ts`). Put a
  trip's photos in a folder next to it (e.g. `tokyo/cover.jpg`); they're re-encoded at build
  time, which strips EXIF/GPS, and the originals are never published.
- `src/pages/`: `index.astro` (the desk), `trips/` (the list of trips and each trip's page), `404.astro`.
- `src/lib/map/`: the map's crop (`config.ts`) and the projection shared by the texture script
  and the pins (`projection.ts`). To re-centre the map (say, for Europe), edit the config and run
  `npm run map`; the texture lands in `public/map/` and the pins follow at the next build. A trip
  outside the crop gets no pin and a build warning.
- `src/styles/global.css`: design tokens (the art deco palette: gold, ivory, bronze, navy; Poiret
  One and Josefin Sans) and the shared deco pieces (`.deco-tag`, `.deco-rule`, `.caps`);
  `desk.css` styles the desk's HUD, pin labels and trip card.

## Assets and credits

Only assets whose licence allows use here (public domain, CC0, OFL, or CC BY with credit). This
list is the record of every third-party asset; the site itself shows only the one credit a
licence requires: Earth's textures (CC BY 4.0), credited in a line on the desk and in the 2D
pages' footer.

- Fonts (SIL Open Font License 1.1, via Fontsource): Poiret One (Denis Masharov) for titles,
  Josefin Sans (Santiago Orozco) for everything else, Caveat (Pablo Impallari) for handwriting.
- Map data: Natural Earth (public domain), via the world-atlas package, drawn with d3-geo; noted
  on the map itself.

- `public/textures/`: ambientCG Wood051 and Paper001, re-encoded from the 1K JPG sets to WebP
  (the wood's colour map graded from walnut to a smoked oak: saturation down to about a fifth, a
  cool cast, a little more grain contrast)
  without metadata (wood 1024px, paper 512px). Only colour (wood), normal and
  roughness maps are kept.
- `public/space/`: Solar System Scope's Earth day, night and cloud maps (CC BY 4.0, credited on
  the site), from the 8k originals: 4096 and 2048 px (clouds 2048 and 1024 px), WebP, no
  metadata. Desktop loads the larger set, phones the smaller.
- `public/env/`: Poly Haven `small_empty_room_1`, the 1k HDR halved to 512×256 (a 2×2 box filter
  in linear light). The scene uses it for reflections and a faint fill; the sunlight, the ceiling light and the
  lamp are the key lights.

## Dev-only pages

`src/pages/dev/[page].astro` serves `/dev/compare` under `npm run dev` only: a production build
emits nothing for it. It shows before/after sliders for the realism pass from screenshots in
`src/dev-shots/` (git-ignored, local only).

## Roadmap

1. ~~Empty desk, lighting, camera~~
2. ~~Polaroids from trip data, hover and click~~
3. ~~World map with lat/lng pins (Natural Earth projection, cropped, pins computed at build time)~~
4. ~~Trip pages (2D scrapbook)~~
5. ~~Props and polish (passport, tickets, journal, camera)~~
6. ~~Deploy setup for travel.aaronyalong.com (Cloudflare Worker, same setup as the portfolio)~~

## Adding a trip

1. Add `src/content/trips/<slug>.md` with at least `title`, `place`, `lat`, `lng` (see the
   schema in `src/content.config.ts`). It gets a pin on the map. Add `timeZone` (an IANA name
   such as `Asia/Tokyo`) for a world clock on the gauge panel; the first five trips with one
   get a clock.
2. Put its photos in `src/content/trips/<slug>/` and reference them as `cover` (with
   `coverAlt`) and `photos` (with `alt`, optional `caption`). The cover and up to five more rise
   out of the map when the place is clicked. They're re-encoded at build time, so the site never
   shows EXIF or GPS, but the files themselves are committed to a public repo: strip them first
   (`npm run check:exif` fails on any that still carry metadata).
3. Optionally, a `blurb` and a journal (the file's Markdown body); without them, they're left out.
4. If it's outside the map's crop, the build warns: widen `src/lib/map/config.ts` and run
   `npm run map`. Run `npm run og` to put its pin on the link-preview card.

## Deploying

The same setup as the portfolio: Cloudflare Workers with static assets, built by Cloudflare from
GitHub. `wrangler.jsonc` names the Worker `atlas` and attaches `travel.aaronyalong.com` as a
custom domain (Cloudflare creates the DNS record and certificate on the first deploy, since
`aaronyalong.com` is in the same account).

1. Push this repo to GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Import a repository → pick it. Build
   command `npm run build:deploy`, deploy command `npx wrangler deploy`.
3. Every push to `main` redeploys. Trips without content go live with their visible TODO
   placeholders (`build:deploy` lists them in the build log); `npm run check:todos` fails until
   none are left.
4. Once it's live, give the portfolio's Travel pin its link: `href` on the Travel entry in
   `Portfolio/src/lib/interests.ts`.

Backlog:

- A closed laptop prop with stickers that opens a "How this was built" page (stack, map
  projection, performance notes, repo link).
