# Difficulty

How hard the game is for different kinds of player, which abilities made fights too easy and what
changed, and what a difficulty setting could turn. Every number here comes from the simulator, which
plays fights through the real reducer, so a policy can do anything a player can and nothing else.

Run it with `npm run sim`. It is not part of `npm test`: the playstyle run takes about a minute and
the ability run several. `ONLY=novice,expert npm run sim` narrows the styles.

| Piece | Source |
| --- | --- |
| Player styles and the board evaluation they share | `tests/sim/playstyles.ts` |
| One fight, a whole era, the Stack | `tests/sim/campaign.ts` |
| Every style through every era and the Stack | `tests/sim/playstyles.sim.ts` |
| Each ability spammed against the same fights without it | `tests/sim/abilities.sim.ts` |

## The player styles

| Style | Plays like | Source |
| --- | --- | --- |
| Novice | Any usable action on any legal target, and ends the turn early one time in eight | `novice` in `playstyles.ts` |
| Basher | Biggest attack on the first target; heals only below a quarter Resolve; no items, no Tempo | `basher` |
| Turtle | Heals anyone under 70%, keeps buffs up, then attacks like the Basher | `turtle` |
| Competent | The test suite's scripted player: reads the type chart, heals at 45%, uses Chronal on Echoes | `autoBattle` in `tests/helpers.ts` |
| Tactician | One action of lookahead over every ability, target, item and Relay; values safety highly | `tactician` |
| Expert | Plays the Competent script, but takes any lookahead move that is clearly better | `expert` |

Each era is played at the level the story reaches it (2312 at 4, 2148 at 8, 2064 at 12, 2031 at 16)
with the party the story has by then. Every ordinary and hard fight in the era is fought in turn, with
Resolve, Nerve and Entropy carried between them. The party camps when anyone is under half Resolve
or under 30% Nerve, pays for a bed once the two camps are gone, and a loss sends it back to the Deep
Site the way the game does. Two seeds each.

## Results by era

Wins out of fights played, and the average rounds a won or lost fight lasted. These are the numbers
that led to the changes below, measured before later eras got more Resolve and beds got dearer.

| Style | 2312 ordinary | 2312 hard | 2148 ordinary | 2148 hard | 2064 ordinary | 2064 hard | 2031 ordinary | 2031 hard | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Novice | 14/14 · 5.6 | 4/4 · 7.0 | 10/10 · 4.5 | 22/30 · 11.1 | 22/22 · 4.0 | 8/8 · 7.5 | 18/18 · 2.5 | 14/14 · 8.2 | `playstyles.sim.ts` |
| Basher | 14/14 · 3.1 | 4/4 · 4.2 | 10/10 · 2.8 | 14/30 · 10.0 | 22/22 · 2.5 | 8/8 · 3.2 | 18/18 · 1.5 | 14/14 · 4.7 | `playstyles.sim.ts` |
| Turtle | 14/14 · 5.4 | 4/4 · 7.2 | 10/10 · 5.6 | 14/30 · 12.5 | 22/22 · 4.9 | 8/8 · 8.8 | 18/18 · 2.3 | 14/14 · 9.0 | `playstyles.sim.ts` |
| Competent | 14/14 · 3.1 | 4/4 · 4.2 | 10/10 · 2.8 | 30/30 · 4.2 | 22/22 · 2.6 | 8/8 · 4.4 | 18/18 · 1.2 | 14/14 · 4.9 | `playstyles.sim.ts` |
| Tactician | 14/14 · 2.6 | 4/4 · 4.0 | 7/10 · 11.5 | 25/30 · 8.0 | 22/22 · 5.5 | 8/8 · 3.8 | 18/18 · 5.2 | 13/14 · 8.7 | `playstyles.sim.ts` |
| Expert | 14/14 · 2.9 | 4/4 · 4.0 | 10/10 · 3.3 | 29/30 · 4.7 | 22/22 · 3.0 | 8/8 · 4.0 | 18/18 · 2.2 | 14/14 · 5.8 | `playstyles.sim.ts` |

