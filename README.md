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
- `src/pages/`: `index.astro` (the desk), `trips.astro` (plain list), `credits.astro`.
- `src/styles/global.css`: design tokens shared with the portfolio, plus the scene colours.

## Assets and credits

Only assets whose licence allows use here (CC0, or CC-BY with credit). Every third-party asset
is listed on [`/credits`](src/pages/credits.astro), whether its licence requires it or not.

## Roadmap

1. ~~Empty desk, lighting, camera~~
2. Polaroids from trip data, hover and click
3. World map with lat/lng pins (Natural Earth projection, cropped, pins computed at build time)
4. Trip pages (2D scrapbook)
5. Props and polish (passport, tickets, journal, camera)
6. Deploy to travel.aaronyalong.com (Cloudflare Worker, same setup as the portfolio)

Backlog:

- A closed laptop prop with stickers that opens a "How this was built" page (stack, map
  projection, performance notes, repo link).
