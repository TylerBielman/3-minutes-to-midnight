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

## Playtest 4 — 2026-09-26

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U27 | x2 lasts 2 seconds longer: default 7 s (still tunable). |
| U28 | Remove the "3 MINUTES TO MIDNIGHT" title from the game screen. |
| U29 | Freeze powerup: stops the Ring for a tunable duration (default 6 s); the Ring turns blue while frozen. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P4-01 | Freeze pauses the Ring clock: radius, phase, heartbeat and the on-screen countdown all stop, so the run gets longer by the frozen time. The jerboa, x2 timer and draft keep running | Keeps "time to midnight" consistent with the Ring. Run reports keep real seconds and add `ringSeconds`. `Game.ringMs`. |
| P4-02 | Freeze node is blue `#5aa9ff` with a ❄ glyph. First appears 25 s in, then 25 s after the previous is collected or lost; never while frozen; can coexist with x2 | `TUNING.freezeFirstMs`, `freezeRespawnMs`. |
| P4-03 | Frozen Ring is a steady blue glow with no heartbeat, and blinks orange/blue for its last 1.5 s as a thaw warning. Countdown turns blue with a ❄ timer bar under it | `FX.thawWarnMs` in `src/main.ts`. |
| P4-04 | Powerups (x2 and freeze) spawn at least 2 cells inside the Ring. Before this, x2 could spawn on the edge and be swallowed about a second later | `TUNING.powerupRingMargin`. Point nodes unchanged. |
| P4-05 | The browser tab title and the repository name are unchanged | Tyler asked only for the on-screen title; a new name is his call. |

## Playtest 5 — 2026-09-26 (endgame)

