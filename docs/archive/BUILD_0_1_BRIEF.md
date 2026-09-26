# Codex Brief — Build 0.1 Interaction Sandbox

You are implementing a narrow interaction prototype for **3 Minutes to Midnight**.

## Design authority
Read these before changing behavior:
1. `docs/reference/Master_Design_v0.4.docx`
2. `docs/reference/UI_Wireframe_0.5_Validated.png`
3. `docs/reference/Geometry_Exploration_0.1.png`

The validated UI image is mechanically authoritative. The geometry exploration is authoritative about desired irregularity. Do not turn the board into clean radial spokes.

## Single success question
Can a player comfortably use ONE HAND in portrait orientation to:
1. grab a literal Chooseable,
2. see every color-compatible open dock glow,
3. approach one dock,
4. pivot the shape around that dock by orbiting the thumb,
5. understand whether the geometry is legal,
6. release to commit with a satisfying snap?

## Rules for this build
- Seed is neutral, compact, asymmetric, fixed at playfield center.
- Docks are same-size colored bumps.
- Color-compatible bumps glow even if this particular shape cannot physically fit there.
- Geometry legality is separate from color compatibility.
- No body overlap.
- No Ring overlap.
- Placement is permanent after release.
- Connected bumps visually disappear/merge at the seam.
- Deterministic polygon geometry. NO rigid-body physics.
- One-handed interaction is mandatory.

## Do not build yet
Scoring, Ring shrinking, timer, Bomb, cycling, draft replacement, powerups, cascades, meta progression, account systems, backend, monetization.

## Engineering priorities
1. Reliable mobile Pointer Events/touch behavior.
2. Tuneable constants for finger offset, magnet radius, pivot sensitivity, and snap threshold.
3. Debug visualization toggles for polygon outlines, dock coordinates, target candidate, and legality reason.
4. Data-driven piece polygons and docks.
5. Keep the code easy to throw away or rewrite.

## Acceptance test
On a real phone, a new tester can place a piece without explanation after a few attempts, can distinguish "matching color" from "actually fits," and does not need a second hand.
