# Provenance

A browser RPG about who owns the future. This repository holds the **vertical slice** from the
design doc's Build brief: Kell Monastery in 2312 and 2148, Kell Village, three party members,
five encounters, the Threads / Tempo / Entropy battle system, one timeline choice that changes
the village on return, and save/load.

Everything is code-drawn and data-driven: art is SVG and canvas, music is generated live by
Tone.js from JSON scores, and all content lives in `content/` as JSON.

## Run it

```bash
npm install --legacy-peer-deps
npm run dev        # Vite dev server
npm run build      # typecheck + static build into dist/ (runs from file:// or any static host)
npm run preview    # serve dist/
npm test           # Vitest reducer suite
```

The build uses relative asset paths, so `dist/` needs no server. Fonts load from Google Fonts
when online and fall back to system fonts offline.

## Controls

Every on-screen prompt shows the button for the device you used last. Press any button on a
standard-mapping controller to switch to gamepad glyphs.

| Action | Controller | Keyboard |
| --- | --- | --- |
| Walk the map / choose | Left stick or D-pad | WASD or arrows |
| Confirm | A | Enter or Space |
| Back / Leave a location / Skip encounter | B | Esc or Backspace |
| Fork (battle), Party (hub) | X | X |
| Inspect enemy (battle), Tech trees (hub) | Y | Y |
| Previous / next target, tab, character | LB / RB | Q / E |
| Rewind (battle) | LT | Z |
| End turn (battle) | RT | C |
| Save / load menu | Start | M |
| Settings | Select | Tab |
| Scroll battle log | Right stick | PgUp / PgDn |
| Dismiss a battle report | A | Enter |

Battles narrate themselves. Every hit, heal, miss, Tempo spend and Entropy spike appears in a box
in the middle of the field, naming who did what to whom with which ability, and nothing else moves
until you dismiss it. Long enemy turns are paged three lines at a time. The side log keeps the
full history.

Keyboard-only play works everywhere. Mouse clicks work on menus, dialogue, enemy targets and the
battle report box.

Travel is physical. Each era has a valley map: the party walks it with the stick or WASD,
locations are nodes you step into and enter with A, and the dashed regions are wilds where
random encounters roll as you walk (a Scan card still lets you skip them). The village gate
appears as a node once Old Pell's quest is active. Time travel stays inside the Deep Site.
Reduced motion (Settings, or the OS preference) freezes the parallax camera, halves particles
and removes animation.

## What the slice contains

| Piece | Where |
| --- | --- |
| Sites: Kell Monastery 2312 and Kell Stronghold 2148 | `content/locations/` |
| Waypoint: Kell Village 2312, one shop, quest "Snow on the Wire" | `content/locations/`, `content/quests/`, `content/shops/` |
| Party: the Auditor, Sister Wren, Dax Okonkwo | `content/characters/` |
| Tech trees: 12 nodes each, one condition node and one contradiction pair per character | `content/nodes/` |
| Enemies: Sentry Drone, Hunter Drone, Board Warden, Echo of the Chapel | `content/enemies/` |
| Encounters: five, with Scan card, Skip, one scripted surprise attack | `content/encounters/` |
| Battle: Threads, Slack, Tempo with Rewind and Fork, Entropy with one Echo spawn per fight | `src/core/battle/battle.ts` |
| Backgrounds: two, four parallax layers each, one ambient animation, canvas particles | `src/art/backgrounds.ts` |
| Music: two battle pieces, two hub pieces, Tempo-linked layers, Entropy detune | `content/scores/`, `src/audio/engine.ts` |
| Timeline: Arm the resistance / Let it fall, visible in Kell Village on return | `content/timelineChoices/`, `src/core/timeline.ts` |
| Save: localStorage slot, JSON export and import, last three timeline snapshots | `src/core/save.ts` |
| Era maps: nodes, roads and encounter zones per era | `content/maps/`, `src/ui/screens/map.ts` |

## Architecture

- `src/core/` is pure: no DOM, no audio. `reducer.ts` is the single reducer over one immutable
  `GameState`; every mutation is an `Action` (`actions.ts`), and the store keeps an action log.
  `battle/battle.ts` holds the battle math, `timeline.ts` derives world state from the history
  log, `tech.ts` enforces node rules, `encounter.ts` builds Scan cards and rolls surprise.
- `src/core/rng.ts` is a seeded PRNG whose state lives in the store, so a battle is
  deterministic given its seed and can be replayed from the action log.
- `src/content/loader.ts` globs `content/**/*.json`, groups files by folder, and validates
  cross-references at startup. A file may hold one object or an array; each needs an `id`.
