# Atlas: travel.aaronyalong.com

Aaron Yalong's travel scrapbook, a companion to [aaronyalong.com](https://aaronyalong.com).
The home page is a 3D desk in a dark studio at night (React Three Fiber in an Astro island): a
large world map across the desk with a pin for every trip, a banker's lamp, a Nikon and a
journal; black steel shelving with a terminal and Tux; a window onto mountains. Click a place on
the map and that trip's photos rise out of it with its details. Every trip is also
reachable without the 3D at [`/trips`](src/pages/trips.astro).

## Commands

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Dev server at `localhost:4321`                |
| `npm run build`   | Build the static site to `./dist/`            |
| `npm run preview` | Serve the build locally                       |
| `npm run build:deploy` | Build, then fail on visible TODOs, broken internal links or image metadata (what Cloudflare runs) |
| `npm run map`     | Redraw the map texture from `src/lib/map/config.ts` |
| `npm run og`      | Redraw the link-preview card (`public/og/home.jpg`) |

## Where things live

- `src/components/desk/`: the 3D scene. Start at `DeskApp.tsx` (the island) → `Scene.tsx`.
  Camera framing, orbit limits and the opening shot are in `camera.ts`; colours in `palette.ts`.
  The room (wall, window, shelving, terminal, Tux, moonlight) is `Room.tsx`; the lamp is
  `BankersLamp.tsx`; the map and its pins are `WorldMap.tsx` and `Pins.tsx`; what opens when a
  place is clicked is `TripReveal.tsx`; the journal and camera are `Props.tsx`.
- `src/content/trips/`: one Markdown file per trip (schema in `src/content.config.ts`). Put a
  trip's photos in a folder next to it (e.g. `tokyo/cover.jpg`); they're re-encoded at build
  time, which strips EXIF/GPS, and the originals are never published.
- `src/pages/`: `index.astro` (the desk), `trips/` (plain list and per-trip pages), `credits.astro`.
- `src/lib/map/`: the map's crop (`config.ts`) and the projection shared by the texture script
  and the pins (`projection.ts`). To re-centre the map (say, for Europe), edit the config and run
  `npm run map`; the texture lands in `public/map/` and the pins follow at the next build. A trip
  outside the crop gets no pin and a build warning.
- `src/styles/global.css`: design tokens shared with the portfolio, plus the scene colours.

## Assets and credits

Only assets whose licence allows use here (CC0, or CC-BY with credit). Every third-party asset
is listed on [`/credits`](src/pages/credits.astro), whether its licence requires it or not.

- `public/textures/`: ambientCG Wood051, Paper001 and Leather037, re-encoded from the 1K JPG sets
  to WebP without metadata (wood 1024px, paper and leather 512px). Only colour (wood), normal and
  roughness maps are kept.
- `public/env/`: Poly Haven `small_empty_room_1`, the 1k HDR halved to 512×256 (a 2×2 box filter
  in linear light). The scene uses it for reflections and a faint fill; the lamp is the key light.

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
   schema in `src/content.config.ts`). It gets a pin on the map.
2. Put its photos in `src/content/trips/<slug>/` and reference them as `cover` (with
   `coverAlt`) and `photos` (with `alt`, optional `caption`). The cover and up to five more rise
   out of the map when the place is clicked. They're re-encoded at build time; EXIF and GPS are
   stripped.
3. Write the journal as the file's Markdown body.
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
3. `build:deploy` refuses to deploy while any page shows a TODO, so fill in the trips first.
4. Once it's live, give the portfolio's Travel pin its link: `href` on the Travel entry in
   `Portfolio/src/lib/interests.ts`.

Backlog:

- A closed laptop prop with stickers that opens a "How this was built" page (stack, map
  projection, performance notes, repo link).
