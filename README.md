# 3 Minutes to Midnight — Jerboa Prototype 1

Build runway for a curious jerboa, collect points, and tap him to reverse before the closing Ring catches him. The first placement starts the run.

## Play on Windows / phone

Unzip the **3MTM_JERBOA_P1.zip** package into a fresh folder. Double-click **START_PHONE_TEST_HOTEL.bat** for the established PC Mobile Hotspot workflow, or **START_PHONE_TEST.bat** on an ordinary home network. The package includes a built game: with Node installed, no npm installation is needed. If Node is absent, the existing launcher offers the standard Node LTS setup.

Connect the phone to the PC hotspot, then open the address printed in the launcher. Keep the launcher window open. A local PC preview opens after the server is ready. Actual hotspot/firewall connectivity depends on the devices; this package does not change security settings.

## Controls

- Tap a draft piece to rotate 90 degrees.
- Drag up to connect it. Orientation is locked while held.
- Invalid release returns it to the same slot.
- Swipe sideways within the draft row to discard/reroll.
- Tap the jerboa to reverse after his current hop.
- Cyan road and arrows show his plan. Gold numbers are points.
- New run restarts; Tune changes duration, board size, hop speed, node count, seed and debug grid.

The jerboa ignores the Ring. Roads survive it. Every run ends when it catches him; collect as many points as possible first.

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
