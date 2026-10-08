# gosamab.github.io

Personal portfolio site for Osama Azab, built with [Astro 6](https://astro.build) (static output) and [Tailwind CSS v4](https://tailwindcss.com), deployed to GitHub Pages at [gosamab.github.io](https://gosamab.github.io).

## Requirements

- Node.js 22.12 or newer (Astro 6 requirement)

## Commands

| Command | Action |
| :--- | :--- |
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Build the static site to `./dist/` |
| `npm run preview` | Serve the built `./dist/` locally |
| `npm run astro check` | Type-check `.astro` files |

## Deployment

GitHub Actions (`.github/workflows/astro-gh-pages.yml`) runs on every push to `master`, builds the site and publishes it with `actions/deploy-pages`. The repo's Pages source is set to "GitHub Actions".

## Project structure

```
src/
├── components/    Reusable Astro components (DesktopIcon, ProjectCard)
├── layouts/       BaseLayout (site shell), WindowChrome, ProjectLayout (project pages)
├── pages/         File-based routes (desktop, home, experience, skills, credentials, projects/<slug>)
├── scripts/       Desktop window manager and icon arranger
└── styles/        global.css, the single Tailwind entry
public/            Static assets served at the root (CV.pdf, me.jpg, favicon.svg)
```

Adding a project takes two edits: add an icon to the `projects` array in `src/pages/projects.astro` and create a matching `src/pages/projects/<slug>.astro` page that uses `ProjectLayout`.
