# 3 Minutes to Midnight — Prototype 1: Jerboa Runway

Status: playable implementation for the first route-building playtest. This document supersedes Build 0.1's polygon docking sandbox. The previous design is preserved in [archive/BUILD_0_1_DESIGN.md](archive/BUILD_0_1_DESIGN.md), not active requirements.

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
- Placed runway is permanent and remains intact when the Ring passes over it.
- Illegal placement never commits. It displays red with a reason and returns to the same draft slot on release. Orientation is retained for another attempt.
- A slot stays reserved while its piece is held. Placement refills only that slot.
- A horizontal swipe within the row discards/rerolls that slot without a separate currency cost. The active run's clock continues.
- No hammer or other road-removal action in P1.

### Authored pool

Shapes use orthogonally connected squares. Rotation is allowed in the draft; reflection is not, so L/J and S/Z remain separate.

| Group | Total draw probability | Members |
| --- | --- | --- |
| Common | 70% | I, L, J, T, S, Z — four cells each; no O/2×2 square |
| Small exotic | 15% | Dot (1), Domino (2), Elbow (3) |
| Large exotic | 15% | Long (6), Cup (5), Cross (5) |

Members are equally likely within their group. The Dot has a 5% chance on each draw. Exact silhouettes live in `src/runway.ts`; no special powers attach to any shape. Watch whether free swiping makes players hunt for Dots instead of using the offered shapes.

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
- Only the jerboa's ground footprint touching the Ring ends the run. The decorative bounce and ears do not change the hit area.
- Roads remain mechanically usable outside the Ring, but taking the jerboa there is lethal.
- There is no road erosion, falling, health, recovery, or extra life.
- Ring speed advances through three phases; movement and draft controls remain active throughout.

## Point nodes

- Nodes have visible values of 1, 3 or 5, selected randomly.
- Collect once on landing on the node's square; it disappears and awards its value. Laying road over it awards nothing.
- Maintain a small target pool (starting assumption: six). Replace collected nodes and nodes overtaken by the Ring.
- Default spawn policy is uniform random among eligible cell centers inside the remaining Ring, including existing runway. It does not favor reachable, helpful, safe or unvisited destinations.
- Avoid duplicate node occupancy and the jerboa's current/committed landing cells. These exclusions prevent instant replacement/collection loops, rather than optimizing player opportunities.
- A node's visible disk must fit inside the Ring. If too few cells remain, the pool shrinks rather than forcing an impossible spawn.
- Nodes do not cause a stage transition. No powerups in P1.

## Deferred experiments

1. Spawn nodes only on uncovered ground.
2. A state-aware spawn system designed to produce enjoyable opportunities; do not silently introduce this into the random baseline.
3. Clear all nodes to progress to another stage with faster hopping and Ring movement.
4. Hammer/removal, powerups, art and sound, other shapes, and balancing the reroll economy.

## Playtest criteria

A player should be able to predict a turn from the colored route, build a branch behind the jerboa, recognize the return journey, and deliberately reverse near danger. Incorrect turns, invisible placement constraints, and input mistakes should not be mistaken for difficulty. Test one-, two-, and three-minute runs before committing to the final length.
