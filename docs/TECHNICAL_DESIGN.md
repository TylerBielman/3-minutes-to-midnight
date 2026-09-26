# Prototype 1 — Technical design

## Architecture

- `src/runway.ts`: integer cells, sixteen shape definitions, normalized quarter-turn rotation, translation, placement validation, deterministic RNG, four-neighbor adjacency, reachable-unvisited branch weights and exit selection.
- `src/game.ts`: pure simulation, settings/tuning, three draft slots, mutable board/visit sets and ordered placed-piece records, point nodes, selected/in-flight hops, future route forecast, score and Ring lifecycle.
- `src/main.ts`: native Pointer Events input, Canvas 2D renderer, responsive portrait layout, route arrows/color, legality ghosts, announcements, results, Tune panel and restart.
- `src/input.ts`: pure direction/threshold classification for tap, drag and downward discard.
- `src/stats.ts`: versioned run reports, bounded local history, storage-failure handling and JSON export.
- `src/style.css`: responsive canvas and accessible native controls. No framework/physics dependency.
- `scripts/serve.mjs`: dependency-free Node static server for the prebuilt Windows package; no-cache responses, fixed dist root, browser opened only after listening.

## Model

Grid cells are integer `(x,y)` keyed as `x,y`. The odd-sized board has a central starting cell. The board is a `Set<string>`. Visits are a separate `Set<string>`; retired cells are removed from both. Each committed piece has its ordered cell list and shape ID, including the starting cell as the oldest piece. All four cardinal neighbors connect automatically, regardless of piece provenance.

A draft entry contains shape ID and quarter turns. Cells are normalized after rotation. Placement is validated again on release: all cells integer/in bounds, unique, non-overlapping, and at least one edge-adjacent to existing runway. Ring position is deliberately absent from this function. Failed placement does not mutate board, draft, clock or orientation.

## Endgame limits

The point-node target is `min(nodeCount, max(minNodes, ceil(nodeCount·r/r0)))`: it scales with the Ring's radius and only limits refills.

The effective runway cap is `min(roadLimit, max(minRoadLimit, floor(π·r²·endgameRoadDensity)))`; it only bites late in the run. Retirement prefers pieces entirely outside the Ring, then the oldest. Draws only offer shapes whose longest side is at most `floor(2r)`, and `replaceOutgrown` swaps draft pieces that no longer fit, skipping the piece being dragged.

## Retirement contract

After successful placement, while board size exceeds nonzero `roadLimit`, find the oldest piece that is not newest, does not contain current/from/to actor cells, and whose removal leaves all remaining board cells reachable from the actor. Remove it whole and repeat. If no piece qualifies, retain the excess. Ring, timer, invalid drops and hops never trigger retirement. The oldest seed cell can retire. Collectible positions remain independent. Rebuilding retired cells restores unvisited territory. Revision invalidates forecast immediately; an in-flight hop stays protected.

## Navigation contract

At a landed cell, enumerate neighboring road cells. An explicit queued reverse chooses the previous cell. Otherwise exclude that incoming edge if there is another exit. For each candidate, flood-fill road while treating the deciding cell as blocked; score the number of unique unvisited cells reached. Ring position, points, piece type and distance are not inputs.

Select maximum weight. On a tie, advance the navigation RNG once. With zero unexplored cells all remaining exits tie, producing patrol behavior. With one neighbor, turn back. With no neighbor, hop in place.

A hop stores from/to and elapsed milliseconds. Its target is immutable until landing. Construction affects the route after that landing. A tap queues one reverse; it cannot teleport or reverse the current animation halfway through. A second tap before landing leaves the same reverse queued.

Forecasting clones visit memory and navigation RNG. It starts with the immutable in-flight target, then repeatedly calls the same selector, marking simulated arrivals visited. It stops on repetition/turnaround or the 64-step limit. Preview generation is read-only. Route redraws cannot alter future random choices. Construction and reversal invalidate the visual forecast; a landing does too.

## Time and Ring

Simulation advances in slices no larger than 16 ms, splitting on hop completion. Ring radius is piecewise linear. Phases take 1/3, 4/9 and 2/9 of the run (60/80/40 s at 3:00) at .5/.875/2.0 times the average required speed. The starting radius is `grid/2 - .25` cell units and reaches zero at the selected maximum duration.

The jerboa's ground center interpolates along the committed edge. Capture occurs if distance from board center plus configurable hit radius (default .10 cells; original .24 available in Tune) is at least the current Ring radius. The visual bounce is excluded. Collision precedes landing awards. The run ends on contact, usually before the theoretical zero-radius instant. Large frame gaps are simulated through; the clock does not pause when the app is hidden.

## Randomness and spawning

One seed initializes three independent streams (pieces, nodes, navigation). Drawing a piece samples a group, then a uniform member. Rotation and cancelled placement do not consume draws. Swiping or successful placement consumes one new piece.

Nodes spawn uniformly on eligible cells inside the current Ring. Values 1–5 are drawn from the current phase's weights in `TUNING.phaseValueWeights`, shifting toward 5s each phase. The first two spawns of a run are 5s. Existing runway is eligible; the current source cell, committed landing cell and existing node cells are excluded. Node disks must fit fully inside the Ring. Expired or collected nodes replenish; if eligible space is exhausted, the pool may shrink. No path reachability or helpfulness filter is used.

