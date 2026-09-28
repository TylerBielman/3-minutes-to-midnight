# 3 Minutes to Midnight — Prototype 1: Jerboa Runway

Status: Playtest 2 revision following the first playable route-building test. This document supersedes Build 0.1's polygon docking sandbox. The previous design is preserved in [archive/BUILD_0_1_DESIGN.md](archive/BUILD_0_1_DESIGN.md), not active requirements.

Read [DECISIONS.md](DECISIONS.md) for the distinction between Tyler-approved rules and agent-made implementation calls. Technical details are in [TECHNICAL_DESIGN.md](TECHNICAL_DESIGN.md). Validation and the next playtest are in [PLAYTEST.md](PLAYTEST.md).

## The question

Is it fun to lay an excursion behind an autonomous jerboa, anticipate his return, watch him discover the new branch, and decide when to reverse him before the Ring catches him?

The player builds his future itinerary. He is curious and completely unaware of the Ring. The player's responsibility is to turn available road shapes into profitable, survivable journeys.

## Run and objective

- Portrait phone; square board backed by a hidden square grid.
- Collect as many points as possible before the circular Ring touches the jerboa.
- The Ring closes completely. Every run ends in capture; there is no survival victory.
- Default maximum: three minutes. One- and two-minute options compress the same phases for testing.
- Three equal-duration phases: slow, medium, fast. Exact rates are provisional; see the decision ledger.
- Start at the central 1×1 road square, hopping in place. The first successful placement starts travel and the clock. Draft inspection, rotation and rerolls before that are untimed.
- A simple hopping marker with ears stands in for a future stylized jerboa.

## Construction and draft

- Three draft slots. Tap a piece in the row to rotate clockwise by 90 degrees.
- Drag it upward to place it. Its orientation is locked throughout that drag.
- Every cell must be inside the square board and unoccupied. At least one cell must share an edge with existing runway.
- Every shared cell edge connects; diagonal corners do not. Side connections, junctions, shortcuts and loops are legal.
- Pieces can straddle or sit outside the current Ring. The Ring is not a construction wall.
- The Ring leaves runway intact. New placements may retire old whole pieces under the runway limit below.
- Illegal placement never commits. It displays red with a reason and returns to the same draft slot on release. Orientation is retained for another attempt.
- A slot stays reserved while its piece is held. Placement refills only that slot.
- A downward swipe from the row discards/rerolls that slot without a separate currency cost. The active run's clock continues.
- No manual hammer in P1. Automatic retirement is tied to successful placement.

### Runway retirement

Start with a soft limit of 25 occupied squares, including the starting square. After each successful placement, remove the oldest eligible whole piece until at or below the limit. Protect the newest piece, the jerboa’s current cell, both ends of his in-flight hop, and connectivity of all remaining runway. Skip ineligible older pieces. If none can be removed safely, temporarily exceed the limit and show PROTECTED beside the square count. Never reject an otherwise legal placement for this reason. Reconsider removal on the next placement, not during a hop. The starting square can retire once safe.

Retiring cells flash amber briefly, then disappear; they are immediately empty for placement. Clear their exploration memory so rebuilt road is new territory. Collectibles stay on their ground locations. Tune can change the limit or disable it with 0. This conservative whole-piece rule is provisional: dense loops/bridges can prevent enough removal, which the next playtest should evaluate.

### Authored pool

Shapes use orthogonally connected squares. Rotation is allowed in the draft; reflection is not, so L/J remain separate.

| Group | Total draw probability | Members |
| --- | --- | --- |
| Common | 70% | I, L, J, T (4 each), Step and W (5 each); no O/2×2 square |
| Small exotic | 15% | Dot (1), Domino (2), Line3 (3 straight), Elbow (3) |
| Large exotic | 15% | Long (6), Cup (5), Cross (5) |

Members are equally likely within their group. Each small piece, including Dot and Line3, has a 3.75% chance on each draw. Exact silhouettes live in `src/runway.ts`; no special powers attach to any shape. Watch whether free swiping makes players hunt for Dots instead of using the offered shapes.

## Autonomous movement

