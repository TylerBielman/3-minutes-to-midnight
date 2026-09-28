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

## Gametronyx (launcher, feedback and leaderboard)

Players launched from **gametronyx.com** arrive signed in: the site passes a one-time code in the URL fragment, which the game trades for a session token. After every 3rd completed run (the Ring caught the jerboa), a short "How was it?" popup asks for feedback. It is posted as a GitHub issue in this repo under the player's Gametronyx username. Skip closes it. Opening the game directly (no Gametronyx session) never shows the popup. See `src/gtx.ts` and `docs/DECISIONS.md` (Gametronyx integration).

When the Ring catches him, an end screen celebrates the run: the score counts up, a cheer matches the news (new personal best, top of the board, so close…), and the leaderboard shows where you stand: your row is highlighted and scrolled into the top third of the list, between the players just ahead and just behind. **Play again** starts a fresh run. Runs played with a Gametronyx session and default settings are posted under your username to the Gametronyx leaderboard server (`scores.gametronyx.com`; code in the gametronyx repo, `server/`). Without a session, or when the leaderboard can't be reached, the board shows your best runs on this device. Tuned runs are celebrated but not ranked. See `src/finale.ts`, `src/leaderboard.ts` and `docs/DECISIONS.md` (Leaderboard end screen).

## Controls

- Two draft slots by default (1–3 in Tune). Tap a draft piece to rotate 90 degrees.
- Drag up to connect it. Orientation is locked while held.
- Invalid release returns it to the same slot.
- Swipe down from the draft row to discard/reroll (unlocks after your first placement).
- Tap the jerboa to reverse after his current hop. Until you've done this in two runs, a tip says so at the start, and a flash warns you when his route is about to cross the Ring.
- Violet x2 node: he hops faster (1.4×) and points count double for 7 seconds.
- Blue ❄ freeze node: time stops for 6 seconds. The Ring, the countdown, the x2 timer and moving 10s all wait; the Ring glows blue and blinks just before it thaws. Freeze during x2 is a DOUBLE BONUS.
- A rare 10 (bigger gold disk with a bright rim) hops between the cells around where it appeared, about every 2 seconds. It never slips away from the cell he is hopping to.
- Powerup speed and durations are adjustable in Tune.
- Phases last 60 s, 80 s and 40 s, and the Ring closes fastest in the last one. Late in the run old road clears faster, and pieces longer than the Ring is wide are swapped out.
- The Ring's pulse quickens at every phase change. Point values rise toward 5 as phases advance.
- Cyan road and arrows show his plan. Gold numbers are points.
- New run restarts; Tune changes duration, board size, hop speed, node count, seed, runway limit, Ring hit radius and debug grid.

The jerboa ignores the Ring. Roads survive it. Every run ends when it catches him; collect as many points as possible first.

**‹ Gametronyx** in the top bar and **More games** on the end screen go back to gametronyx.com.

**Rounds (trial, not ranked).** Tune → Mode → Rounds, or open `?mode=rounds`. Each round has a points goal (20, 40, 60…): score it and the round clears at once, the Ring starts full again and the next round is faster. The last round, Midnight, has no goal. Design your own rounds at `designer.html` (Tune → Design rounds…): goals, Ring length, hop speed, nodes, point values and powerups, with a chart of the Ring across the run. **Play** runs your set; share links and JSON move it between devices.

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

Old polygon docking documents are archived. No hammer or smart spawning in P1. Powerups are x2 and freeze; Rounds and more powerups are planned as an unranked trial (docs/DECISIONS.md, Playtest 7).

### If the launcher does not show a phone address

Use the refreshed package. Both launchers now use Node to inspect network addresses; they no longer rely on the Windows PowerShell networking commands. The server prints the PC HOTSPOT address first, followed by other network addresses, after successfully binding a free port. Use the exact printed port. If no address is available, it explains how to retry. Address detection alone does not establish phone connectivity.
