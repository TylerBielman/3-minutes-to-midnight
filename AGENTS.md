# AGENTS.md — 3 Minutes to Midnight

## Design authority
This repository is an interaction-first prototype. Read `CODEX_BUILD_0_1.md` and `docs/DESIGN_AND_TECHNICAL_SPEC.md` before making gameplay changes.

## Current milestone
**Build 0.1 — Interaction Sandbox**

Single question: does one-handed `grab → scan glowing docks → orbit/pivot → snap` feel good on a portrait phone?

## Do not broaden scope
Do NOT add scoring, shrinking Ring, the 180-second timer, Bombs, draft cycling/repopulation, cascades, powerups, progression, backend, accounts, monetization, or polish systems until explicitly requested.

## Non-negotiable interaction rules
- Portrait, one-handed mobile play.
- Square playfield.
- Circular static Ring for Build 0.1.
- Compact neutral asymmetric Seed at center.
- Docks are standardized colored bumps.
- A colored dock accepts only that color.
- All accessible matching-color docks glow when a piece is held, even if the held geometry cannot fit there.
- Geometry legality remains the player's puzzle.
- No body overlap.
- No placement crossing the Ring.
- Connected bumps disappear/merge at the seam.
- Placement is permanent after release.
- Deterministic polygon collision; no rigid-body physics.
- Touch offset keeps the held piece above the player's finger.

## Engineering philosophy
- Prototype for learning, not permanence.
- Prefer readable, data-driven code over abstraction.
- Put tuning constants near the top or in dedicated config.
- Add debug visualization for docks, polygons, candidate connection, collision reason, magnet radius, and pointer position.
- Preserve mouse support for desktop testing while sharing the same Pointer Events logic used on touch.
- Do not silently change game rules to make implementation easier. Surface the problem instead.
