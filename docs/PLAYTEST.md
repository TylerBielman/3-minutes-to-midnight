# Prototype 1 — Validation and phone playtest

## Previous P1 baseline verification

- TypeScript production build passes.
- Twelve automated tests pass: authored shape connectivity/rotation; hard overlap/connection/bounds validation; draft preservation and first-placement clock start; global unvisited reachability; unique loop counts and stable ties; forecast/actual travel; dead-end reversal/patrol; queued tap reversal; mid-hop replanning; one-time landing collection and runway-eligible replenishment; all Ring phases and road persistence; death during delayed frames; deterministic weighted draft distribution.
- Portrait browser at 390×844: tap rotation preserves Ready/time, first connected drag starts Phase 1, an overlapping drop returns the same piece to its slot with red feedback, horizontal swipe rerolls, tapping the moving jerboa acknowledges reversal, Tune opens and Apply restarts with the chosen seed, connected T + Cross construction produces a visible branching route.
- The connected T + Cross browser run collected four nodes for 18 points and ended on Ring contact at 41.3 seconds of a one-minute run. No browser errors or warnings were recorded.
- Compact 320×568 browser layout also fits without horizontal overflow; restart resets the run.
- Extracted Windows ZIP served successfully on a separate port. Packaged asset hashes match the production build.

These are simulation and desktop-browser checks. Physical phone touch feel, hotel hotspot discovery, firewall prompts, first-time Node installation and actual network connectivity are not yet verified on Tyler's devices.

## Playtest 2 verification

- 20 automated tests pass, including new shape silhouettes, downward gesture locking, retirement of whole pieces, protected current hops/bridges, soft-limit behavior, unlimited mode, illegal-drop non-mutation, forgiving corner contact and local-report persistence/quota handling.
- TypeScript and production build pass.
- Portrait 390×844 browser: downward swipe rerolls with clear feedback; connected drag starts the run; Runs records the action count; a completed 47.2-second / 5-point run survives reload with 104 hops and one escaped near miss.
- Exported report contents are available in the copyable fallback, including settings, placements, hop trail, collection, near-miss and capture events. The in-app browser did not signal a completed file download; native phone download/save behavior still needs a device check. Use the copy fallback if necessary.
- Tune exposes square limit and hit radius. Browser console showed no errors or warnings during these checks.

## Five-minute phone pass

1. Unzip into a fresh folder and run START_PHONE_TEST_HOTEL.bat. Join the PC hotspot and use its printed phone URL.
2. Before building: rotate all three slots. Swipe one downward: it should refuse (red flash, "Discards unlock after your first placement"). The clock should remain at 3:00.
3. Drag onto the start square to force overlap. Check red feedback and return to the same slot/orientation.
4. Place a connected piece. Check that only its slot refills and the run starts.
5. Build toward a gold node. Placement alone should not score; the jerboa landing there should.
6. Build a branch behind him. Say which turn the color predicts, then watch him return.
7. Tap him mid-hop. He should finish that hop and reverse once, with normal exploration afterward.
8. Place a piece across the Ring while still within board bounds. It should be legal; travelling outside is fatal.
9. Let the Ring catch him. The end screen should replace the board: a cheer, the score counting up, and the leaderboard (or your best runs on this device) with your row in gold. If you're far down the list, your row should sit about a third of the way down, and the list should scroll up to #1. Play again should ignore a tap for a moment, then start a fresh run.
10. Build beyond 25 squares. Old eligible pieces should flash amber and disappear; no removal may strand the jerboa, break his current hop or disconnect surviving runway. The count can exceed 25 with PROTECTED displayed.
11. Try the Step, W and straight Line3 shapes. Swipe downward to reroll; pulling an already-dragged piece back down should return it, not discard it.
12. After a run, open Runs and export the report. Check it remains after refreshing. Share the JSON or copyable report when discussing the run.
13. Try Tune: one-minute run, larger cells (15×15), slower hops. Use the same seed to compare settings.

## Playtest 7 pass

1. Fresh browser (or clear site data): before placing, a callout above him says to tap him once he's moving. After the first placement a cyan ring pulses around him for a few seconds.
2. Build a long road toward the Ring. A few hops before he'd cross it, a red ring and "TAP HIM TO TURN BACK!" appear. Tap him; he turns back.
3. After reversing in two runs, the tips stop appearing.
4. Find a 10 (larger gold disk, bright rim). It wobbles, then hops to a neighbouring cell about every 2 s, never more than one cell from where it appeared. Build to it: once he is hopping onto it, it stays put and pays 10 (20 with x2).
5. Collect x2, then freeze (or freeze, then x2): the phase line reads DOUBLE BONUS, the x2 bar shows ❄ and stops, and moving 10s stand still until the thaw.
6. "‹ Gametronyx" in the top bar and "More games" on the end screen open gametronyx.com in the same tab. Without a session, "gametronyx.com" in the end-screen note is a link. On a 320-px-wide phone the top bar fits.

## Rounds trial pass

1. Tune → Mode → Rounds (or open `?mode=rounds`). The top line reads `ROUND 1/4 · 0/20`; Ring length, hop and node settings are greyed out.
2. Score 20: the round clears at once. The Ring blooms back to full and holds for a moment, "ROUND 2 · GOAL 40" shows, fresh nodes appear, and the road stays. His hops get a little quicker.
3. Freeze appears from round 2. In Midnight (the last round) there is no goal; the run ends when the Ring catches him. The end screen says which round you reached, and that Rounds isn't on the leaderboard.
4. Open the designer (Tune → Design rounds…, or `designer.html`). Change a goal, a Ring length and the point values; watch the chart. Play: the game starts your set. Copy share link on the PC, open it on the phone.
5. Say whether the goals feel reachable, whether clearing a round is exciting, and whether each round should be shorter or longer.

## Record observations

- Device/browser, portrait dimensions, seed and Tune values.
- Did you correctly predict the next junction choice?
- Did building behind him and waiting for the return feel satisfying?
- Did you intentionally reverse to escape, or mostly react to surprises?
- How often did you swipe looking for a Dot? Were large shapes useful?
- Were failures caused by decisions, illegible routes, or gesture errors?
- Did random points on existing road encourage enjoyable revisiting or passive farming?

Keep rule changes separate from tuning changes. Record new agent assumptions in DECISIONS.md.

## Launcher repair validation

22 tests pass, including address filtering/hotspot prioritization and a real occupied-port retry. The current PC hotspot is detected by the Node helper. The rebuilt ZIP includes the helper and updated launchers. Local hotspot-interface HTTP probing timed out during this session, so detection is verified but phone reachability remains a device check. Existing Node firewall allowances were inspected, not modified.
