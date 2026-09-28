# Prototype 1 — Technical design

## Architecture

- `src/runway.ts`: integer cells, sixteen shape definitions, normalized quarter-turn rotation, translation, placement validation, deterministic RNG, four-neighbor adjacency, reachable-unvisited branch weights and exit selection.
- `src/game.ts`: pure simulation, settings/tuning, three draft slots, mutable board/visit sets and ordered placed-piece records, point nodes, selected/in-flight hops, future route forecast, score and Ring lifecycle.
- `src/main.ts`: native Pointer Events input, Canvas 2D renderer, responsive portrait layout, route arrows/color, legality ghosts, announcements, results, Tune panel and restart.
- `src/input.ts`: pure direction/threshold classification for tap, drag and downward discard.
- `src/rounds.ts`: round configs: a round's Ring length, phases (share, speed, pulse, node value weights), hop speed, node count, opening 5s and powerup timers; the Ring radius/phase/beat functions per round; `parseRoundSet` clamps sets from outside (pure, dependency-free). Classic is one round with no goal, built from `Settings` + `TUNING` (`classicSet` in `src/game.ts`), so Tune and URL overrides still apply. `Game` reads everything per-round through `game.round`.
- `src/tips.ts`: reverse tips: whether they still show on this device, counting runs with a reversal, and where his forecast route meets the Ring (pure).
- `src/stats.ts`: versioned run reports, bounded local history, storage-failure handling and JSON export.
- `src/gtx.ts`: Gametronyx launch handoff, feedback, and posting scores with a retry queue (pure; fetch and storage are passed in).
- `src/leaderboard.ts`: ranked-settings check, API board validation, this device's fallback board, board rows with gaps, the scroll that puts the player a third of the way down, and the end-of-run cheer (pure).
- `src/finale.ts`: the end-of-run screen DOM: count-up, confetti, board rows and Play again.
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

Nodes spawn uniformly on eligible cells inside the current Ring. Values 1–5 and 10 are drawn from the current phase's weights in `TUNING.phaseValueWeights`, shifting toward 5s and 10s each phase. The first two spawns of a run are 5s. Existing runway is eligible; the current source cell, committed landing cell and existing node cells are excluded. Node disks must fit fully inside the Ring. Expired or collected nodes replenish; if eligible space is exhausted, the pool may shrink. No path reachability or helpfulness filter is used.

The engine has a `spawn: 'uncovered'` option as a future experimental seam, but the shipped UI/default always uses `random`. No smart behavior is implemented.

## Moving 10s

A 10 is a moving node. Its value stays in `nodes` (so spawning exclusions, Ring removal and reports treat it like any node) and `movers` holds its home cell and next step time, keyed by its current cell. Every removal goes through `dropNode`, so a later node on the same cell never inherits mover state. Each simulation slice, after landing and `beginHop`, `stepMovers` moves each due mover to a random orthogonal neighbour within `TUNING.mover.range` (Chebyshev) of home that is on the board, inside the Ring by its disk, and free of nodes, powerups, his cell and his committed landing cell (`moverSteps`). A mover on his landing cell never moves. Step times are on the live clock (below), so movers wait while frozen and before the run starts. Movers draw from their own random stream (`moverRng`), leaving node spawns for a seed unchanged. The renderer wobbles a mover during `wobbleMs` before a step and slides it for `slideMs`; collection depends only on its cell.

## x2 powerup

At most one x2 node exists. It spawns on a random eligible cell once the run clock passes `boostFirstMs`, and again `boostRespawnMs` after the previous one is collected or overtaken by the Ring, never during an active boost. Landing on it sets `boostEndsAt = liveMs + boostMs`: x2 runs on the live clock, so a freeze pauses it (`boostLeft`, `doubleBonus` when both are active). Each hop stores its own duration, fixed when the hop begins: `hopMs / boostSpeed` while boosted. Point collections while boosted score double. `pickups` exposes a short sequence-numbered log so the renderer can play bursts without reading the event timeline.

## Freeze powerup

