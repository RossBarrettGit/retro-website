# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server with HMR (http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — serve the built `dist/`
- `npm run lint` — Oxlint (config in `.oxlintrc.json`; there is no ESLint)

There is no test runner configured.

## Stack

React 19 + Vite 8, plain JavaScript (JSX, no TypeScript), Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`; all config is CSS-first in `src/index.css`). Fonts (VT323, Press Start 2P) load from Google Fonts in `index.html`.

## Styling conventions

- Styling is Tailwind utilities in JSX. `src/index.css` holds the `@theme` (fonts like `font-pixel`/`font-term`, colours like `neon-pink`/`ink`, and `animate-*` with their keyframes) plus `@utility` classes for the effects too elaborate to express inline (sun stripes, perspective floor grid, CRT bezel/screen/scanlines/glass, meter fill).
- Animations whose timing comes from per-element inline CSS vars (`--d`, `--delay`: `animate-drift`, `animate-meter`) must be `@utility` classes, **not** `@theme` `--animate-*` entries. Theme variables resolve on `:root`, where those vars are undefined, which silently breaks the animation.
- The phosphor colour is referenced in classes as `text-(--phos)`, `border-(--phos)`, `bg-(--phos)/3`, etc.

## Architecture

A single-page "RETRO-OS" site: a beige CRT monitor in front of an animated synthwave scene. Nearly all logic and markup is in `src/App.jsx`.

- **Component tree:** `App` renders the backdrop (`Starfield` canvas, CSS sun, perspective grid floor), the decorative `Floater` SVGs, and `Monitor`.
- **`Monitor` owns the state.** `phase` is `'boot' | 'desktop' | 'off'`, plus the phosphor colour. `bootKey` remounts the screen content so reboot/power-on replays the boot sequence and the `crt-on` animation. `Desktop` is always rendered (made `invisible` during boot) and `Boot` is absolutely positioned over it, so the screen's height is always the desktop's height and the monitor never resizes between phases. `Boot` calls `onDone` (which must stay stable via `useCallback`, because it's an effect dependency) to move to `Desktop`.
- **Phosphor theming:** the selected colour from `PHOSPHORS` is set inline as the CSS custom property `--phos` on the monitor root. Its `phosphor` utility derives `--phos-dim` / `--phos-faint` from it with `color-mix()`. Canvas components get the hex value as a `color` prop because canvases can't read CSS variables directly.
- **`useCanvas(setup, deps)`:** shared hook for all animated canvases. `setup()` runs once per deps change and returns `draw(ctx, w, h, t, dt)`, which is called every animation frame. It handles DPR scaling and resizing. It sizes from `clientWidth`/`clientHeight`, **not** `getBoundingClientRect()`, because the CRT power-on animation scales the screen with CSS transforms, and transformed sizes would produce a squashed canvas.
- **Terminal:** commands are handled in the `switch` in `Terminal.run`. Add new commands there and list them in the `help` output.
- **CRT effects** (`scanlines`, `rollbar`, `glass` utilities) are pointer-events-none overlays stacked on top of the screen content. Reduced motion is handled per element with `motion-reduce:` variants.