Beds bought per era, both seeds added together.

| Style | 2312 | 2148 | 2064 | 2031 | Source |
| --- | --- | --- | --- | --- | --- |
| Novice | 14 | 35 | 19 | 17 | `playstyles.sim.ts` |
| Turtle | 14 | 36 | 21 | 16 | `playstyles.sim.ts` |
| Competent | 6 | 19 | 5 | 2 | `playstyles.sim.ts` |
| Expert | 5 | 23 | 10 | 6 | `playstyles.sim.ts` |

The Stack (four floors, then the Perpetual), with the full roster, two camps and no beds.

| Style | Level 14 | Level 20 | Source |
| --- | --- | --- | --- |
| Novice | 2/3 and 0/1 floors | 2/3 and 1/2 | `playstyles.sim.ts` |
| Basher | 1/2 and 2/3 | 3/4 and 5/5 | `playstyles.sim.ts` |
| Turtle | 4/5 and 4/5 | 4/5 and 5/5 | `playstyles.sim.ts` |
| Competent | 2/3 and 2/3 | 2/3 and 4/5 | `playstyles.sim.ts` |
| Expert | 2/3 and 3/4 | 4/5 and 5/5 | `playstyles.sim.ts` |

### What that says

1. **2148 is the hardest part of the game, and it is a knowledge check.** Every loss by the Novice,
   Basher and Turtle in 2148 is a hard fight with Echoes in it (racks, ridge, archive, columns, fens
   ambush, graveyard, tideline, chapel). Echoes take only Chronal. A player who reads the type chart
   wins them all; one who does not loses half. That is by design, but it lands at level 8 with a
   party of four, earlier than anything else asks as much.
2. **The curve falls after 2148.** A Competent player's ordinary fights take 3.1 rounds in 2312, 2.8
   in 2148, 2.6 in 2064 and 1.2 in 2031. By 2031 an ordinary fight is over before the enemy acts
   twice. Hard fights hold steady at 4 to 5 rounds throughout. Since fixed: see **Later eras** below.
3. **Beds are too cheap to matter.** A bed costs three per level, and every style could always
   afford one. The Novice and Turtle bought 35 in 2148 alone and never ran out of money. Camps,
   limited to two an era, are the only recovery that asks for a decision. Beds now cost twice as
   much; see **Beds** below.
4. **The Stack is the real test, and it is fair.** No style clears it every time; turtling is the
   most reliable way through, and no fight in it falls in one round any more.
5. **Playing safe is slow but not punished.** The Turtle takes twice as many rounds as the Basher and
   ends with the same wins. Entropy, which should make long fights cost something, never passed 37
   for the Turtle in any era, because it camps and rests so often.

## Abilities that made fights too easy

Each party ability was used at every chance, on whichever target did the most for the board, in every
hard and key fight (70 runs), and compared with the same fights played without it. The ratio is the
rounds a fight took with the ability against without it: under 1 is faster. "Fast" counts hard or key
fights won in two rounds or fewer.

| Ability | Owner | Before: ratio | Before: fast | After: ratio | After: fast | Source |
| --- | --- | --- | --- | --- | --- | --- |
| Buyout | Strand | 0.46 | 26 | 0.94 | 2 | `abilities.sim.ts` |
| Open Weights | Quiroga | 0.59 | 16 | 1.21 | 0 | `abilities.sim.ts` |
| Killing Silence | Hale | 0.65 | 13 | 0.89 | 6 | `abilities.sim.ts` |
| Ghost Protocol | ILO-9 | 0.65 | 9 | 0.82 | 5 | `abilities.sim.ts` |
| Blueprint | Quiroga | 0.70 | 1 | 0.86 | 1 | `abilities.sim.ts` |
| Instance | ILO-9 | 0.77 | 5 | 0.85 | 1 | `abilities.sim.ts` |
| Discrepancy | Auditor | 0.64 | 0 | 0.64 | 0 | `abilities.sim.ts` |

