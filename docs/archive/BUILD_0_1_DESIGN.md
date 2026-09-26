# 3 Minutes to Midnight — Design + Technical Spec

## Product promise
A mobile-first single-player score-chasing game. From Start to Midnight the run lasts exactly **X real-time minutes**; Prototype target is **180 seconds**. No planning pause, no early failure, no mechanic that extends the run.

## Design north star
**What do you give up, and when?**
The player builds value that is inevitably consumed by a closing boundary. Scoring should tempt greed; geometry and the Ring should punish overextension. Survival is not the goal. The goal is to extract as much score as possible before Midnight.

## Development sequence
1. **Find the core loop.** Prove draft → rotate → dock → build scoring limbs → Ring destroys → adapt → Midnight.
2. **Find the fun.** Explore powerups, Seeds, docks, Rings, shapes, closures, destruction triggers, draft manipulation, smart generation, etc.
3. **Productize the fun.** Only then decide progression, loadouts, unlocks, leaderboards, achievements, monetization, competitive structures.

---

# Core game rules (target design after Build 0.1)

## Screen / UI
- Portrait only for initial design.
- Exact square playfield in the middle of the portrait screen.
- Circular Ring centered in that square for Prototype 1.
- Seed centered in both square and Ring.
- Top HUD: Total Score, hero metric **X/sec**, countdown.
- Bottom: Bomb control + 3-slot Chooseable draft.
- Draft objects are literal pieces at **1:1 gameplay scale**, not cards.
- Dragged piece floats above fingertip.
- One-handed play is mandatory even if that eventually means simplifying rotation.

## Seed
- Compact, neutral-colored, asymmetric anchor.
- Roughly 6 docks.
- Early Seeds always include all 4 base colors, with duplicates and positions varying.
- Seed is not scoring and cannot be Bombed.
- Seed footprint must stay modest because every pixel removes future playable space.
- Seed geometry should create interesting starting topology, not a symmetric spoke wheel.

## Chooseable anatomy
A basic Chooseable has:
- Shape
- Color
- Base Points, integer 1–5, printed inside
- Docking points
- Optional Powerup in later builds

Dock-count distribution:
- 2 docks = common
- 3 docks = less common, branching opportunity
- 1 dock = rarer cap/dead-end, often compensated by value
- 4+ = special/advanced

Docks are mostly the piece's own color. Rare pieces may include an additional off-color dock, but never only off-color docks.

## Dock grammar
- Dock = small, standardized, uni-sized colored bump on a piece edge.
- A colored Dock accepts only the same color.
- Compatible bump + compatible bump → snap; both bumps visually merge/disappear into a flush connection seam.
- Only unused/open bumps remain visible.
- When holding a piece, **all accessible same-color open docks across the Structure glow**, even if this exact shape physically cannot fit there.
- Occluded docks do not glow.
- Geometry assistance escalates only near a truly legal fit: magnetism / stronger glow / ghost / snap.
- UI should not solve the spatial puzzle for the player.

## Geometry
- Deterministic polygons, no rigid-body physics.
- No body overlap.
- A placed piece may occlude another unused Dock; that Dock is unavailable until exposed again.
- A new piece cannot overlap/cross the current Ring.
- Shapes should be readable but irregular: angled edges, asymmetric silhouettes, non-cardinal docks, concavities, pockets.
- Avoid a hidden orthogonal grid initially.
- Limbs should turn/curl rather than naturally extend as clean spokes.
- High-value pieces may be geometrically awkward.
- Desired AHA: a weird piece unexpectedly fits a difficult gap or closes multiple docks.

## Placement
- Drag from draft, rotate/pivot, preview, release to commit.
- Placement is permanent through normal play.
- Multi-dock placement connects automatically to every aligned compatible Dock.
- Free rotation is desirable only if one-handed UX supports it.
- Rotation hypothesis: when a piece magnetizes to a compatible Dock, orbit thumb around that Dock to pivot piece through orientations; legal orientations get strong snap/ghost feedback.

## Draft
- Base draft row = 3 Chooseables.
- Taking one instantly repopulates its slot in the full prototype.
- Initial RNG genuinely random.
- No draft timers initially.
- Player may swipe an unwanted Chooseable away for a free reroll; cost is only real elapsed time while the Ring advances.
- UI architecture should support >3 slots later.
- Bad draft solved by swipe-away; bad Structure solved by Bomb. No hidden mercy system in early prototype.

## Scoring
Total Score only increases. Production Rate **X/sec** recalculates live and can rise/fall.

### Open path scoring
Only the exposed same-color sequence at the end of a limb scores.
Production = `(sum of Base Points in exposed contiguous color sequence) × number of pieces in that sequence`.

Examples:
- Red 2 = 2/sec
- Red 2 → Red 4 = 12/sec
- Red 2 → Red 4 → Red 1 = 21/sec

### Color blocking
Seed → Red 2 → Red 4 → Blue 3 → Blue 5:
- Outer Blue sequence scores.
- Buried Red sequence is dormant.
- If Blue is later destroyed, Red becomes exposed and scores again immediately.