The engine has a `spawn: 'uncovered'` option as a future experimental seam, but the shipped UI/default always uses `random`. No smart behavior is implemented.

## x2 powerup

At most one x2 node exists. It spawns on a random eligible cell once the run clock passes `boostFirstMs`, and again `boostRespawnMs` after the previous one is collected or overtaken by the Ring, never during an active boost. Landing on it sets `boostUntil = elapsed + boostMs`. Each hop stores its own duration, fixed when the hop begins: `hopMs / boostSpeed` while boosted. Point collections while boosted score double. `pickups` exposes a short sequence-numbered log so the renderer can play bursts without reading the event timeline.

## Freeze powerup

The Ring runs on its own clock, `ringMs`, which advances with play except while `elapsed < freezeUntil`. Radius, phase, node value phase, heartbeat and the countdown all read `ringMs`; hops, boosts and spawn timers read `elapsed`. Landing on the freeze node sets `freezeUntil = elapsed + freezeMs`. It spawns like x2 (`freezeFirstMs`, `freezeRespawnMs`, never while frozen). Both powerups spawn at least `powerupRingMargin` cells inside the Ring.

## Ring pulse

`ringBeats(elapsed)` integrates beats across phases with the periods in `TUNING.ringPulseMs`, so the pulse stays continuous and simply quickens at each phase boundary. The renderer adds the phase-change surge. The pulse is presentation only.

## Input and feedback

One captured pointer is active at a time. In the draft, a short stationary release rotates; once the run has started, a downward swipe of at least 30 logical pixels, with vertical displacement greater than 1.15× horizontal displacement, arms discard. Returning upward before release cancels that discard. Upward departure of more than 24 logical pixels changes the gesture to a drag and locks orientation. The ghost uses full board scale and an upward offset. Invalid cells are red with an X and a reason. Valid cells are green/cyan. Once drag mode starts it cannot become a discard. Release re-evaluates the gesture even if move events were coalesced. Cancelling a drag or releasing illegally preserves the original slot entry and flashes its frame.

The road is neutral; upcoming route is cyan with arrows. Traversed cells lose route color; planned return legs light again. Gold disks show node values. The Ring and outside shading remain separate from placement legality. A small ground marker defines the jerboa's collision footprint and ears identify the placeholder.

## Tuning and reproduction

Tune exposes 1/2/3-minute duration, 15/19/23-cell grid, 300/450/650 ms hop interval, node count, random seed, soft runway limit, hit radius and designer grid. Apply starts a new run. URL parameters also support `duration`, `grid`, `hop`, `nodes`, `seed`, `limit`, `hit`, and `debug`, e.g. `?seed=42&duration=60&hop=450&nodes=6`.

The first visible UI is ready before the run starts. Clicking New run generates a fresh seed; reusing Tune's seed is deterministic. The same gesture sequence and elapsed times reproduce the game.

## Local run reports

Version 1 reports identify build P1-playtest-2 and a unique run ID. HTTP phone addresses do not require secure-context UUID support: timestamp/random fallback is available. Reports include settings/seed, counters, final board/node positions and bounded 5,000-event timelines with truncation counts. Log draft rotation/discard, placement with cells and orientation, invalid release reason, queued reversal, hop landings, collections, retirements, danger entries, successful escapes and capture position/radius. Navigation RNG is unaffected by recording.

Save by run ID after draft actions, every five seconds of play, on capture/restart and visibility/pagehide. No history record before first placement. On a fresh load, previous active checkpoints are marked interrupted; do not claim those are completed scores. History retains up to 50 runs in `3mtm-runs-v1` localStorage; quota pressure drops oldest reports. Storage errors do not stop play and in-memory reports remain exportable with a visible warning. Browser history is origin-specific, including port. No remote telemetry endpoint. Export provides summary and timeline for discussion, not a video or full automated replay. Multi-tab concurrent play is not synchronized.

Near-miss escape counter uses hysteresis: enter below .5-cell clearance, count only when later above .75. Fatal contact does not increment escapes. Closest surviving clearance is sampled at simulation steps and will often be near zero just before death.

## Build, tests and package

`npm ci`, `npm test`, `npm run build`. Tests compile only the pure model to `.test-build` and use Node's built-in test runner. Production has no runtime npm dependencies. `npm run package` builds and packages the prebuilt output, static server, Windows launchers and docs.

Source checkout launchers rebuild from source. Distributed zip launchers use its included dist and need only Node; dependency installation/build is skipped. The hotel launcher keeps the established Mobile Hotspot instructions. Do not change firewall, VPN or hotspot settings automatically. Real phone/hotspot connectivity must be tested on Tyler's devices.

## Extension seams

Shape library, group weights, hop rate, node values/count, Ring phase rates, spawn policy and route policy are localized. Keep behavior changes in the pure model and tests. Other road-removal policies, hammers, powerups and stages require explicit design changes; do not implement them as tuning fixes.

## Launcher address repair

`scripts/network.mjs` enumerates non-loopback IPv4 interfaces through Node, excludes unassigned link-local addresses, and prioritizes the standard hotspot subnet / Wi-Fi Direct adapter names. Hotel launcher detection uses this helper. `serve.mjs --auto-port` attempts to bind ports directly and retries occupied ports before printing actual listening URLs. The package includes both scripts. No firewall, VPN or network settings are changed by this repair.