- One orthogonal cell per hop; hopping speed is constant within a run.
- At a choice, compare all unique unvisited squares reachable through each available exit, not just the corridor to the next junction.
- For this comparison, the deciding square is blocked. A branch cannot count territory by immediately returning through that same junction.
- Count shared territory once per exit. When two exits lead around a loop into the same unexplored region, their weights can tie.
- Prefer the highest weight. Ties are random, and the chosen route is revealed before movement through color and arrows.
- The chosen future route can change as the player builds. A hop already in flight is immutable.
- Dead ends automatically turn him around. He never falls off runway.
- When every reachable square is explored, he keeps patrolling under the same random-tie rule.
- Ordinary travel does not immediately reverse through its incoming edge while another exit exists. This is an agent call documented for review.
- Tap the jerboa to reverse once. He completes the current hop, then retraces that connection. Normal exploration resumes afterward; this is not a sustained retreat-to-start mode.
- Navigation ignores Ring position and collectible value. A new collectible on an explored road does not reset the visit history.

### Color

Color means planned movement, not speed or piece type. The upcoming route is cyan with directional arrows. Traversed road becomes neutral; a return route lights again when he turns. Permanent exploration memory is separate from this changing color.

The preview uses the same decision function and a copy of its random state. It never rerolls a choice simply because the screen redraws. It stops at the next turnaround/repeated square (or a generous safety limit); he continues moving after that and the preview advances.

## Ring and collision

- The jerboa has zero awareness of the Ring and can willingly walk into danger.
- Only the jerboa's small ground footprint touching the Ring ends the run. Playtest 2 reduces its radius from 0.24 to 0.10 cells for near misses; this does not change the orthogonal hop path. The decorative bounce and ears do not change the hit area.
- Roads remain mechanically usable outside the Ring, but taking the jerboa there is lethal.
- There is no Ring-driven erosion, falling, health, recovery, or extra life.
- Ring speed advances through three phases; movement and draft controls remain active throughout.

## Point nodes

- Nodes have visible values of 1, 3 or 5, selected randomly.
- Collect once on landing on the node's square; it disappears and awards its value. Laying road over it awards nothing.
- Maintain a small target pool (starting assumption: six). Replace collected nodes and nodes overtaken by the Ring.
- Default spawn policy is uniform random among eligible cell centers inside the remaining Ring, including existing runway. It does not favor reachable, helpful, safe or unvisited destinations.
- Avoid duplicate node occupancy and the jerboa's current/committed landing cells. These exclusions prevent instant replacement/collection loops, rather than optimizing player opportunities.
- A node's visible disk must fit inside the Ring. If too few cells remain, the pool shrinks rather than forcing an impossible spawn.
- Nodes do not cause a stage transition. Powerups: x2 and freeze (see the decision ledger).

Playtest 7 additions (DECISIONS U38–U42):
- Values are 1–5 plus a rare 10 that moves: about every 2 s it steps to a neighbouring cell, staying within 1 cell of where it appeared and never leaving the cell he is hopping to.
- Freeze stops time: the Ring, the x2 countdown and moving 10s all wait. x2 with freeze is a DOUBLE BONUS.
- Reverse tips: a tip at the start and a flash when his route is about to cross the Ring, until the player has reversed in two runs.

## Run history

Record local run summaries and a timestamped action/hop timeline, with seed, settings, build, score, survival time, placements, rotations, discards, invalid drops, reversals, road removed and peak road size after retirement. A near-miss escape means entering within 0.5 cells of contact and later getting more than 0.75 cells clear; capture is not an escape. Runs can end as caught, restarted or interrupted. Runs → Export runs creates a shareable JSON report. No account, upload or cloud synchronization.

## Deferred experiments

1. Spawn nodes only on uncovered ground.
2. A state-aware spawn system designed to produce enjoyable opportunities; do not silently introduce this into the random baseline.
3. Clear all nodes to progress to another stage with faster hopping and Ring movement.
4. Hammer/removal, powerups, art and sound, other shapes, and balancing the reroll economy.

## Playtest criteria

A player should be able to predict a turn from the colored route, build a branch behind the jerboa, recognize the return journey, and deliberately reverse near danger. Incorrect turns, invisible placement constraints, and input mistakes should not be mistaken for difficulty. Test one-, two-, and three-minute runs before committing to the final length.
