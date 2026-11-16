# Atlas: travel.aaronyalong.com

Aaron Yalong's travel scrapbook, a companion to [aaronyalong.com](https://aaronyalong.com).
The home page is a lamp-lit 3D desk (React Three Fiber in an Astro island). Every trip is also
reachable without the 3D at [`/trips`](src/pages/trips.astro).

## Commands

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Dev server at `localhost:4321`                |
| `npm run build`   | Build the static site to `./dist/`            |
| `npm run preview` | Serve the build locally                       |

## Where things live

- `src/components/desk/`: the 3D scene. Start at `DeskApp.tsx` (the island) → `Scene.tsx`.
  Camera framing and orbit limits are in `camera.ts`; colours in `palette.ts`.
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

- `public/textures/`: ambientCG Wood051 and Paper001, re-encoded from the 1K JPG sets to WebP
  (wood 1024px, paper 512px). Only colour (wood), normal and roughness maps are kept.
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
4. Trip pages (2D scrapbook)
5. Props and polish (passport, tickets, journal, camera)
6. Deploy to travel.aaronyalong.com (Cloudflare Worker, same setup as the portfolio)

Backlog:

- A closed laptop prop with stickers that opens a "How this was built" page (stack, map
  projection, performance notes, repo link).
