# 3 Minutes to Midnight — Jerboa Prototype 1

Build runway for a curious jerboa, collect points, and tap him to reverse before the closing Ring catches him. The first placement starts the run.

## Play on your phone — browser (easiest)
Every push to GitHub builds the game and publishes it with GitHub Pages:
- `main`: https://tylerbielman.github.io/3-minutes-to-midnight/
- any other branch: `https://tylerbielman.github.io/3-minutes-to-midnight/branch/<branch-name>/` (slashes in the name become dashes)

A deploy takes about 1–2 minutes after the push. The exact URL is printed in the run summary on the repo's **Actions** tab. Bookmark it on the phone and refresh after each push. Run history is stored per browser, so it stays on the phone between visits.

## Play on Windows / phone

Unzip the **3MTM_JERBOA_P1.zip** package into a fresh folder. Double-click **START_PHONE_TEST_HOTEL.bat** for the established PC Mobile Hotspot workflow, or **START_PHONE_TEST.bat** on an ordinary home network. The package includes a built game: with Node installed, no npm installation is needed. If Node is absent, the existing launcher offers the standard Node LTS setup.

Connect the phone to the PC hotspot, then open the address printed in the launcher. Keep the launcher window open. A local PC preview opens after the server is ready. Actual hotspot/firewall connectivity depends on the devices; this package does not change security settings.

## Controls

- Tap a draft piece to rotate 90 degrees.
- Drag up to connect it. Orientation is locked while held.
- Invalid release returns it to the same slot.
- Swipe down from the draft row to discard/reroll (unlocks after your first placement).
- Tap the jerboa to reverse after his current hop.
- Violet x2 node: he hops faster (1.4×) and points count double for 7 seconds.
- Blue ❄ freeze node: the Ring and the countdown stop for 6 seconds; the Ring glows blue and blinks just before it thaws.
- Powerup speed and durations are adjustable in Tune.
- Phases last 60 s, 80 s and 40 s, and the Ring closes fastest in the last one. Late in the run old road clears faster, and pieces longer than the Ring is wide are swapped out.
- The Ring's pulse quickens at every phase change. Point values rise toward 5 as phases advance.
- Cyan road and arrows show his plan. Gold numbers are points.
- New run restarts; Tune changes duration, board size, hop speed, node count, seed, runway limit, Ring hit radius and debug grid.

The jerboa ignores the Ring. Roads survive it. Every run ends when it catches him; collect as many points as possible first.

## Playtest 2 changes

Ring contact is more forgiving (0.10-cell radius; original 0.24 is available in Tune). Above 25 squares, each placement retires the oldest eligible whole pieces while protecting the current hop, the new piece and connected runway. The limit is soft when those protections prevent removal; Tune accepts 0 for unlimited. Removed squares flash amber and become available again.

The palette replaces S/Z with five-square Step and W staircases, and adds Line3, a straight three-square piece. Playtest 5 adds the V5, T5 and Y pentominoes to the large pool (sixteen shapes; deals are 65% common, 15% small, 20% large).

**Runs** shows recent scores, survival time, actions, escaped close calls and removed runway. **Export runs** saves JSON with settings, action timeline and hop trail for review. Files stay on your device until you share them. History is local to this browser and exact address (including port); phone and PC histories are separate. Keep using the same launcher address or export before switching. Up to 50 runs are saved; full storage may retain fewer. Interrupted runs preserve the latest checkpoint, approximately every five seconds. Old unrecorded runs cannot be recovered.

## Development

```sh
npm ci
npm test
npm run dev
npm run build
npm run package
```

The source-checkout launchers build the current source. The distributed zip uses its bundled production build and a small Node static server. Package output: `release/3MTM_JERBOA_P1.zip`.

## Current documents

- [Design](docs/DESIGN_AND_TECHNICAL_SPEC.md)
- [Technical design](docs/TECHNICAL_DESIGN.md)
- [User decisions and agent calls for review](docs/DECISIONS.md)
- [Validation and phone playtest](docs/PLAYTEST.md)

Old polygon docking documents are archived. No hammer, powerups, stage progression or smart spawning in P1.

### If the launcher does not show a phone address

Use the refreshed package. Both launchers now use Node to inspect network addresses; they no longer rely on the Windows PowerShell networking commands. The server prints the PC HOTSPOT address first, followed by other network addresses, after successfully binding a free port. Use the exact printed port. If no address is available, it explains how to retry. Address detection alone does not establish phone connectivity.
