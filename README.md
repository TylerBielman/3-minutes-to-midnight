# 3 Minutes to Midnight — Build 0.1 Interaction Sandbox

This repo intentionally starts smaller than the game.

## Question this build answers
**Does one-handed grab → scan glowing docks → pivot around a dock → snap feel good on a phone?**

## Included
- Portrait layout
- Square playfield and static circular Ring
- Compact asymmetric neutral Seed with six colored docks
- Three authored irregular Chooseables
- Literal 1:1 draft pieces
- One-handed drag with upward finger offset
- Global glow on every accessible matching-color dock
- Dock-orbit pivot experiment
- Polygon collision and Ring-boundary legality
- Permanent placement on release

## Explicitly NOT in Build 0.1
- Scoring / X-sec
- Shrinking Ring
- Three-minute timer
- Bombs
- Draft cycling/repopulation
- Cascades
- Powerups
- Progression/metagame

If the interaction is not fun, do not add those systems.

## Run locally
```bash
npm install
npm run dev
```
Open the LAN URL Vite prints on a phone connected to the same network, or deploy to any HTTPS static host.

## Design references
See `docs/reference/`.
- `Master_Design_v0.4.docx` — rules/design source of truth
- `UI_Wireframe_0.5_Validated.png` — topology/UI grammar
- `Geometry_Exploration_0.1.png` — shape-language target

## Agent guardrail
Do not "improve" the scope of Build 0.1 without an explicit design request. Optimize for touch feel and instrumentation, not feature count.

## Easiest phone deployment
A GitHub Pages workflow is included at `.github/workflows/deploy-pages.yml`.
After the repo is pushed to GitHub, enable **Settings → Pages → Source: GitHub Actions** once. Every push to `main` will then publish a phone-testable HTTPS build.