The Ring runs on its own clock, `ringMs`, which advances with play except while `elapsed < freezeUntil`. Radius, phase, node value phase, heartbeat and the countdown all read `ringMs`. A second clock, `liveMs`, also stops while frozen but is never reset or rewound; the x2 countdown and moving nodes read it. Hops, the freeze itself and spawn timers read `elapsed`. `radiusIn(ms)` forecasts the radius `ms` ahead, allowing for the rest of a freeze. Landing on the freeze node sets `freezeUntil = elapsed + freezeMs`. It spawns like x2 (`freezeFirstMs`, `freezeRespawnMs`, never while frozen). Both powerups spawn at least `powerupRingMargin` cells inside the Ring.

## Reverse tips

`reverseTipsWanted` is read at each restart: tips show until `noteReversal` has counted reversals in `TIP_RUNS` (2) runs on this device (`jerboa_reverse_tips_v1`; each run counts once; without storage they always show). For `FX.tipStartMs` (4 s) after a run is ready, and for `FX.tipIntroMs` (3 s) after the first placement until he reverses, a callout sits just inside the top of the Ring (clear of the first pieces' spots) and a ring pulses around him; both fade over their last half second. Each frame `routeCrossesRing` walks his cached forecast route up to 4 hops, comparing each cell centre plus the hit radius with the Ring's radius forecast for that hop. A result of 2 or more (a reverse can still save him) shows a red ring and "TAP HIM TO TURN BACK!"; it is announced at most `FX.tipAnnouncements` times a run. Presentation only; the simulation is unaffected.

## Links back to Gametronyx

`VITE_GTX_SITE` (default `https://gametronyx.com`), fixed at build time, is the target of "‹ Gametronyx" in the top bar, "More games" on the end screen, and "gametronyx.com" inside end-screen notes. "More games" ignores taps until the end screen is armed. Score posts use `keepalive` so following a link doesn't cancel one in flight.

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

## Leaderboard end screen

When the Ring catches him, `finishRun` in `src/main.ts` opens the end screen and, for a ranked run with a session, posts the run. The reply is the board. Without a session, or when the post fails, the board is this device's own ranked runs of this build. See `docs/DECISIONS.md` L1–L3 and L-01 to L-09.

The server is the Gametronyx leaderboard server: gametronyx repo, `server/`, at `VITE_SCORES_API` (default `https://scores.gametronyx.com`). Its full API is in gametronyx `docs/DESIGN.md` §15. What Jerboa uses:

`POST /api/leaderboards/jerboa/scores` with `Authorization: Bearer <session token>` and the body `{run_id, score, nodes, hops, seconds, ring_seconds, boosts, freezes, near_misses, build, build_sha, settings}`. A successful reply is 200 or 201 with:

```json
{"season": "Playtest 6", "players": 23, "rank": 4, "previous_rank": 7, "best": 142, "previous_best": 120, "personal_best": true,
 "entries": [{"rank": 1, "username": "…", "score": 212, "me": false}],
 "me": {"rank": 4, "username": "…", "score": 142}}
```

- `entries` is the top 10 plus up to 5 places above and 10 below the player, in rank order. The game marks skipped places with "⋯" and scrolls the player's row a third of the way down the list. `me` is the player's own row, even when it isn't in `entries`.
- `rank` and `best` are the player's standing by their best score this season. `previous_*` are the values before this run and are null for a first run.
- Ties share a rank.
- Usernames only, never emails.
- `401`/`403` mean the session ended, and the game clears its token.
- `404` means there is no leaderboard. The game shows the device board and doesn't resend.
- `429`, `5xx` and network failures are queued for a retry. Any other `4xx` means not ranked, and the run is not resent.
- The server:
  - ignores a repeated `run_id` for the same player;
  - assigns the season itself;
  - ranks only runs whose settings match the season's ranked settings (any seed);
  - refuses impossible runs: score over 10 × nodes, nodes over hops, `ring_seconds` over the run length, or play time outside the Ring's time plus freezes. Playtest 7's 10s are worth 20 with x2, so the score cap must rise to 20 × nodes before Playtest 7 reaches main (DECISIONS U42).
- **When Jerboa's defaults change** (a new playtest's tuning), the leaderboard needs a new season with the new ranked settings, or new runs are refused as not ranked. See gametronyx `docs/LAUNCH_CHECKLIST.md` Part H.

## Rounds trial

