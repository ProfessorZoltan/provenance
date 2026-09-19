# Provenance

A browser RPG about who owns the future. It began as the **vertical slice** from the design doc's
Build brief and now runs three of the five Deep Sites, Kell, Port Halden and the Basin, across all
four eras: 2031, 2064, 2148 and 2312. Six party members, the Threads / Tempo / Entropy battle
system, fifteen timeline choices whose order of play decides what survives, ripple sites, shops,
equipment, recruitment, quests and save/load.

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

New players should start with the [player manual](docs/PLAYER_MANUAL.md): lore, controls, the
Threads and Tempo systems, each character's starting abilities, and what Shield, Signal and Sync do.
The same document is readable in-game from the title menu, any location's action list, or Settings.
The screen renders that Markdown file directly, so the two can never drift apart.

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
| End turn (battle) | RT | C |
| Save / load menu | Start | M |
| Settings | Select | Tab |
| Scroll battle log | Right stick | PgUp / PgDn |
| Dismiss a battle report | A | Enter |
| Rewind (also in the action list) | LT | Z |

Battles narrate themselves. Every hit, heal, miss, Tempo spend and Entropy spike appears in a box
in the middle of the field, naming who did what to whom with which ability, and nothing else moves
until you dismiss it. Long enemy turns are paged three lines at a time. The side log keeps the
full history.

Keyboard-only play works everywhere. Mouse clicks work on menus, dialogue, enemy targets and the
battle report box.

Travel is physical. Each era has one map holding all three Deep Sites, Kell in the north-west,
Port Halden on the coast and the Basin inland to the east, joined by road. The map is larger than
the screen, so the view follows the party and a minimap in the corner keeps the overview: the
party walks it with the stick or WASD,
locations are nodes you step into and enter with A, and the dashed regions are wilds where
random encounters roll as you walk (a Scan card still lets you skip them). The village gate
appears as a node once Old Pell's quest is active; any node whose conditions are unmet is not on
the map and cannot be travelled to. Time travel stays inside a Deep Site, and both sites reach all
four eras.

Reduced motion (Settings, or the OS preference) freezes the parallax camera, halves particles
and removes animation.

## What is built

| Piece | Where |
| --- | --- |
| Deep Sites: Kell, Port Halden and the Basin, each across 2031, 2064, 2148 and 2312 | `content/locations/` |
| Waypoints: sixteen, including Kell Village, the Undercity Bazaar, the Basin Work Camp, Ash Camp and the Fens | `content/locations/`, `content/shops/` |
| Party: the Auditor, Wren, Dax, ILO-9, Mara Vesely and Tomas Hale, the last three by recruitment. Four active, the rest benched at half XP | `content/characters/` |
| Tech trees: 14 or more nodes each, one condition node, one contradiction pair and per-era nodes | `content/nodes/` |
| Enemies: twenty-six across four families and four centuries, including Constructs with two health bars and racks that Kinetic cannot touch | `content/enemies/` |
| Encounters: thirty-five, with Scan card, Skip and scripted surprise attacks | `content/encounters/` |
| Battle: Threads, Slack, Tempo with Rewind and Fork, Entropy with one Echo spawn per fight, Parley, Terms, Settlement and Held Shot | `src/core/battle/battle.ts` |
| Backgrounds: one per location, four parallax layers each, one ambient animation, canvas particles | `src/art/pixel-backgrounds.ts` |
| Music: four battle pieces and four hub pieces, Tempo-linked layers, Entropy detune | `content/scores/`, `src/audio/engine.ts` |
| Timeline: fifteen choices across four eras and six sites. A later edit at an earlier era erases everything downstream of it at that site | `content/timelineChoices/`, `src/core/timeline.ts` |
| Ripple sites: eight places whose state is decided in another century or by party Sync, including the Tolliver chain from 2031 to 2148 and the Basin crew list from 2031 to 2312 | `content/locations/`, `content/quests/` |
| Equipment: two slots per character, era-specific gear, owner-locked pieces, Ownership-gated stock | `content/items/`, `src/ui/screens/roster.ts` |
| Save: localStorage slot, JSON export and import, last three timeline snapshots | `src/core/save.ts` |
| Era maps: three regions on one 2600x1100 map per era, with a camera that follows the party, a minimap, roads and encounter zones | `content/maps/`, `src/ui/screens/map.ts` |
| Player manual: in-game screen rendered from the shipped Markdown | `docs/PLAYER_MANUAL.md`, `src/ui/manual.ts` |

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
| Base stats | Auditor 120/3/40/45/30/35, Wren 95/3/50/55/25/20, Dax 160/3/60/10/20/60, Mara 105/3/38/60/40/25, Hale 110/3/30/55/70/30 (Resolve, Bandwidth, Latency, Signal, Noise, Grit). |
| Tempo | +2 per thread spent by the party, cap 40. Rewind costs 3 and +20 Entropy; Fork costs 2 Tempo, 1 thread and +10 Entropy. Rewinds per battle = Anchor characters (Wren) plus Chronal Anchor nodes. |
| Echo spawn | At Entropy ≥ 70, once per fight, a copy of a random living party member at 60% Resolve, immune to everything but Chronal. |
| Overload / Parley | Party average Sync ≤ -40 gives +25% Kinetic vs machines and disables Signal abilities; ≥ +40 adds a Parley action against machines. |
| Items | Thirty-nine: consumables, two-slot equipment per era, and Relics that any century's shop buys at a premium. |
| Party swap | Four active at a time; anyone benched still earns XP at half rate. |
| Defeat | The party wakes at the Deep Site at a quarter Resolve. Nothing else is lost. |
| Autosave | After a battle result, a timeline choice, a quest turn-in and a time jump. Manual save, export and import are in the Save menu. |
| Difficulty | No options yet; enemies do not scale. |

## Verified

- `npm test`: 107 tests covering battle determinism, damage type rules, Rewind, Fork, Echo spawn,
  surprise attacks, Mara's Terms and Settlement, Hale's Held Shot and Killing Silence, node
  unlocking, timeline propagation across six independent sites, ripple-site state, Ownership-gated
  shop stock, map travel and node gating, save round trip, five full end-to-end runs including the
  Handover, the Tolliver chain and the Basin crew list, battle narration paging, art-library
  resolution, and a 300-battle random-action fuzz that must never hang or throw.
- `npm run build` typechecks and produces a static build; it was driven end to end in headless
  Chromium with no console errors. Safari has not been tested from this environment.

## Pixel-art library

The full design-guide art inventory is in [docs/ART_GUIDE.md](docs/ART_GUIDE.md). Browse the searchable catalog at `/art/` while running the game, or open `public/art/index.html` directly.

- `npm run art:build` regenerates the original SVGs, manifests, catalog and Markdown cross-reference from `scripts/art-*.mjs`.
- `npm run art:check` validates coverage, file references, pose bounds and distinct states.
- `public/art/catalog.json` is the complete inventory. `src/art/library.ts` provides runtime lookup.

The artwork covers future game content; it does not implement the unreleased locations, recruitment, quests or endings. See the guide for proposed visual interpretations and integration examples.
