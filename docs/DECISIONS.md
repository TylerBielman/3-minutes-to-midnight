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
