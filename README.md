# Kanji Observatory

A frontend-only React dashboard for WaniKani. It runs on GitHub Pages with no backend, secrets, database server, or proxy. Node is needed only for development/builds.

## Local development

Requires Node 20.19+ or 22.12+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000 and enter your own WaniKani v2 API token. Create one at https://www.wanikani.com/settings/personal_access_tokens with all create/update/delete permissions unchecked. The app exclusively uses GET requests; it cannot inspect the token's permissions, so it does not reject tokens that happen to have write permissions.

```sh
pnpm test
pnpm build
pnpm preview
```

## GitHub Pages

1. Push this repository to GitHub, using `main` as the deployment branch (or change `.github/workflows/deploy.yml`).
2. In repository Settings → Pages, select **GitHub Actions** as the source.
3. Push to `main` or run the deployment workflow manually.

The workflow tests, builds, and publishes only `dist/`. No API token or repository secret is needed. Vite uses relative asset paths, supporting both root and `/repository/` Pages URLs. Navigation is in React state, with no nested routes that require server rewrites. For a manual deployment, publish the contents of `dist/` to your static host.

## Token and privacy

Tokens default to sessionStorage: retained through reloads in the current tab, removed when the tab closes. Opt-in “Remember on this device” uses localStorage until disconnect. Neither is attached automatically to HTTP requests like cookies. The token is sent only in the Authorization header of HTTPS requests to `https://api.wanikani.com/v2/`; pagination URLs are validated before any request. Credentials are never embedded in the app bundle, URL, IndexedDB cache, logs, or GitHub Actions secrets.

Browser storage is accessible to same-origin JavaScript, including other apps hosted on the same GitHub Pages origin. It is not equivalent to a server-side secret or HttpOnly cookie. Use a trusted device and a read-only token. No third-party scripts, analytics, or remote fonts are loaded. Disconnect aborts current work, removes the token in this tab and remembered token, and clears the study cache associated with that token. Other already-open tabs retain their session tokens until disconnected/closed. Browser site settings can clear all stored app data. If token storage is unavailable, the UI reports that the token remains in memory only.

## Cache and request budget

WaniKani documents **60 requests per minute** and HTTP 429 responses: https://docs.api.wanikani.com/20170710/#rate-limit

- A single sequential request queue spaces all API request starts at least **2.1 seconds** apart: at most 29 starts in a rolling minute, leaving headroom for other WaniKani apps.
- Web Locks coordinate requests and full dashboard syncs across tabs on this origin using the token's SHA-256 fingerprint. A small localStorage timestamp carries pacing/cooldown through reloads. HTTPS (or localhost), Web Locks, and localStorage are required for safe coordination.
- IndexedDB persists account-scoped resource caches across reloads. Fresh caches avoid network requests entirely, including when Refresh is clicked. Concurrent refreshes in one tab share a promise; waiting tabs recheck the cache after obtaining the sync lock.
- TTLs: summary **1 minute**, user/assignments **5 minutes**, review statistics **15 minutes**, level progressions **1 hour**, subjects **24 hours**. Subjects are scoped to levels 1 through the current level. Level changes get a separate subject cache key.
- Complete collections follow all pagination URLs; a collection is cached only after every page succeeds. No partial totals are shown. Long initial syncs show progress and are paced throughout.
- HTTP 429 triggers up to three retries after a minimum 61-second cooldown, honoring Retry-After and RateLimit-Reset when exposed by CORS. Exhausted RateLimit-Remaining also schedules a cooldown. Without exposed headers the conservative fallback still applies.
- Disconnect cancels queued work. Network failures retain already loaded dashboard data and show an error; incomplete requests do not replace their resource cache. An initial offline load does not present expired cache as current.
- IndexedDB failures fall back to network with normal rate pacing. There is no background polling or force-refresh bypass. The footer shows the oldest resource timestamp so mixed cache ages remain visible.

Other devices, origins, or apps cannot share this queue; a token can still be rate limited by outside usage, which is why 429 handling remains necessary. Full resource refreshes intentionally replace complete collections, avoiding stale entries after resets. A large account's first sync may take several minutes.

## Features and files

Overview: available reviews/lessons, weighted lifetime answer accuracy, SRS distribution, next-day review arrivals. Subject explorer: Japanese/meaning/reading search, type filters, progress and accuracy. API field guide: six connected sources and possible future features.

- `src/api.js`: read-only API client, pagination, rate limiting, cache policies, cancellation.
- `src/storage.js`: token lifecycle and IndexedDB cache.
- `src/main.jsx`: setup screen and dashboard UI.
- `src/style.css`: responsive styles.
- `.github/workflows/deploy.yml`: static deployment.


## Review recovery plan

The Review plan tab turns your daily time budget, session count, maximum session size, and estimated pace into daily review targets. Defaults: 20 minutes/day, two sessions, at most 20 reviews/session, two reviews/minute. Targets reset each local calendar day; there is no missed-day penalty. Extremely tight budgets reduce the number of usable session slots to keep the estimated workload within budget.

The seven-day forecast starts with active, non-hidden assignments due now, adds known next-review arrivals by local date, and subtracts planned review capacity. An adjustable repeat allowance (default ten/day, prorated for the rest of today) adds a planning buffer for later returns that current assignment dates cannot predict. It assumes no new lessons; it is not an exact SRS simulation or a promised clearance date. Vacation mode is flagged. Planner assignment checks use a one-minute freshness window on the shared IndexedDB cache, without bypassing the request queue or rate limits. A check within a minute may reuse a snapshot predating your recent session; the displayed timestamp makes that visible.

WaniKani’s GET /reviews endpoint is deprecated and returns an empty array. Consequently, “Logged today” is the sum of review counts from sessions you report here, not an automatically measured API completion count. Reviews done elsewhere are not automatically counted. The backlog comes independently from current assignment dates, so new arrivals do not erase logged progress. API reference: https://docs.api.wanikani.com/20170710/#get-all-reviews

Start a session, open WaniKani, stop at your target or earlier, then return to check the queue and log completed reviews and focused minutes. The app cannot control WaniKani’s queue. After two positive session reports, the last five positive reports calibrate pace. Dismissing a session creates no local progress entry; it never changes WaniKani data. Active sessions survive navigation/reloads. Preferences, active session, and the last 100 session logs live in the account-scoped IndexedDB cache, guarded by a Web Lock; disconnect clears them with study data. Another tab’s changes are loaded by Check progress. Storage failures are reported without pretending the plan was saved.
