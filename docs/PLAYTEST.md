# Prototype 1 — Validation and phone playtest

## Verified in this task

- TypeScript production build passes.
- Twelve automated tests pass: authored shape connectivity/rotation; hard overlap/connection/bounds validation; draft preservation and first-placement clock start; global unvisited reachability; unique loop counts and stable ties; forecast/actual travel; dead-end reversal/patrol; queued tap reversal; mid-hop replanning; one-time landing collection and runway-eligible replenishment; all Ring phases and road persistence; death during delayed frames; deterministic weighted draft distribution.
- Portrait browser at 390×844: tap rotation preserves Ready/time, first connected drag starts Phase 1, an overlapping drop returns the same piece to its slot with red feedback, horizontal swipe rerolls, tapping the moving jerboa acknowledges reversal, Tune opens and Apply restarts with the chosen seed, connected T + Cross construction produces a visible branching route.
- The connected T + Cross browser run collected four nodes for 18 points and ended on Ring contact at 41.3 seconds of a one-minute run. No browser errors or warnings were recorded.
- Compact 320×568 browser layout also fits without horizontal overflow; restart resets the run.
- Extracted Windows ZIP served successfully on a separate port. Packaged asset hashes match the production build.

These are simulation and desktop-browser checks. Physical phone touch feel, hotel hotspot discovery, firewall prompts, first-time Node installation and actual network connectivity are not yet verified on Tyler's devices.

## Five-minute phone pass

1. Unzip into a fresh folder and run START_PHONE_TEST_HOTEL.bat. Join the PC hotspot and use its printed phone URL.
2. Before building: rotate all three slots. Swipe one sideways. The clock should remain at 3:00.
3. Drag onto the start square to force overlap. Check red feedback and return to the same slot/orientation.
4. Place a connected piece. Check that only its slot refills and the run starts.
5. Build toward a gold node. Placement alone should not score; the jerboa landing there should.
6. Build a branch behind him. Say which turn the color predicts, then watch him return.
7. Tap him mid-hop. He should finish that hop and reverse once, with normal exploration afterward.
8. Place a piece across the Ring while still within board bounds. It should be legal; travelling outside is fatal.
9. Let the Ring catch him. Roads should remain; final score should freeze. Start another run.
10. Try Tune: one-minute run, larger cells (15×15), slower hops. Use the same seed to compare settings.

## Record observations

- Device/browser, portrait dimensions, seed and Tune values.
- Did you correctly predict the next junction choice?
- Did building behind him and waiting for the return feel satisfying?
- Did you intentionally reverse to escape, or mostly react to surprises?
- How often did you swipe looking for a Dot? Were large shapes useful?
- Were failures caused by decisions, illegible routes, or gesture errors?
- Did random points on existing road encourage enjoyable revisiting or passive farming?

Keep rule changes separate from tuning changes. Record new agent assumptions in DECISIONS.md.
