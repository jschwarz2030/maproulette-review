# maproulette-review

A MapRoulette plugin that adds task review functionality. Built as a standalone JS bundle and loaded at runtime by the MapRoulette core app.

## Architecture

This plugin is an IIFE bundle (`maprouletteReviewPlugin.js`) that registers itself on `window.maprouletteReviewPlugin`. The core app loads it via a `<script>` tag based on `VITE_DEPLOYMENT_PLUGIN_URLS` in `env.json`. The plugin uses the host app's React instance and UI components — it does not bundle its own.

## What it adds

- **Review dashboard** (`/review`) — role-aware table + side panel:
  - **Mappers**: tasks you've mapped/requested review for; Needs revision (Rejected/Disputed) sorted first; filter chips; row click opens preview + comments
  - **Reviewers**: To review / My reviews tabs; re-review priority; same side panel triage UX
- **`/reviewed`** redirects to the same dashboard (bookmark-compatible)
- **Request review** on task completion (status update query param)
- **Review actions panel** (lock, approve, reject) on task pages opened with `?review=true`
- **Volunteer as a Reviewer** field injected into Account → General via `getUserSettingsFields`

## Local development

### Prerequisites

- Node.js 20+
- `maproulette3` repo at `../maproulette3`
- `maproulette-backend` running on `:9000`

### Build and deploy to core (minified, production-like)

```bash
npm install
npm run deploy:local
```

This builds the **minified** plugin (with source maps) and copies
`maprouletteReviewPlugin.js` + `.map` into `../maproulette3/dist/plugins/review/`.

Then in the `maproulette3` repo:

```bash
npm run preview   # or npm run dev — both serve /plugins/ from dist/
```

Open `http://127.0.0.1:3001` (preview) or the dev server port.

This is the best way to reproduce production minified failures locally: same IIFE
bundle the host loads in Docker, with DevTools able to decode stacks via the
sibling `.map` file.

### Serve the minified bundle on :4201

If you prefer loading the plugin from a separate origin (like production CDN):

```bash
npm run serve:min
```

Point the host `.env` at:

```
VITE_DEPLOYMENT_PLUGIN_URLS="http://localhost:4201/maprouletteReviewPlugin.js"
```

Host must be in **dev** mode (`npm run dev`) so `localhost` is on the plugin
allowlist. Enable "Enable JavaScript source maps" in DevTools.

### Core `.env` configuration

Same-origin (recommended for local diagnosis after `deploy:local`):

```
VITE_DEPLOYMENT_PLUGIN_URLS="/plugins/review/maprouletteReviewPlugin.js"
```

Remote preview server:

```
VITE_DEPLOYMENT_PLUGIN_URLS="http://localhost:4201/maprouletteReviewPlugin.js"
```

### Development with watch

For iterative plugin development:

```bash
npm run watch
```

This rebuilds the bundle on every file change. After each rebuild, run `npm run deploy:local` to copy the updated bundle + map, then refresh the browser.

## Diagnosing production / minified errors

Host wraps every contributed component in `PluginErrorBoundary` when collecting
contributions in `PluginContext` (via `wrapPluginComponent`). On a render failure
you should see:

1. A fallback UI with the error message (not a blank screen)
2. `console.error('[Plugin] Render error in …', error, componentStack)` with an expandable stack
3. A structured `[Plugin]` logger line that includes `message` / `stack` (Errors are no longer serialized as `{}`)

With source maps deployed next to the bundle, Chrome maps minified frames back to `src/…` files.

## Docker / production

In production, `maproulette4-docker` handles the build and assembly:

1. `deploy.sh -r` builds this repo's Dockerfile (build-only, no runtime container)
2. Extracts `maprouletteReviewPlugin.js` from the build image
3. Copies it into the frontend image at `/srv/www/plugins/review/`
4. The frontend serves it as a static file — no separate container or proxy needed

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the minified plugin bundle + source map |
| `npm run deploy:local` | Build and copy JS + map to `../maproulette3/dist/plugins/review/` |
| `npm run serve:min` | Build and serve the minified bundle on `:4201` |
| `npm run watch` | Rebuild on file changes |
| `npm run test` | Run Vitest suite |
| `npm run dev` | Run the standalone app shell (for isolated plugin development) |
| `npm run dev:plugin` | Watch + preview (for serving the bundle on `:4201`) |
| `npm run preview` | Serve the already-built bundle on `:4201` |
