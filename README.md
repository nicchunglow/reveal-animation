# Matchup Reveal

A single-file, zero-build battle-matchup reveal animation for dance competitions —
two dancers slam in one at a time, converge, clash on a diagonal seam, and settle
into a split-screen VS card.

Built with React 18 + three.js + @react-three/fiber + postprocessing, all loaded
straight from a CDN via an import map. JSX is compiled in the browser by
babel-standalone. There is no `package.json` and no build step.

## Run it

```bash
python3 -m http.server 5180
```

Then open http://localhost:5180 — it needs an internet connection for the CDN
modules and Google Fonts.

Opening `index.html` via `file://` will not work: import maps and ES modules
require an `http://` origin.

## Using it

- **Setup** (top right) — round label, both names/crews, and a photo per side.
  Photos are read locally in the browser, cover-cropped, red-graded, and turned
  into a canvas texture; nothing is uploaded.
- **Look** — bloom intensity, chromatic aberration, film grain.
- **Play reveal** — restarts the timeline.
- **Fullscreen (projector)** — for showing it on the big screen.

## How it works

`Director` owns a single clock and drives every object from `useFrame`. The
timeline lives in the `T` constant at the top of the script:

| Act | Window | What happens |
| --- | --- | --- |
| 1 | 0.10s – 1.60s | Side A slams in centred, own animated GLSL backdrop |
| 2 | 1.70s – 3.20s | Side B does the same, mirrored |
| 3 | 3.28s onward | Both converge, clash at 3.80s (shake + sparks + seam ignite), VS snaps in, cards settle and idle-float |

Layout is derived from the R3F viewport each resize, so spacing and card scale
adapt to the screen instead of being hard-coded.