Tyler: the endgame had turned into mostly reversing the jerboa. Keep tile placement meaningful longer. Supersedes A03's equal phases and speeds.

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U30 | Late in the run, retire old road more aggressively to make room for new tiles. |
| U31 | Never deal a piece longer than the Ring's diameter. |
| U32 | Lengthen the middle phase, shorten the final phase and make the Ring close faster in it. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P5-01 | Phase lengths 60 / 80 / 40 s (fractions 1/3, 4/9, 2/9 of the run); speeds .5 / .875 / 2.0. The Ring still closes exactly at 3:00. Radius at the end of phase 1 is 7.7 cells (unchanged) and at the end of phase 2 is 4.1 cells (was 4.6). | Phase 3 is 33% faster than before (2.0 vs 1.5). Phase 2 is slightly slower so the totals still add up. `TUNING.phaseFractions`, `phaseSpeeds`; a test enforces the sum. |
| P5-02 | Runway cap = min(Tune limit, 30% of the Ring's area in cells), never below 6. It starts to bite around radius 5.2, just before phase 3. The HUD's cap turns orange when lowered. | Continuous, so there is no sudden purge. `TUNING.endgameRoadDensity`, `minRoadLimit`. Retirement still happens only on placement and keeps all protections. |
| P5-03 | Retirement removes road that is entirely outside the Ring before the oldest road inside it | Swallowed road is useless; this keeps usable road under the jerboa. |
| P5-04 | "Longer" means a piece's longest side in any rotation (I = 4, Long = 6, Cup = 3). Allowed while ≤ floor(diameter). At radius 3 (≈10 s into phase 3), 6-long pieces stop; at radius 2 (≈20 s in), I stops; at the very end only the Dot remains. If a group has no fitting shape, any fitting shape is dealt. | `shapeLength`, `Game.maxPieceLength`. |
| P5-05 | Draft pieces that outgrow the Ring are swapped immediately for free, with an orange slot flash and "The Ring outgrew a piece". The piece in your hand is never swapped. | `Game.replaceOutgrown`. Not counted as a discard. |

## Playtest 5b — 2026-09-26 (piece pool)

| ID | Decision (confirmed with Tyler) |
| --- | --- |
| U33 | Add V5, T5 and Y pentominoes to the large (exotic) pool, shaped as in the puzzlesland pentomino chart. Supersedes A02/P2-04's palette: 16 shapes, 6 common, 4 small, 6 large. |
| U34 | Group probabilities become 65% common / 15% small / 20% large (was 70/15/15). Each large shape is now ~3.3% per deal (was 5%); each common ~10.8% (was 11.7%). Supersedes U19's weights. |

Not added (and why): O4 and P contain a 2×2 block, which would form a tiny loop (U18); Z4 was replaced in Playtest 2; I5 duplicates I and Long; L5, Z5 and F were left for later.

## Playtest 6 — 2026-09-26

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U35 | Number of draft slots is tunable from 1 to 3; default 2 (was a fixed 3). |
| U36 | Default point nodes 10 (was 6), fewer in the endgame. |
| U37 | The opening hand never has the same piece in two slots. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P6-01 | The node target shrinks in proportion to the Ring's radius: 10 at the start, about 8 at the end of phase 1, 5 at the start of phase 3, never below 2. Nodes already on the board are not deleted early; the pool just stops refilling above the target. | Keeps node density per area of play roughly steady instead of crowding the small late Ring. `Game.nodeTarget`, `TUNING.minNodes`. |
| P6-02 | Slots are centered and spaced 129 px apart whatever the count; each keeps its tap target size. Tune "Draft slots" and URL `slots`. | `slotX` in `src/main.ts`. |
| P6-03 | Applies to the starting hand only; later deals can still repeat a shape already in the tray. L and J count as different pieces. Repeats are redrawn from the same seeded piece stream, so a seed still reproduces the same hand. | Constructor in `src/game.ts`. |

## Gametronyx integration — 2026-09-26

Source: Tyler's Gametronyx site brief (gametronyx repo `docs/DESIGN.md` §5.6 and §6, `docs/DECISIONS.md`).

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| G1 | Jerboa is launched from gametronyx.com. The game URL stays public ("launcher-only" gate for now). |
| G2 | A popup asks for feedback every 3 games played. |
| G3 | The popup is free text only, with a Skip button. |
| G4 | Feedback becomes a GitHub issue in this repo, labeled, showing the player's username and never their email. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| G-01 | A "game played" is a completed run: the Ring caught the jerboa. Restarts and abandoned runs don't count. | Matches "every 3 games played". `countCompletedRun` in `src/gtx.ts`; called from the game-over block in `src/main.ts`. |
| G-02 | Runs only count, and the popup only appears, when the player arrived from gametronyx.com with a session. Direct visitors never see it. | They have no account to attribute feedback to. |
| G-03 | The popup opens 1.2 s after the caught screen. The count restarts when it opens, so Send, Skip and closing the tab all wait another N runs. | No nagging; the player sees their result first. `promptFeedback` in `src/main.ts`. Timing superseded by L-07. |
| G-04 | The launch code is read from `#gtx_handoff=`, stripped at once, and traded for a token stored as `gtx_auth_token_v1`. The token is used only for feedback (and, since L1, scores). | The code is one-time and valid for 60 s, so a JWT never appears in a URL. |
| G-05 | The cadence comes from Gametronyx admin (`feedback_every_n_runs`), falling back to 3. The build SHA is attached to each report (`VITE_BUILD_SHA`, set by the deploy workflow). | Tunable without a Jerboa release; reports tie to a build. |
| G-06 | The API base is fixed at build time (`VITE_GTX_API`, default `https://api.gametronyx.com`). There is no URL override. | A URL override would let a crafted link send the session token elsewhere. |

## Leaderboard end screen — 2026-09-27

Source: Tyler's request for a leaderboard based on player usernames, then "Show the leaderboard at the end of a run with the play again prompt replacing the current game over screen. Celebrating the player."

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| L1 | Jerboa has a leaderboard of players ranked by their Gametronyx username. This extends the Gametronyx exception to "accounts and backend deferred". |
| L2 | When the Ring catches him, an end screen replaces the game-over panel. It celebrates the player and shows the leaderboard and a Play again button. |
| L3 | The player's own spot always shows. When it would be below the fold, the board scrolls so their row sits about a third of the way down. |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| L-01 | Only completed runs with default settings are ranked. The seed can be anything. Runs changed through Tune or the URL still play and still get a celebration, but they read "Tuned run · not ranked" and nothing is posted. | Keeps scores comparable. `isRanked` in `src/leaderboard.ts`. |
| L-02 | Every run gets a cheer, and bigger news gets a bigger one. In order: TOP OF THE BOARD! (a new best that puts you at #1), NEW PERSONAL BEST!, YOU'RE ON THE BOARD! (first ranked run), TIED YOUR BEST!, SO CLOSE! (within 10% of your best), otherwise NICE RUN!, GREAT HOPPING! or WELL PLAYED!. The score counts up, and there's more confetti for bigger news. | "Celebrating the player", even on a modest run. `cheer` in `src/leaderboard.ts`; the confetti amounts are `FX.confetti` in `src/finale.ts`. |
| L-03 | The board lists the top 10 and the places around you (the API sends up to 5 above and 10 below you), with a "⋯" where places are skipped. The device board lists every run. For L3 the list scrolls so your row's top is a third of the way down, but never past either end: near the top the board starts at #1, and in last place your row sits lower. Fades at the list's edges show there's more to scroll. Your row is gold with a YOU tag. Ties share a rank, and the earlier score is listed first. | You see the players just ahead to chase and just behind. `boardRows`, `anchorScroll` and `PLAYER_ROW_AT` in `src/leaderboard.ts`. |
| L-04 | Without a Gametronyx session, and whenever the leaderboard can't be used (offline, not switched on, or not deployed yet), the board lists this device's completed default-setting runs of this build under "Your best runs · this device". A note says why: no session, offline, or "The Gametronyx leaderboard isn't open yet". | Direct visitors and offline players still get a celebration and a target. `localBoard` in `src/leaderboard.ts`. |
| L-05 | A run that fails to post (offline, server error or rate limited) waits in `gtx_pending_scores_v1` (at most 10) and is resent after the next successful post or the next launch from gametronyx.com. The run ID makes a resend harmless. A 404 (no leaderboard) and other refusals are not resent. A post gives up after 5 s. | A best set on bad Wi-Fi isn't lost. `queueScore` and `flushPending` in `src/gtx.ts`. |
| L-06 | Play again ignores taps for 0.7 s, so a finger still on the draft tray when he's caught can't skip the celebration. It takes keyboard focus. The canvas HUD isn't drawn under the end screen. With reduced motion there is no count-up, confetti or animation. | `FX.armMs` in `src/finale.ts`. |
| L-07 | The feedback popup (G2) now waits for the celebration: it opens 1.8 s after the board appears. If the player taps Play again first, it opens at the next end screen instead. The cadence is unchanged. | The popup no longer covers the leaderboard. Supersedes G-03's 1.2 s. `FX.settleMs` in `src/finale.ts`. |
| L-08 | The server owns the leaderboard: it assigns the season name and ranks each player by their best score this season. The game only displays the result. The API contract is in `docs/TECHNICAL_DESIGN.md` (Leaderboard end screen). | Per Tyler (gametronyx U24), the server is the Gametronyx leaderboard server in the gametronyx repo (`server/`), not the accounts API. Live at `scores.gametronyx.com` since 2026-09-27. |
| L-09 | Scores go to `VITE_SCORES_API` (default `https://scores.gametronyx.com`), fixed at build time like the accounts address. | A URL override could send the session token elsewhere (G-06). |


## Playtest 7 — 2026-09-28 (issues #7–#12)

Source: Tyler's issues #7 (reverse tip), #8 (x2 + freeze), #9 (new powerups), #10 (moving higher points), #11 (link to gametronyx.com) and #12 (rounds and a design tool), talked through question by question. This build ships U38–U42. U43–U45 are approved and come next (plan: Rounds, then the powerups). Supersedes U24's "values 1–5", P3-06's "boost time is game time", P4-01's "x2 timer keeps running", and, for Rounds mode only, U16.

### Confirmed with Tyler

| ID | Decision |
| --- | --- |
| U38 | Reversing stays tap-the-jerboa (U09 unchanged). A tip at the start and a flash when his route is about to cross the Ring teach it. Both stop once the player has reversed in 2 runs on this device. |
| U39 | Link back to gametronyx.com: "More games" under Play again, "‹ Gametronyx" in the top bar, and the no-session note links to the site. Home page, same tab. |
| U40 | Freeze stops time: the Ring, the x2 countdown and moving nodes all wait. x2 and freeze together is a DOUBLE BONUS state. |
| U41 | A new, rare higher value (10) joins the normal node pool, likelier in later phases. Only it moves: a step to a neighbouring cell about every 2 s after a short wobble, within 1 cell of where it spawned, and never away from the cell he is hopping to. |
| U42 | Start a new season when Playtest 7 ships. Before it reaches main, the leaderboard server's score cap rises from 10 × nodes to 20 × nodes (a doubled 10 is worth 20), prepared by the agent in the gametronyx repo for Tyler to deploy. |
| U43 | Rounds, as an unranked trial mode (Classic stays ranked): each round has its own points goal counted from 0 (20, 40, …). Scoring it clears the round at once: the Ring resets to full, the next round is faster, and the point nodes are replaced with the new round's set. Missing it, the Ring catches him. The last round is a Midnight finale with no goal. |
| U44 | The round design tool is a page in this game (`designer.html`). |
| U45 | New powerups after Rounds, unlocked by round through one spawner: Magnet (he collects points near him), Speed (its own powerup, no scoring bonus), Cherries (a set pays bonus points), Sweep (collects the lowest value on the board), Expand (pushes the Ring out a fixed distance; it may return to an earlier phase). |

### Agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P7-01 | 10s are about 1% / 3% / 6% of new nodes in phases 1 / 2 / 3 (weights 1 / 3 / 6 beside the 1–5 weights). The two opening 5s are unchanged. | "Rare", but a few per run. `TUNING.phaseValueWeights`. |
| P7-02 | A 10 steps every 2 s ± 0.4 s of unfrozen time, orthogonally, within 1 cell (Chebyshev) of its spawn cell, onto free cells inside the Ring (never another node, a powerup, his cell or the cell he is hopping to). It wobbles for 0.5 s before a step and slides for 0.18 s. Boxed in, it waits for the next try. Before the first placement it stays still. | `TUNING.mover`. Moves use their own random stream, so a seed still deals the same nodes. |
| P7-03 | Freeze pauses x2 by running x2 on a live clock that stops while frozen (`Game.liveMs`). An x2 collected during a freeze starts counting at the thaw. The x2 respawn delay still runs on real time, and x2 still never spawns during a boost. | `boostLeft`, `doubleBonus` in `src/game.ts`. |
| P7-04 | DOUBLE BONUS: the phase line reads DOUBLE BONUS in violet, the x2 bar shows ❄ and stops shrinking, a violet shimmer sits inside the blue Ring, and a "DOUBLE BONUS!" burst plays when it starts. | `src/main.ts`. |
| P7-05 | Start tip: a callout above him before the first placement ("Once he's moving, tap him to turn him back"), then a pulsing "TAP HIM TO TURN BACK" ring for 6 s after it, until he reverses. Danger flash: when his forecast route meets the Ring 2–4 hops ahead (1 hop ahead is the hop in flight, which a reverse can't change), a red ring and "TAP HIM TO TURN BACK!", announced at most 3 times a run. | `src/tips.ts`, `FX.tipIntroMs`, `FX.tipAnnouncements`. The Ring's radius is forecast hop by hop (`Game.radiusIn`). |
| P7-06 | "More games" ignores taps for the same 0.7 s as Play again, so a finger on the draft tray at capture can't leave the game. Score posts use `keepalive`, so leaving through a link doesn't lose a post in flight. The site address is fixed at build time (`VITE_GTX_SITE`, default `https://gametronyx.com`). Under 370 px wide, the top bar drops the playtest label to fit the link. | `src/finale.ts`, `src/gtx.ts`, `src/style.css`. |
| P7-07 | No `Settings`/`DEFAULTS` key changed, so the ranked settings stay the same for the new season. The build label is `P1-playtest-7`, so this device's board starts fresh. | `src/stats.ts`. |

### Rounds trial (U43, U44): agent calls for review

| ID | Starting call | Why / where to change |
| --- | --- | --- |
| P7-08 | Mode is chosen in Tune ("Classic · ranked" / "Rounds · trial, not ranked") or with `?mode=rounds` (`&set=custom` plays the designer's set). It lives outside `Settings`, so ranked settings never change. Rounds runs are never posted; their reports carry `mode: 'rounds'`. | Keeps the live leaderboard untouched. `isRankedReport` in `src/leaderboard.ts`. |
| P7-09 | Built-in set: Round 1 goal 20, 100 s, 450 ms hops, x2 only; Round 2 goal 40, 90 s, 420 ms, adds freeze; Round 3 goal 60, 80 s, 390 ms; Midnight finale, no goal, 60 s, 360 ms. Each round keeps Classic's three Ring phases; its value weights shift toward 5s and 10s round by round. | Starting values to tune in the designer. `BUILTIN_ROUNDS` in `src/rounds.ts`. |
| P7-10 | When a round clears, the Ring holds at full size for 2 s under a "ROUND n · GOAL g" banner. Points past the goal don't carry over. Road, draft, visits, the hop in flight, an active x2 or freeze, and powerups on the board (if the new round has them) carry over. The node set is dealt fresh (U43), with the round's opening 5s. The Ring jumping away is not counted as a close escape. | `Game.clearRound`, `TUNING.roundHoldMs`. |
| P7-11 | In Rounds, one spawner places powerups: first at `firstMs` into the round, then an attempt every `everyMs`, picking by weight among the round's kinds that are neither on the board nor active, at most `max` (2) on the board. Classic keeps its separate x2 and freeze timers unchanged. | `Spawner` in `src/rounds.ts`; the golden replay guards Classic. |
| P7-12 | Rounds end screen: "Round n of N" or "<name> · final round", a note that the trial isn't on the leaderboard, and a device board of this set's Rounds runs ("Your best Rounds runs · this device") so there is still a best to beat. | `src/main.ts` `finishRun`, `localBoard(…, roundSet)`. |
| P7-13 | The designer (`designer.html`) edits every round number: goal, Ring length, hop, nodes, opening 5s, each phase's share, pace and point-value weights, and the powerups (spawner timing, weights, x2 length and speed, freeze length). Play saves the set on this device and opens `index.html?mode=rounds&set=custom`. Export/Import JSON and a share link (`designer.html#set=…`) move sets between devices. Everything is validated by `parseRoundSet`; the last round never has a goal. | A page in the game, as Tyler chose (U44). Moving sets into Gametronyx admin can come later. |
