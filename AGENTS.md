# Repository Guidelines

## Project Structure & Module Organization

GaiaTrack is a Costa Rica environmental observatory with a vanilla JavaScript frontend and Node.js weather services.

- `public/`: HTML, CSS, browser ES modules, and the Three.js experience. Scientific calculations live in modules such as `science.js` and `earth-pulse.js`.
- `public/data/`: historical NASA POWER records, geographic boundaries, site manifests, and forecast snapshots. `public/vendor/` contains bundled libraries.
- `scripts/`: local HTTP server, provider services, data ingestion, and deployment validation.
- `api/`: Vercel endpoints for current conditions and forecasts; `server/` contains shared HTTP and cache policies.
- `tests/`: automated tests; `docs/LICENSING.md` records licensing considerations. `.github/workflows/ci-deploy.yml` runs CI.

## Build, Test, and Development Commands

Use Node.js **26.x**, matching `package.json` and CI. No package installation is currently required.

- `npm start` or `npm run dev`: serve the application and APIs at `http://127.0.0.1:4173`; optionally load `.env.local`. Use this server instead of opening HTML directly.
- `npm test`: run all `tests/*.test.mjs` using Node's built-in test runner.
- `npm run build`: validate required deployment files, JavaScript syntax, and historical data for manifest sites; it does not bundle assets.
- `npm run data`: fetch historical data; `npm run data:refresh` explicitly refreshes it. Review generated changes before committing.
- `npm run deploy`: deploy a Vercel preview; `npm run deploy:prod`: deploy production.

## Coding Style & Naming Conventions

Use ES modules, `.js` for browser code, and `.mjs` for Node code. Follow nearby formatting; readable modules use two-space indentation, single quotes, and semicolons. Use camelCase for functions and variables, UPPER_SNAKE_CASE for constants, and kebab-case filenames and site IDs, such as `san-rafael`. No formatter or linter is configured. Preserve Spanish interface copy and scientific units.

## Testing Guidelines

Use `node:test` and `node:assert/strict`; name files `<feature>.test.mjs` with descriptive test cases. Cover changed calculations, missing values, provider normalization, cache expiry, and API behavior as applicable. No coverage threshold is configured. Run `npm test` and `npm run build` before submitting; visually check interface changes locally.

## Commit & Pull Request Guidelines

History uses concise, imperative English subjects, such as `Add location-aware ecological and weather recommendations`. Keep commits focused. PRs should explain behavior, list validation results, link relevant issues, and include screenshots for visual changes. Pushes to `main` trigger production deployment; other branches generate previews.

## Configuration & Data Integrity

Keep `.env*`, `.cache/`, and `.vercel/` out of commits. Preserve source attribution, retrieval timestamps, units, and missing-data semantics. Never substitute simulated data for unavailable observations or forecasts.
