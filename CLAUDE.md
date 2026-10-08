# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio site for Osama Azab, built with Astro 6 (static output) and deployed to GitHub Pages at `gosamab.github.io`.

## Commands

- `npm run dev` — local dev server at `localhost:4321`
- `npm run build` — static build to `./dist/`
- `npm run preview` — serve the built `./dist/` locally
- `npm run astro check` — type-check `.astro` files (no test suite or linter is configured)

## Deployment

GitHub Actions (`.github/workflows/astro-gh-pages.yml`) builds on every push to `master` and publishes `./dist/` with `actions/upload-pages-artifact` + `actions/deploy-pages`. The repo's Pages source is set to "GitHub Actions", so pushing to a `gh-pages` branch has no effect.

CI runs `npm ci` on Node 22 (npm 10). Regenerate `package-lock.json` with `npx npm@10 install` so it stays valid for CI; a lockfile from a newer npm can fail `npm ci` there.

`astro.config.mjs` sets `base: "/"` (correct for a user/organization site at the root domain). If this repo is ever renamed to a project page, `base` must change.

## Architecture

- **Astro static site.** `output: "static"` — every page is prerendered; there is no SSR runtime. All asset paths in components must be root-relative (`/images/...`) and live under `public/`.
- **Styling: Tailwind v4 via Vite plugin** (`@tailwindcss/vite`). There is no `tailwind.config.js` — Tailwind v4 uses CSS-first config. The single entry is `src/styles/global.css` (`@import "tailwindcss"`) imported once from `BaseLayout.astro`.
- **Layout hierarchy:**
  - `src/layouts/BaseLayout.astro` — shell (header nav, footer, global CSS import). Every page uses this.
  - `src/layouts/ProjectLayout.astro` — wraps `BaseLayout` and renders the project detail chrome (title, tag pills, demo/GitHub buttons, hero image, `<slot />` for body). Project detail pages should use this.
- **Adding a project requires two edits, not one.** The projects index (`src/pages/projects.astro`) holds an inline `projects` array of folder icons; each `href` must point at a file at `src/pages/projects/<slug>.astro` (Astro's file-based routing — no dynamic `[slug].astro` exists). Adding a project = append to the array AND create the matching `.astro` page using `ProjectLayout`.
- **TypeScript** extends `astro/tsconfigs/strict`.