`new Game(settings, roundSet)` plays a set of rounds. `ringMs` is time within the round; `ringTotalMs` covers the run (run reports' `ringSeconds`). Each point collected adds to `roundScore`; after a landing's pickups, reaching the round's goal calls `clearRound`: log the round, advance `roundIndex`, reset `roundScore` and `ringMs`, hold the Ring for `TUNING.roundHoldMs`, drop every node (the refill at the end of the step deals the new round's full set, with its opening 5s), drop powerups the new round lacks, reset `nearRing`, restart the powerup timing, and push a `round` pickup for the renderer. Everything derived from the Ring's radius (node target, road cap, longest piece) resets by itself. The next hop uses the new round's hop speed. A set that is not parsed can't clear past its last round.

Rounds with a `spawner` place powerups through `spawnPowerup` (own random stream, `powerRng`); Classic keeps its per-powerup timers and draw order. `main.ts` keeps the mode outside `Settings`: Tune's Mode select or `?mode=rounds[&set=custom]`. The HUD shows `ROUND n/N · score/goal` with a gold progress bar; a round change shows a bloom and banner instead of the phase banner (which now fires only when the phase rises). Reports add `mode`, `round`, `roundsTotal`, `roundsCleared`, `roundLog` and `roundSet` (a custom set in full). `isRankedReport` keeps Rounds runs off the leaderboard and the Classic device board.

## Rounds powerups

Powerups on the board live in `powerNodes` (cell → kind). Landing on one calls `usePower`; point nodes go through `collect(k, via)`, which scores, doubles under x2, adds to the round's goal, counts movers, and logs the collection (`via` sweep or magnet when not a landing). Expand rewinds `ringMs` to the time the round's Ring had a radius 1.5 cells larger (`roundMsForRadius`, the inverse of `roundRadius`). Sweep collects every node of the board's lowest value. Magnet and speed end on the live clock (`magnetEndsAt`, `speedEndsAt`), so a freeze pauses them; while the magnet runs, each landing also collects nodes within its range. Hop duration uses the larger of the x2 and speed multipliers. Cherries count across the run and pay a bonus per set. The spawner places a kind only when the round has its settings and a weight, it isn't on the board and its effect isn't running (`canSpawn`); a new round removes kinds it lacks from the board. Powerups lost to the Ring are checked in a fixed kind order so Classic's event log is unchanged.

## Round designer

`designer.html` + `src/designer.ts` (a second Vite entry). It edits a working copy of a set, stores it under `jerboa_custom_rounds_v1` whenever it is valid, and draws the Ring across the whole run (`ringTimeline`: every round at full length) as an SVG line with a crosshair readout and a table view. Play stores the parsed set and opens `index.html?mode=rounds&set=custom`; the game falls back to the built-in set, with a message, if that set can't be read. Share links carry the set as URL-safe base64 (`encodeRoundSet`/`decodeRoundSet`). All links are relative, so branch builds work.

## Golden replay

`tests/replay.test.mjs` plays whole Classic runs with a deterministic bot through the public API and compares counters, clocks, board, nodes and an event-log hash with `tests/golden/replay-v1.json`. Refactors must pass it unchanged; after an intended gameplay change, rewrite it with `UPDATE_GOLDEN=1 npm test` and say why in the commit.

## Build, tests and package

`npm ci`, `npm test`, `npm run build`. Tests compile only the pure model to `.test-build` and use Node's built-in test runner. Production has no runtime npm dependencies. `npm run package` builds and packages the prebuilt output, static server, Windows launchers and docs.

Source checkout launchers rebuild from source. Distributed zip launchers use its included dist and need only Node; dependency installation/build is skipped. The hotel launcher keeps the established Mobile Hotspot instructions. Do not change firewall, VPN or hotspot settings automatically. Real phone/hotspot connectivity must be tested on Tyler's devices.

## Extension seams

Shape library, group weights, hop rate, node values/count, Ring phase rates, spawn policy and route policy are localized. Keep behavior changes in the pure model and tests. Other road-removal policies, hammers, powerups and stages require explicit design changes; do not implement them as tuning fixes.

## Launcher address repair

`scripts/network.mjs` enumerates non-loopback IPv4 interfaces through Node, excludes unassigned link-local addresses, and prioritizes the standard hotspot subnet / Wi-Fi Direct adapter names. Hotel launcher detection uses this helper. `serve.mjs --auto-port` attempts to bind ports directly and retries occupied ports before printing actual listening URLs. The package includes both scripts. No firewall, VPN or network settings are changed by this repair.
