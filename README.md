# Kanji Horizon

A single React view estimating when you will reach new WaniKani levels. The Vite scaffolding, GitHub Pages deployment, read-only API client, pagination, request pacing, and browser token storage remain in place.

## Development

Requires Node 20.19+ or 22.12+ and pnpm 11.

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Open http://localhost:3000. The browser only reads `public/progress.json` and renders the forecast. It does not call WaniKani, ask for a token, write snapshots, or use browser persistence. React state holds the loaded file only while displaying the page.

## Daily collection

The GitHub Actions workflow is the only snapshot writer:

1. Add a repository Actions secret named `WANIKANI_API_TOKEN` with your read-only token from https://www.wanikani.com/settings/personal_access_tokens. Leave write permissions unchecked.
2. Enable Actions and permit workflow writes to repository contents. Branch rules must allow snapshot commits.
3. Run **Daily kanji snapshot** manually once. It subsequently runs at 12:00 UTC daily (6 am CST / 7 am CDT). GitHub schedules can be delayed.
4. Enable Pages with GitHub Actions. A successful snapshot triggers the deployment workflow to rebuild from `main`.

The scheduled workflow runs on the default branch; the supplied deployment targets `main`. No dependencies are needed to run the daily script.

`public/progress.json` contains your numeric WaniKani user ID, daily level, passed-kanji count and per-level totals. It is committed and published with the website. Enable this workflow only if you are comfortable sharing these progress statistics. The API token remains an Actions secret and is never written into the JSON or frontend bundle.

Run locally with the token already in your environment:

```sh
pnpm snapshot
```

`WANIKANI_PROGRESS_FILE` optionally overrides the output path, which defaults to `public/progress.json`. Use one writer per file. Invalid JSON and account mismatches fail without overwriting history. Writes use atomic rename. The published JSON is the sole source of displayed history.

## Calculation

Counts visible kanji assignments with `passed_at` set: kanji that have reached Guru at least once, including later stages and subsequent demotions. Vocabulary and radicals are excluded. Each level needs `ceil(0.9 × visible kanji on that level)` passes. Estimates sum the remaining thresholds of the current and intervening levels and divide by the observed increase in total passed kanji per elapsed day over up to 28 days.

At least two distinct dates and positive growth are required to estimate a date. These are pace estimates, not an SRS simulation: radical unlocks, review schedules, and lesson choices affect actual dates. Old-level kanji can overstate progress toward new levels. A lower level or passed count starts a new history series to avoid using pre-reset pace. No past snapshots are fabricated.

## Source

- `src/main.jsx`, `src/style.css`: read-only forecast view.
- `src/forecast.js`: counts, snapshots, forecasts.
- `src/api.js`, `src/storage.js`: API client and legacy storage utilities (not imported by the frontend).
- `scripts/snapshot.mjs`: daily collector.
- `.github/workflows/snapshot.yml`: daily scheduling.
- `.github/workflows/deploy.yml`: validation and Pages deployment.

Previous planner/cartoon modules remain unused; their views are removed from the app.

## Visual treatments

The default home URL retains the original design. Add a query parameter to preview alternate styles with the same snapshots and forecasting behavior:

- `?theme=tokyo`: Tokyo subway signage, numbered stations, orange route line, yellow dividers.
- `?theme=blog`: pastel block mosaic, dashed MF mark, blue links, bordered white panels.

Unknown theme values use the default design. Theme selection lives only in the URL; it is not stored in the browser. Edit `src/themes.css` for the alternate styles, and `src/blog-mosaic.svg` for the blog background. The original styling stays in `src/style.css`.
