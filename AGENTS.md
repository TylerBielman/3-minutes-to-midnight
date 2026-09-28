# AGENTS.md — 3 Minutes to Midnight

## Current authority
Read `docs/DESIGN_AND_TECHNICAL_SPEC.md`, `docs/TECHNICAL_DESIGN.md`, and `docs/DECISIONS.md` before gameplay changes. Prototype 1 Jerboa Runway supersedes Build 0.1's docking experiment; archive files are historical only.

Tyler authorized the agent to make routine calls, document them in the decision ledger, and prioritize a playable prototype. Ask only for choices that materially change the game. Do not ask repeatedly about tuning values that can be exposed as settings.

## Active scope
Portrait phone, hidden grid, fixed connected polyomino runway, draft-only rotation and rerolls, autonomous exploration/patrol, visible future route, tap-to-reverse with reverse tips, random point nodes (phase-weighted 1–5 plus a rare moving 10), x2 and freeze powerup nodes (freeze stops time), three-phase pulsing Ring, score on capture, end-of-run celebration and leaderboard, links back to gametronyx.com. Native Pointer Events share mouse and touch behavior.

Approved next (Playtest 7 plan, DECISIONS U43–U45): a Rounds mode as an unranked trial with a design page, then new powerups unlocked by round. Clearing a round is a full reset, like a new level (U48). Classic stays the ranked mode.

## Guardrails
- No overlap; every new piece connects. Every shared edge is traversable.
- Roads can cross the Ring, which never erodes them. Placement-triggered retirement removes old whole pieces above a configurable soft limit, protecting the creature and connected road. Only creature contact ends the run.
- Navigation ignores the Ring and point values. Color shows route, not speed.
- Preview and actual travel must share deterministic routing.
- Keep cancelled drags in their original slots and revalidate release.
- Keep smart spawns, hammer, accounts and backend deferred. Stages/progression exist only as the approved Rounds trial (U43). Approved powerups: x2 (Playtest 3), freeze (Playtest 4), and in Rounds: Expand, Sweep, Magnet, Speed and Cherries (U45); add others only on request.
- Exception, approved by Tyler through the Gametronyx brief: `src/gtx.ts` redeems the gametronyx.com launch code and shows the feedback popup every N completed runs (N is set in Gametronyx admin, default 3). Tyler also approved a leaderboard by Gametronyx username (DECISIONS L1–L3): ranked runs are posted to the Gametronyx leaderboard server (gametronyx repo, `server/`), and the end-of-run screen (`src/finale.ts`) celebrates the player and shows the board. The leaderboard's back end belongs in the gametronyx repo; only Jerboa's front end lives here. None of this changes gameplay, and the game still plays fully without a session.
- Changing `DEFAULTS` in `src/game.ts` changes what the Gametronyx leaderboard ranks: until a new season is started with the new settings, every run is refused as not ranked. Keep new tunables out of `Settings` (use `TUNING` or round configs). Any change to ranked (Classic) gameplay, even through `TUNING`, needs a new season so old and new runs aren't mixed, and a scoring change may need the server's plausibility checks (gametronyx `server/src/rules.ts`) updated.
- Seasons are code: start one by editing gametronyx `server/seasons.json` (new season name, and the new ranked settings if `DEFAULTS` changed), in a gametronyx PR that ships with this game's change. Merging it deploys the leaderboard server and applies the season; nobody SSHes to the box (gametronyx DECISIONS U26, A56, A57). Server-side checks ship the same way.
- Deploys are hands-off: merging to main publishes the game (GitHub Pages). Tyler authorized Claude to merge its own PRs once CI is green (2026-09-28) and say what shipped, unless he asks to review first. When a change needs a leaderboard change too, merge the gametronyx PR first and confirm its deploy run passed.
- Record agent-made decisions separately from user-approved decisions.
- Test meaningful routing, geometry, timing and input changes. Preserve the prebuilt phone-test package flow.
