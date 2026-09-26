# Prototype 1 — Decision ledger

2026-09-25. User decisions take precedence over archived documents. Agent calls below are provisional and explicitly open for Tyler's review; they were made to reach a playable prototype without another questionnaire.

## Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U01 | Replace polygon docking with a jerboa moving on a hidden square-grid runway. Portrait phone; circular closing Ring. |
| U02 | Jerboa never falls. He turns at road ends and keeps patrolling after exploration. |
| U03 | Prefer the exit with the greatest total reachable unvisited runway, including beyond subsequent junctions. |
| U04 | Equal weights are random; color foreshadows the route. Shared loop territory can produce ties. |
| U05 | Future intentions update when building changes the choices; in-flight hops finish. |
| U06 | Every shared square edge connects. Corners do not; junctions, side joins and loops are allowed. |
| U07 | No overlap. New pieces must connect to existing runway. Placement is permanent. |
| U08 | Tap draft piece to rotate; drag locks orientation. Unplaced pieces return to the original slot for another attempt. Refill on placement; retain swipe discard/reroll. |
| U09 | Tap the creature to reverse once; normal exploration resumes at the next junction. No hammer initially. |
| U10 | Ring leaves runway intact. Contact with the creature alone ends the run. |
| U11 | Jerboa has zero awareness of the Ring; construction may cross it. |
| U12 | Character is a jerboa; a simple hopping placeholder is sufficient for P1. |
| U13 | Point nodes are consumed once. Replenish a small pool when collected or overtaken. |
| U14 | P1 spawns are random, including on existing runway. Later test uncovered-only, then state-aware spawning. |
| U15 | Preserve slow/medium/fast Ring phases. Default maximum around three minutes; also test shorter durations. |
| U16 | Ring closes completely; every run ends when caught. No clear-board/stage transition in P1. |
| U17 | Mixed visible point values, initially random 1/3/5. |
| U18 | Common pieces are I/L/J/T/S/Z, excluding 2×2 O. Include smaller and larger exotics in P1. |
| U19 | Include the rare single-square piece. Group probabilities 70% common, 15% small, 15% large, uniform within each. |
| U20 | First valid placement starts movement and Ring clock. |
| U21 | Agent may choose routine implementation/tuning details, document them, and ask only for major directional decisions. |

## Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| A01 | 19×19 cells, six nodes, 450 ms/hop, three draft slots | Enough room for large pieces with readable phone targets. Tune panel exposes board, nodes, hop rate and duration. `DEFAULTS` in `src/game.ts`. |
| A02 | Small: Dot/1, Domino/2, Elbow/3. Large: Long/6, Cup/5, Cross/5 | Initial authored palette from the design discussion; six common plus six exotic shapes. `SHAPES` in `src/runway.ts`. |
| A03 | Ring phase speed multipliers .5 / 1 / 1.5, equal phase lengths | Previous brief specified three speeds but no numerical rates. These integrate to complete closure at the time limit. `TUNING.phaseSpeeds`; changing them requires maintaining the total integral. |
| A04 | Block deciding square during reachability; exclude incoming exit unless dead end or explicit reverse | Makes a branch comparison finite and prevents immediate back-and-forth while other exits exist. `freshReach` / `chooseNext`. |
| A05 | Permanent visit memory; color is a separate itinerary. Node spawns do not reset exploration | Avoids recoloring making old road falsely new. Points and Ring do not influence the autonomous policy. |
| A06 | Fully explored alternatives tie randomly; no immediate U-turn except at dead ends | Implements continued patrol without adding a separate behavior mode. Some routes may be revisited unevenly; test this. |
| A07 | Preview through next turnaround/repeated cell, maximum 64 steps | Avoids falsely implying an infinite colored loop. Same planner and copied RNG make preview reliable. |
| A08 | One queued reverse per hop; repeated taps before landing do not stack | Avoids accidental double reversals. Preview changes immediately, physical hop remains locked. |
| A09 | Ground hit radius .24 cells; pickups .32 cells | Stable visible contact rule independent of animation. Simulation steps at most 16 ms, including delayed frames. `TUNING`. |
| A10 | Exclude current and committed landing cells, existing nodes and nodes crossing Ring from new spawns | Prevent duplicate or instant repeated pickups. Otherwise uniformly random, including disconnected ground and explored road. Stop forcing pool size when safe space runs out. |
| A11 | 90° clockwise draft taps. Swipe requires horizontal travel while remaining in the row | Separates rotate/discard/place with one pointer. Upward departure locks drag mode. Cancel, lost capture and blur return the piece. `src/main.ts`. |
| A12 | Large/vertical draft silhouettes scale to fit their slots; held pieces show exact board size with 44-pixel upward offset | Keeps six-cell exotics selectable on portrait screens. Slots are generous touch targets; avatar tap target is 50 logical pixels. |
| A13 | Real-time run continues with Tune open or the browser hidden | No pause exploit; advance catches up when rendering resumes. Tune explicitly warns of this. First placement starts time; before it, draft manipulation is free. |
| A14 | New run draws a new random seed; Apply & restart reuses the specified seed | Independent random streams for draft, nodes and navigation. Reproducible playtests without input/render-order rerolls. |
| A15 | Canvas 2D + TypeScript/Vite, replacing Phaser renderer | The grid model requires no physics/scene engine; simpler dependency surface and small offline bundle. Pure engine can be tested without a browser. |
| A16 | Score only on landing; collision checked before collection | No collecting a node on the fatal step. No bonus for survival or road length. |
| A17 | Runway placement bounded by the square board, not the Ring | A partially outside piece is permitted; off-board cells remain invalid. |

