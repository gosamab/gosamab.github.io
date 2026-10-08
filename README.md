# gosamab.github.io

Personal portfolio site for Osama Azab — built with [Astro 6](https://astro.build) (static output) and [Tailwind CSS v4](https://tailwindcss.com), deployed to GitHub Pages at [gosamab.github.io](https://gosamab.github.io).

## Requirements

- Node.js ≥ 22.12 (Astro 6 requirement)

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build the static site to `./dist/` |
| `npm run preview` | Serve the built `./dist/` locally |
| `npm run astro check` | Type-check `.astro` files |
| `npm run deploy` | Manually publish `./dist/` to the `gh-pages` branch |

## Deployment

Two paths to GitHub Pages exist:

1. **GitHub Actions** (`.github/workflows/astro-gh-pages.yml`) — primary path; runs on every push to `master`, builds, and publishes via `peaceiris/actions-gh-pages@v4`.
2. **`npm run deploy`** — manual fallback that pushes `./dist/` to the `gh-pages` branch via the `gh-pages` npm package.

`astro.config.mjs` sets `base: "/"` (correct for a user/organization site at the root domain).

## Project structure

```
src/
├── components/    Reusable Astro components (e.g. ProjectCard)
├── layouts/       BaseLayout (site shell) and ProjectLayout (project detail chrome)
├── pages/         File-based routes (index, about, contact, cv, projects, projects/<slug>)
└── styles/        global.css — single Tailwind entry (@import "tailwindcss")
public/            Static assets served at the root (CV.pdf, me.jpg, favicon.svg)
```

Adding a project requires two edits: append a card to the `projects` array in `src/pages/projects.astro` and create a matching `src/pages/projects/<slug>.astro` page that uses `ProjectLayout`.