- `src/ui/` renders the current screen from state on every change. `input/input.ts` unifies
  keyboard and the Gamepad API into semantic buttons; `input/prompts.ts` draws the glyphs.
  `ui/narration.ts` queues battle log lines into dismissible pages; the queue is presentation
  state, so the log in `GameState` stays the single source of truth.
- Type is per era, set from the era JSON: humanist sans in 2031, condensed grotesk in 2064,
  monospace in 2148, geometric sans in 2312. `applyEra()` swaps the `--font` and `--tracking`
  custom properties, so one layout carries four centuries.
- `src/audio/engine.ts` turns a score JSON into Tone.js layers. BPM is `baseBpm + 1.5 × Tempo`;
  layers unmute at their `minTempo`; Entropy above 70 detunes the mix and adds a reversed echo
  send. 2312 pieces use 19-tone equal temperament, 2148 pieces drift ±6% and bend quarter tones.
  Steps are scheduled by a lookahead loop on Tone's worker clock rather than by automating the
  Transport BPM: the Transport's tick parameter keeps every automation event forever and scans
  them on each lookup, which is what froze long 2148 battles in the first build.

Small DSLs, all documented in their modules:

- Ability formulas: `a.grit * 0.6 + 6` (`src/core/formula.ts`).
- Conditions for scan hints, dialogue lines, shop stock, node unlocks and location variants:
  `flag:x`, `!flag:x`, `visited:2148`, `party:wren`, `signal>=70`, `sync<=-40` (`src/core/conditions.ts`).
- Node effects: stat deltas, ability grants, flags, passives (`content/nodes/*.json`).

## Adding content

Drop a JSON file into the right folder. No code changes are needed for a fourth character
(`content/characters/`, plus its nodes and abilities), a sixth encounter, a new shop variant,
or a new dialogue. The loader rejects unknown references with a message naming the file.

## Decisions taken during the slice

The design doc left these open; the slice picks a value so the loop is playable. All are in
`content/rules.json` or the character files and are easy to retune.

| Question | Decision |
| --- | --- |
| Leveling | 100 XP per level, +1 skill point per level, +5% to Resolve, Grit, Signal and Noise per level. Everyone starts with 2 points. |
| Base stats | Auditor 120/3/40/45/30/35, Wren 95/3/50/55/25/20, Dax 160/3/60/10/20/60 (Resolve, Bandwidth, Latency, Signal, Noise, Grit). |
| Tempo | +2 per thread spent by the party, cap 40. Rewind costs 3 and +20 Entropy; Fork costs 2 Tempo, 1 thread and +10 Entropy. Rewinds per battle = Anchor characters (Wren) plus Chronal Anchor nodes. |
| Echo spawn | At Entropy ≥ 70, once per fight, a copy of a random living party member at 60% Resolve, immune to everything but Chronal. |
| Overload / Parley | Party average Sync ≤ -40 gives +25% Kinetic vs machines and disables Signal abilities; ≥ +40 adds a Parley action against machines. |
| Items | Four consumables plus Relics. Ordinary equipment is out of scope for the slice. |
| Party swap | All three members are always active; benching arrives with the fourth recruit. |
| Defeat | The party wakes at the Deep Site at a quarter Resolve. Nothing else is lost. |
| Autosave | After a battle result, a timeline choice, a quest turn-in and a time jump. Manual save, export and import are in the Save menu. |
| Difficulty | No options yet; enemies do not scale. |

## Verified

- `npm test`: 48 tests covering battle determinism, damage type rules, Rewind, Fork,
  Echo spawn, surprise attacks, node unlocking, timeline propagation, map travel, save round trip,
  a full end-to-end slice run, battle narration paging, art-library resolution, and a 300-battle
  random-action fuzz that must never hang or throw.
- `npm run build` typechecks and produces a static build; it was driven end to end in headless
  Chromium with no console errors. Safari has not been tested from this environment.

## Pixel-art library

The full design-guide art inventory is in [docs/ART_GUIDE.md](docs/ART_GUIDE.md). Browse the searchable catalog at `/art/` while running the game, or open `public/art/index.html` directly.

- `npm run art:build` regenerates the original SVGs, manifests, catalog and Markdown cross-reference from `scripts/art-*.mjs`.
- `npm run art:check` validates coverage, file references, pose bounds and distinct states.
- `public/art/catalog.json` is the complete inventory. `src/art/library.ts` provides runtime lookup.

The artwork covers future game content; it does not implement the unreleased locations, recruitment, quests or endings. See the guide for proposed visual interpretations and integration examples.