## Intentionally unresolved through playtesting

- Are the twelve shapes varied enough, and does the Dot cause excessive swipe hunting?
- Does global reachable-area weighting feel understandable on dense loops, with preview as the primary explanation?
- Is random explored-road node spawning enjoyable or does it encourage passive farming?
- Is 450 ms/hop readable and exciting on a real phone? Does the Ring catch players before they understand the plan?
- How much difficulty should come from shape fitting versus excursions and timing?

No smart spawn correction, guaranteed helpful draft, hammer, powerups, stage progression or speed-changing road colors have been slipped into P1.

## Playtest 2 — 2026-09-25 (supersedes relevant initial calls)

Tyler requested more forgiving near misses, removal around 25 squares, better zigzags, downward discard, run statistics, and a straight three-square piece. These changes supersede permanence in U07, the S/Z palette in U18, footprint A09 and gesture A11. The Ring still does not erase road (U10).

| ID | Agent call for this iteration | Review point |
| --- | --- | --- |
| P2-01 | Hit radius .10 cells instead of .24; selectable in Tune. Hop centers still follow orthogonal edges. | Does this create enough corner latitude? No hidden collision grace or curve added. |
| P2-02 | 25-square soft cap including seed; placement retires oldest eligible whole pieces, protecting actor/in-flight endpoints/newest piece and all remaining connectivity. Seed may retire. | Safety can leave more than 25 squares; UI shows PROTECTED. Compare to unlimited with limit 0. |
| P2-03 | Retired cells become empty immediately, flash amber for .9s, lose visit memory; point nodes stay put. | Rebuilt ground is unexplored. Removal only on new placement. |
| P2-04 | Replace both S and Z with W5 and Step5. Step means three vertical squares, one across, one farther up (five total). Add requested Line3 to small pool. | 13 shapes: 6 common, 4 small, 3 large. Group probabilities remain 70/15/15; each small now 3.75%. |
| P2-05 | Downward swipe threshold 30 logical pixels; stronger vertical than horizontal intent. Upward drag locks out discard. Pull back before release to cancel. | Easier thumb movement without accidentally discarding a returned drag. |
| P2-06 | Local summaries plus action/hop events; up to 50 runs, 5-second checkpoints, JSON export. No cloud/account. | Phone reports must be exported and shared; I cannot automatically see remote play. |
| P2-07 | Count escaped near misses only after entering .5-cell danger margin and returning beyond .75. Track capture separately. | Avoid calling every fatal approach a successful near miss. |

## Playtest 3 — 2026-09-26

Tyler requested stronger Ring tension, pickup feedback, phase-weighted point values, a pre-start discard lock and the first powerup. Supersedes U17 (uniform 1/3/5) and the "no powerups" note; U08's reroll now unlocks with the clock.

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U22 | The Ring pulses; pulses speed up each time the phase changes. |
| U23 | A small happy burst plays when a point node is collected. |
| U24 | Point values are 1–5. Phase 1 makes 5s rare; each later phase has fewer 1s and more 5s. The starting board always has two 5s. |
| U25 | Swipe-down discard is disabled until the first placement starts the timer. |
| U26 | x2 powerup node in its own color: speeds the jerboa up (tunable, default 1.4×) and doubles points for a tunable duration (default 5 s). Point nodes show the x2 color while boosted. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P3-01 | Value weights for 1/2/3/4/5: phase 1 30/28/22/14/6, phase 2 15/20/25/22/18, phase 3 6/12/22/28/32 | Phase 1 has 6% 5s; phase 3 has 32%. New spawns use the current phase; existing nodes keep their value. `TUNING.phaseValueWeights`. |
| P3-02 | The two starting 5s are the first two nodes spawned, placed randomly like any other node | Keeps U14 random spawning. Other opening nodes can also roll 5 (rare). `TUNING.startingFives`. |
| P3-03 | Ring heartbeat period 1.4 s / 0.9 s / 0.55 s, stronger glow each phase; a one-off orange shockwave plus a "PHASE n · THE RING QUICKENS" banner on each phase change. Ring stays still before the run starts | `TUNING.ringPulseMs`, `FX` in `src/main.ts`. Presentation only; Ring speed is unchanged. |
| P3-04 | Burst = 14 particles plus a floating "+N" label, gold or violet when boosted; the x2 pickup gets a larger violet burst | `FX` in `src/main.ts`. |
| P3-05 | x2 color violet `#c77dff`. At most one x2 on the board; the first appears 10 s into the run and the next 15 s after the previous one is collected or lost to the Ring. It never spawns during an active boost and is extra to the point-node count | `TUNING.boostFirstMs`, `boostRespawnMs`. Spawns on the same random eligible cells as nodes. |
| P3-06 | Speed-up applies from the next hop after landing on x2; a hop already in flight when the boost ends finishes at boosted speed. Boost time is game time. While boosted, nodes show their doubled value in violet (Tyler, Playtest 3 follow-up) | Avoids mid-hop position jumps. Tune exposes speed multiplier and duration; URL `boost` and `boostSec`. |
| P3-07 | A locked swipe-down flashes the slot red and shows "Discards unlock after your first placement". Rotation stays free before the start | `Game.discard` returns false before the run starts. |
