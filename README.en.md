<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/img/fabbit-logo-dark.png">
    <img src="docs/img/fabbit-logo.png" width="368" alt="Fabbit">
  </picture>
</h1>

<p align="center">Landing page for Fabbit, an FPGA-based pocket instrument for electronics engineers.</p>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-6e7781?style=for-the-badge" alt="Русский"></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/English-0969da?style=for-the-badge" alt="English"></a>
</p>

<p align="center">
  <a href="https://fabbit.dev/en/">Website</a> ·
  <a href="https://github.com/fabbit-dev/fabbit">Instrument</a> ·
  <a href="CONTRIBUTING.en.md">Contributing</a>
</p>

## Run locally

Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open [localhost:5190](http://localhost:5190). Russian at `/`, English at `/en/`.

| Command | Purpose |
|---|---|
| `npm test` | Run Vitest tests |
| `npm run build` | Build to `dist/` |
| `npm run preview` | Preview the build at [localhost:4173](http://localhost:4173) |

## Inside

Vite 7, JavaScript, three.js, GSAP and Tailwind 4. React renders the static Internals section at build time; we ship no React to the browser.

```text
index.html, en/   RU / EN pages
src/             interface, 3D scene and tests
src/build/       static Internals section
public/          model and graphics
worker/          donations API, separate package
```

Submit changes through PRs. A push to `main` publishes the site to GitHub Pages.
