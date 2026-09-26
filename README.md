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

## Phone test — play in the browser (easiest)
Every push to GitHub builds the game and publishes it with GitHub Pages:
- `main`: https://tylerbielman.github.io/3-minutes-to-midnight/
- any other branch: `https://tylerbielman.github.io/3-minutes-to-midnight/branch/<branch-name>/` (slashes in the name become dashes)

A deploy takes about 1–2 minutes after the push. The exact URL is printed in the run summary on the repo's **Actions** tab. Bookmark it on the phone and refresh after each push.

One-time setup (already done if the links work): repo **Settings → Pages → Source: Deploy from a branch → `gh-pages` / `(root)`**.

## Phone test on Windows — local PC server
Double-click `START_PHONE_TEST.bat`.

The launcher will:
- install Node.js LTS with Windows Package Manager if Node is missing,
- install the prototype dependencies on first run,
- start the local Vite server,
- open the prototype on the PC,
- print the exact `http://...:5173` address to open on a phone connected to the same Wi-Fi.

If Windows Firewall asks, allow access on **Private networks**.

## Manual local run
```bash
npm install
npm run dev
```

## Design references
See `docs/reference/`.
- `Master_Design_v0.4.docx` — rules/design source of truth
- `UI_Wireframe_0.5_Validated.png` — topology/UI grammar
- `Geometry_Exploration_0.1.png` — shape-language target

Also read:
- `AGENTS.md`
- `CODEX_BUILD_0_1.md`
- `docs/DESIGN_AND_TECHNICAL_SPEC.md`

## Agent guardrail
Do not "improve" the scope of Build 0.1 without an explicit design request. Optimize for touch feel and instrumentation, not feature count.