### Closure / network scoring
When previously separate same-color limbs connect into one connected network, that network becomes a Group:
`(sum of all Base Points in the connected same-color Group) × number of pieces in Group`.
This makes Carcassonne-like closure inherently valuable without an arbitrary bonus.

Score begins immediately on attachment. No maturation timer in MVP.

## Ring
- Prototype 1 Ring = circle contracting from outside toward center.
- Three discrete speed phases: minute 1 slow, minute 2 medium, minute 3 fast.
- Ring appearance changes clearly each phase.
- Contact with any part of a Chooseable destroys the **entire piece instantly**.
- Destruction can cascade: newly exposed pieces already intersecting Ring are destroyed immediately too.
- Production recalculates through the cascade: e.g. 96/sec → 71/sec → 43/sec → 18/sec.
- Ring itself is warning; no health/erosion/grace timer.
- No way to lose before Midnight.

## Disconnection
Prototype rule: if removal causes pieces to disconnect from the Seed, all disconnected pieces are destroyed.
Deferred experiments: salvage/re-dock; floating obstacles; drag disconnected pieces to Ring to discard.

## Bomb
- Start with 1 Bomb.
- Persistent UI control.
- Tap Bomb, then any attached Chooseable except Seed.
- Target piece is destroyed; disconnection cascade applies.
- Bomb grants no score; purely strategic surgery/correction.

## Initial Powerups for the full prototype
Powerups ride on otherwise normal Chooseables and trigger on attachment.
1. **+1 Bomb** — immediately adds one Bomb.
2. **Score Boost** — temporarily doubles total X/sec (initial test: ~5 sec).

Deferred: Freeze Ring, temporary Wild Docks, color changers, destruction triggers, phase-change triggers, Midnight triggers, etc.

## Midnight presentation
At 0:00 run ends immediately. No final scoring mechanic. Presentation may briefly show an echo/ghost of the player's maximum Structure, then Seed blows up → results.

---

# Build 0.1 — Interaction Sandbox

## Single question
Does one-handed **grab → scan glowing docks → approach → orbit/pivot → understand legality → release/snap** feel good on an actual phone?

## Include only
- Portrait Phaser/TypeScript/Vite app
- Square playfield
- Static circular Ring
- One compact asymmetric Seed with 6 colored docks
- 3 authored irregular Chooseables
- Literal 1:1 draft pieces
- Touch offset
- Global compatible-Dock glow
- Dock magnetism
- One-handed orbit/pivot experiment
- Polygon collision
- Ring-boundary placement legality
- Permanent snap placement
- Debug tools

## Explicitly exclude from Build 0.1
Scoring, Ring shrinking, timer, Bomb, swipe cycling, draft repopulation, cascades, powerups, progression, backend, monetization.

## Build 0.1 acceptance test
On a real portrait phone:
1. Tester grabs a piece one-handed.
2. Matching open docks across Structure glow.
3. They can approach a Dock and pivot/orient piece without second hand.
4. Color compatibility is understandable separately from physical fit.
5. Illegal collision / Ring placements do not commit.
6. Legal placement snaps and becomes permanent.
7. The gesture feels promising enough to justify building the rest of the game.

## Engineering recommendation
- Phaser + TypeScript + Vite.
- Canvas/WebGL game surface, not DOM layout for Structure.
- Deterministic polygon collision, no physics engine.
- Data-driven Seed/piece polygons and docks.
- Same Pointer Event path for mouse and touch.
- Tuneable constants: finger offset, magnet radius, pivot sensitivity, snap threshold.
- Debug overlays: polygons, dock coords/colors, pointer, candidate connection, legality reason, Ring boundary.
- Keep code disposable. Optimize for learning speed.
- Deploy to HTTPS preview/GitHub Pages for phone testing.

## Prototype build ladder after 0.1 succeeds
- 0.2: scoring + X/sec
- 0.3: shrinking 3-phase Ring + destruction/cascades
- 0.4: draft replacement + swipe cycling + Bomb
- 0.5: 3 Seeds + broader shape library + closure scoring
- 0.6: +1 Bomb and Score Boost powerups; cognitive-load test

---

# Deliberately deferred design space
Preserve these ideas for Step 2; do not accidentally delete them from design history:
- Irregular/non-circular Rings
- Player rotates entire Structure relative to irregular Ring
- Ring changes shape during run
- Constant-speed and smooth-acceleration Ring alternatives
- Wild docks and dual-color docks
- Individual Chooseable timers / shared draft timer
- >3 draft slots
- Hold/reserve slot
- Smart/context-aware drafting
- Context-aware procedural shape generation designed to create occasional surprising multi-dock fits
- Alternative disconnected-piece behaviors
- Time-together / aging / compounding scoring
- Explicit closure rewards only if natural network scoring is insufficient
- On-destruction / on-phase / on-Midnight powerups
- Smart Seeds and Seeds that break normal dock-count/color rules
- Shareable maximum-Structure echo

## Smart-system philosophy
Do not use smart generation to hide a bad core loop. First understand raw randomness. Later, smart drafting/shape generation should optimize **interesting decisions**, not merely generosity. A great smart offer can be tempting and awkward rather than simply helpful.
