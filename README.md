# maproulette-review

A MapRoulette plugin that adds task review functionality. Built as a standalone JS bundle and loaded at runtime by the MapRoulette core app.

## Architecture

This plugin is an IIFE bundle (`maprouletteReviewPlugin.js`) that registers itself on `window.maprouletteReviewPlugin`. The core app loads it via a `<script>` tag based on `VITE_DEPLOYMENT_PLUGIN_URLS` in `env.json`. The plugin uses the host app's React instance and UI components — it does not bundle its own.

## What it adds

- **Review** nav item
- **/review** page with a review queue table
- **Request review** checkbox in the task action modal
- **Review actions panel** (claim, approve, reject) on task pages opened with `?review=true`

## Local development

### Prerequisites

- Node.js 20+
- `maproulette3` repo at `../maproulette3`
- `maproulette-backend` running on `:9000`

### Build and deploy to core

```bash
npm install
npm run deploy:local
```

This builds the plugin and copies `maprouletteReviewPlugin.js` into `../maproulette3/dist/plugins/review/`.

Then in the `maproulette3` repo:

```bash
npm run preview
```

Open `http://127.0.0.1:3001`.

### Core `.env` configuration

The core app needs this in its `.env`:

```
VITE_DEPLOYMENT_PLUGIN_URLS="/plugins/review/maprouletteReviewPlugin.js"
```

### Development with watch

For iterative plugin development:

```bash
npm run watch
```

This rebuilds the bundle on every file change. After each rebuild, run `npm run deploy:local` to copy the updated bundle, then refresh the browser.

## Docker / production

In production, `maproulette4-docker` handles the build and assembly:

1. `deploy.sh -r` builds this repo's Dockerfile (build-only, no runtime container)
2. Extracts `maprouletteReviewPlugin.js` from the build image
3. Copies it into the frontend image at `/srv/www/plugins/review/`
4. The frontend serves it as a static file — no separate container or proxy needed

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the plugin bundle |
| `npm run deploy:local` | Build and copy to `../maproulette3/dist/plugins/review/` |
| `npm run watch` | Rebuild on file changes |
| `npm run dev` | Run the standalone app shell (for isolated plugin development) |
| `npm run dev:plugin` | Watch + preview (for serving the bundle on `:4201`) |
| `npm run preview` | Serve the built bundle on `:4201` |