Before the change, the Tactician and Expert won the second Stack floor and the Perpetual in a single
round, with Parley or Ghost Protocol, Open Weights and Settlement.

### What changed

| Ability or rule | Was | Now | Source |
| --- | --- | --- | --- |
| Bosses | Could be talked down, bought, turned or settled like anyone | Marked `boss`, along with any key-fight enemy that has a second bar. Parley, Buyout, Open Weights and Settlement do not take them | `content/enemies/*.json`, `createBattle` in `battle.ts` |
| Buyout | Bought any enemy for good | Only an enemy at half Resolve or less, never a boss, and it walks off after 2 rounds | `rules.control.buyoutBelow`, `buyoutRounds` |
| Open Weights | Turned every machine on the field for good | Turns them for 2 rounds, never the strongest when they are all machines, and they turn back when nobody else is left | `rules.control.openWeightsRounds` |
| Settlement | Ended every bound enemy outright | Settles bound enemies already at half Resolve; a bound boss loses a fifth of its Resolve instead | `rules.control.settleBelow`, `settleBossDamage` |
| Killing Silence | Skipped the global damage scale, so hit twice as hard as written | Scaled like every other hit | `battle.ts` |
| Litany, Held Shot | Stacked without limit | Three stacks at most; a fourth refreshes the oldest | `rules.control.stackCap` |
| Blueprint, Instance | Each cast added another copy | One summoned copy per caster at a time | `rules.control.copiesPerCaster` |

Discrepancy was left alone on purpose. It is the Auditor's only Chronal attack and the only answer to
Echoes: without it the same fights are won 54 times in 70, with it 69. Its speed-up is what an answer
to a hard counter should look like, and it never wins a fight in two rounds.

## Later eras and beds

Enemies in 2064 and 2031 now carry more Resolve on every setting (`rules.eraScale`), and a bed costs
6 per level instead of 3 (`rules.rest.perLevel`). Two encounters that were already long for their
tier were trimmed with their own `scale` so they stay inside the bands `tests/balance.test.ts`
promises.

| Era and tier | Resolve now | Competent rounds before | Competent rounds after | Source |
| --- | --- | --- | --- | --- |
| 2312 ordinary | ×1 | 3.1 | 3.1 | `DIFF=standard npm run sim` |
| 2148 ordinary | ×1 | 2.8 | 2.8 | `DIFF=standard npm run sim` |
| 2064 ordinary | ×1.6 | 2.6 | 3.1 | `DIFF=standard npm run sim` |
| 2031 ordinary | ×2.2 | 1.2 | 2.5 | `DIFF=standard npm run sim` |
| 2064 hard | ×1.2 | 4.4 | 4.8 | `DIFF=standard npm run sim` |
| 2031 hard | ×1.3 | 4.9 | 6.4 | `DIFF=standard npm run sim` |
| Hot Aisle, 2064 | encounter scale 0.8 | 5 | 4 or fewer | `tests/balance.test.ts` |
| The Wrong Shipment, 2031 | encounter scale 5.0 to 4.5 | 9 | 8 or fewer | `tests/balance.test.ts` |

Ordinary fights now take about three rounds in every era, and hard fights grow a little longer as the
game goes on instead of shorter.

On beds: a fight pays about 120 of the era's money in 2312, 2148 and 2064 and about 60 in 2031, and
that pay does not rise with level. At 6 per level a bed is a sixth of a fight's pay in 2312 and a
fight and a half's in 2031. The simulated players still never ran out, because they spend nothing
else; a real player choosing between a bed and a shop's gear will feel it.

## Difficulty settings

Built. New Game asks for one under the stance cards, Settings changes it outside a fight, and the save
remembers it. A save from before this has no setting and plays Standard.

| Piece | Source |
| --- | --- |
| The presets and their numbers | `rules.difficulty` in `content/rules.json` |
| Filling in each lever from the preset or the base rule | `src/core/difficulty.ts` |
| Enemy Resolve, enemy hits, Rewinds, targeting, Echo grace | `createBattle` and `resolveDamage` in `src/core/battle/battle.ts` |
| Bed price and camps | `restCost`, `CAMP`, `TIME_JUMP`, `SET_DIFFICULTY` in `src/core/reducer.ts` |
| Choosing it | `newGameScreen` and `settingsScreen` in `src/ui/screens/menus.ts` |
| Tests | `tests/difficulty.test.ts`, and the manual's table in `tests/manual.test.ts` |

