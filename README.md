# Filament

A generative art toy. Every piece is drawn fresh in the browser — no images, no libraries, no build step.

**Live:** https://filament-art-toy.onrender.com
**Repository:** https://github.com/pawankumar0001414-glitch/images-art

Open `web/index.html` directly, or serve the folder:


```sh
npx serve web
```

## Using it

- **New piece** (or `Space`) — generate another artwork
- **Save PNG** (or `S`) — export the current piece at 2048 × 2048
- **Copy link** (or `C`) — copy a URL that reproduces the exact same piece

Every piece is seeded. The seed lives in the link as `?s=<seed>`, so the same URL always renders the same artwork.

## How it works

`web/art.js` seeds a small deterministic PRNG (mulberry32) and picks one of four drawing engines plus one of ten palettes:

- **Silk** — thousands of particles integrated through an fBm noise field
- **Orbit** — damped harmonograph curves, normalised to fit the frame
- **Strata** — noise-warped contour rings with colour banding
- **Moiré** — overlapping ellipse sets whose spacing creates interference

Rendering is progressive and frame-budgeted; the grain and signature are applied at the end. Prefers-reduced-motion skips the animation and draws in one pass.

## Deploying

`render.yaml` configures a Render static site that publishes `web/`. Connect this repository to Render and it deploys as-is; the site is served at the root of the Render URL.

## Files

```
web/index.html   page shell and controls
web/styles.css   layout and theme
web/art.js       seed, palettes, drawing engines, export
render.yaml      Render Blueprint (static site)
```
