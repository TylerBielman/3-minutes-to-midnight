# AGENTS.md — 3 Minutes to Midnight

## Current authority
Read `docs/DESIGN_AND_TECHNICAL_SPEC.md`, `docs/TECHNICAL_DESIGN.md`, and `docs/DECISIONS.md` before gameplay changes. Prototype 1 Jerboa Runway supersedes Build 0.1's docking experiment; archive files are historical only.

Tyler authorized the agent to make routine calls, document them in the decision ledger, and prioritize a playable prototype. Ask only for choices that materially change the game. Do not ask repeatedly about tuning values that can be exposed as settings.

## Active scope
Portrait phone, hidden grid, fixed connected polyomino runway, draft-only rotation and rerolls, autonomous exploration/patrol, visible future route, tap-to-reverse, random point nodes (phase-weighted 1–5), x2 and freeze powerup nodes, three-phase pulsing Ring, score on capture. Native Pointer Events share mouse and touch behavior.

## Guardrails
- No overlap; every new piece connects. Every shared edge is traversable.
- Roads can cross the Ring, which never erodes them. Placement-triggered retirement removes old whole pieces above a configurable soft limit, protecting the creature and connected road. Only creature contact ends the run.
- Navigation ignores the Ring and point values. Color shows route, not speed.
- Preview and actual travel must share deterministic routing.
- Keep cancelled drags in their original slots and revalidate release.
- Keep smart spawns, hammer, stages, progression, accounts and backend deferred. Approved powerups: x2 (Playtest 3) and freeze (Playtest 4); add others only on request.
- Record agent-made decisions separately from user-approved decisions.
- Test meaningful routing, geometry, timing and input changes. Preserve the prebuilt phone-test package flow.