Standard is an empty preset. Every lever it leaves out is the base rule, so Standard and the base
rules cannot drift apart.

### The presets

| Setting | Enemy hits | Enemy Resolve | Bed, per level | Camps an era | Rewinds a fight | Go for the weakest | Echoes | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Story | ×0.75 | ×0.85 | 3 | 3 | 2 | None | Ordinary hits land at 35% | `rules.difficulty.presets.story` |
| Standard | ×1 | ×1 | 6 | 2 | 1 | None | Chronal only | `rules.difficulty.presets.standard` |
| Hard | ×1.15 | ×1.1 | 8 | 1 | 1 | Half of every side | Chronal only | `rules.difficulty.presets.hard` |
| Audit | ×1.35 | ×1.25 | 10 | 1 | 0 | All of them | Chronal only | `rules.difficulty.presets.audit` |

Anchors and training still add Rewinds on every setting. "Go for the weakest" overrides an enemy's
own personality, spread evenly: on Hard the second and fourth of a group, on Audit all of them.

### How each setting plays

Era fights won, both seeds and all four eras together; 2148's hard fights on their own, since they
are the hardest stretch; and the Stack at level 20, one result per seed.

| Setting | Style | Era fights won | 2148 hard fights won | Stack floors at level 20 | Source |
| --- | --- | --- | --- | --- | --- |
| Story | Novice | 120/120 | 30/30 | 2/3 and 4/5 | `DIFF=story npm run sim` |
| Story | Turtle | 114/120 | 24/30 | 5/5 and 5/5 | `DIFF=story npm run sim` |
| Story | Competent | 120/120 | 30/30 | 4/5 and 5/5 | `DIFF=story npm run sim` |
| Standard | Novice | 112/120 | 22/30 | 2/3 and 1/2 | `DIFF=standard npm run sim` |
| Standard | Turtle | 104/120 | 14/30 | 4/5 and 5/5 | `DIFF=standard npm run sim` |
| Standard | Competent | 120/120 | 30/30 | 2/3 and 4/5 | `DIFF=standard npm run sim` |
| Standard | Expert | 117/120 | 29/30 | 4/5 and 5/5 | `DIFF=standard npm run sim` |
| Hard | Novice | 99/120 | 14/30 | 2/3 and 2/3 | `DIFF=hard npm run sim` |
| Hard | Competent | 120/120 | 30/30 | 2/3 and 3/4 | `DIFF=hard npm run sim` |
| Hard | Expert | 118/120 | 29/30 | 2/3 and 3/4 | `DIFF=hard npm run sim` |
| Audit | Novice | 72/120 | 1/30 | 0/1 and 1/2 | `DIFF=audit npm run sim` |
| Audit | Competent | 112/120 | 24/30 | 2/3 and 1/2 | `DIFF=audit npm run sim` |
| Audit | Expert | 114/120 | 27/30 | 3/4 and 3/4 | `DIFF=audit npm run sim` |

What that says:

1. **Story does its job.** A Novice wins every era fight, 2148 included. Styles that never use
   Chronal still lose a few Echo fights, slower rather than stuck.
2. **Hard is fair in the eras and steep in the Stack.** A player who reads the chart still wins every
   era fight. No simulated style cleared the Stack on Hard, though they are scripted and never use
   Collapse or plan a floor ahead, and nothing in the Stack resets when a party comes back.
3. **Audit separates players.** Novices lose most of 2148, a Competent player loses a fifth of it,
   and only the Expert gets close to the Stack's bottom.

If the Stack on Hard proves too steep in play, the next lever would let a preset leave key fights at
Standard's Resolve while keeping everything else, so the eras stay hard and the Stack does not
compound it.
