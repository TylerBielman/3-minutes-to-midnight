# Prototype 1 — Technical design

## Architecture

- `src/runway.ts`: integer cells, twelve shape definitions, normalized quarter-turn rotation, translation, placement validation, deterministic RNG, four-neighbor adjacency, reachable-unvisited branch weights and exit selection.
- `src/game.ts`: pure simulation, settings/tuning, three draft slots, permanent board/visit sets, point nodes, selected/in-flight hops, future route forecast, score and Ring lifecycle.
- `src/main.ts`: native Pointer Events input, Canvas 2D renderer, responsive portrait layout, route arrows/color, legality ghosts, announcements, results, Tune panel and restart.
- `src/style.css`: responsive canvas and accessible native controls. No framework/physics dependency.
- `scripts/serve.mjs`: dependency-free Node static server for the prebuilt Windows package; no-cache responses, fixed dist root, browser opened only after listening.

## Model

Grid cells are integer `(x,y)` keyed as `x,y`. The odd-sized board has a central starting cell. The board is a `Set<string>` and never loses cells. Visits are a separate permanent `Set<string>`. All four cardinal neighbors connect automatically, regardless of piece provenance.

A draft entry contains shape ID and quarter turns. Cells are normalized after rotation. Placement is validated again on release: all cells integer/in bounds, unique, non-overlapping, and at least one edge-adjacent to existing runway. Ring position is deliberately absent from this function. Failed placement does not mutate board, draft, clock or orientation.

## Navigation contract

At a landed cell, enumerate neighboring road cells. An explicit queued reverse chooses the previous cell. Otherwise exclude that incoming edge if there is another exit. For each candidate, flood-fill road while treating the deciding cell as blocked; score the number of unique unvisited cells reached. Ring position, points, piece type and distance are not inputs.

Select maximum weight. On a tie, advance the navigation RNG once. With zero unexplored cells all remaining exits tie, producing patrol behavior. With one neighbor, turn back. With no neighbor, hop in place.

A hop stores from/to and elapsed milliseconds. Its target is immutable until landing. Construction affects the route after that landing. A tap queues one reverse; it cannot teleport or reverse the current animation halfway through. A second tap before landing leaves the same reverse queued.

Forecasting clones visit memory and navigation RNG. It starts with the immutable in-flight target, then repeatedly calls the same selector, marking simulated arrivals visited. It stops on repetition/turnaround or the 64-step limit. Preview generation is read-only. Route redraws cannot alter future random choices. Construction and reversal invalidate the visual forecast; a landing does too.

## Time and Ring

Simulation advances in slices no larger than 16 ms, splitting on hop completion. Ring radius is piecewise linear, with equal-duration phases and rates .5/1/1.5 times the average required speed. The starting radius is `grid/2 - .25` cell units and reaches zero at the selected maximum duration.

The jerboa's ground center interpolates along the committed edge. Capture occurs if distance from board center plus .24-cell body radius is at least the current Ring radius. The visual bounce is excluded. Collision precedes landing awards. The run ends on contact, usually before the theoretical zero-radius instant. Large frame gaps are simulated through; the clock does not pause when the app is hidden.

## Randomness and spawning

One seed initializes three independent streams (pieces, nodes, navigation). Drawing a piece samples a group, then a uniform member. Rotation and cancelled placement do not consume draws. Swiping or successful placement consumes one new piece.

Nodes spawn uniformly on eligible cells inside the current Ring. Values 1/3/5 are uniform. Existing runway is eligible; the current source cell, committed landing cell and existing node cells are excluded. Node disks must fit fully inside the Ring. Expired or collected nodes replenish; if eligible space is exhausted, the pool may shrink. No path reachability or helpfulness filter is used.

The engine has a `spawn: 'uncovered'` option as a future experimental seam, but the shipped UI/default always uses `random`. No smart behavior is implemented.

## Input and feedback

One captured pointer is active at a time. In the draft, a short stationary release rotates; a lateral swipe discards. Upward/vertical departure changes the gesture to a drag and locks orientation. The ghost uses full board scale and an upward offset. Invalid cells are red with an X and a reason. Valid cells are green/cyan. Cancelling a drag or releasing illegally preserves the original slot entry and flashes its frame.

The road is neutral; upcoming route is cyan with arrows. Traversed cells lose route color; planned return legs light again. Gold disks show node values. The Ring and outside shading remain separate from placement legality. A small ground marker defines the jerboa's collision footprint and ears identify the placeholder.

## Tuning and reproduction

Tune exposes 1/2/3-minute duration, 15/19/23-cell grid, 300/450/650 ms hop interval, node count, random seed and designer grid. Apply starts a new run. URL parameters also support `duration`, `grid`, `hop`, `nodes`, `seed`, and `debug`, e.g. `?seed=42&duration=60&hop=450&nodes=6`.

The first visible UI is ready before the run starts. Clicking New run generates a fresh seed; reusing Tune's seed is deterministic. The same gesture sequence and elapsed times reproduce the game.

## Build, tests and package

`npm ci`, `npm test`, `npm run build`. Tests compile only the pure model to `.test-build` and use Node's built-in test runner. Production has no runtime npm dependencies. `npm run package` builds and packages the prebuilt output, static server, Windows launchers and docs.

Source checkout launchers rebuild from source. Distributed zip launchers use its included dist and need only Node; dependency installation/build is skipped. The hotel launcher keeps the established Mobile Hotspot instructions. Do not change firewall, VPN or hotspot settings automatically. Real phone/hotspot connectivity must be tested on Tyler's devices.

## Extension seams

Shape library, group weights, hop rate, node values/count, Ring phase rates, spawn policy and route policy are localized. Keep behavior changes in the pure model and tests. Road erosion, hammers, powerups and stages require explicit design changes; do not implement them as tuning fixes.
