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

Wins out of fights played, and the average rounds a won or lost fight lasted.

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
   twice. Hard fights hold steady at 4 to 5 rounds throughout.
3. **Beds are too cheap to matter.** A bed costs three per level, and every style could always
   afford one. The Novice and Turtle bought 35 in 2148 alone and never ran out of money. Camps,
   limited to two an era, are the only recovery that asks for a decision.
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

## Difficulty settings

Nothing below is implemented. It is the set of levers the rules already expose, what each does to the
simulated players, and four presets built from them.

### Levers

| Lever | Now | Effect | Source |
| --- | --- | --- | --- |
| Enemy damage | 0.5 of written (`damageScale`) | The strongest single lever. It moves every style's losses at once | `content/rules.json` |
| Enemy Resolve by tier | ordinary 1, hard 1.4, key 4 | Longer fights, more Entropy, more chances to go wrong | `rules.tierScale` |
| Enemy Resolve by encounter | `scale`, set on a few encounters | Raising it across 2064 and 2031 fixes the falling curve without touching the early game | `content/encounters/*.json` |
| Bed price | 3 per level | Makes rest a choice instead of a reflex | `rules.rest.perLevel` |
| Camps per era | 2 | The recovery players actually plan around | `rules.camp.perEra` |
| Nerve | 10 plus 1 a level | How many heals and buffs a party has between beds | `rules.nerve` |
| Tempo per enemy hit | 3 | How often Fork, Rewind, Echo and Collapse come round | `rules.tempoOnHit` |
| Entropy per round | 1 | How much long, careful fights cost | `rules.entropyFlow.perRound` |
| Rewinds per fight | 1 | A second chance after a bad enemy turn | `rules.rewind.base` |
| Pressure | enemies hit harder after round 10 | Stops a stalled fight lasting forever | `rules.pressure` |
| Enemy targeting | per-enemy personality | "Opportunist" everywhere makes every foe finish the weakest | `content/enemies/*.json` |
| Intent display | shown with target | Hiding the target removes most of the planning a turn has | `enemyIntent` in `battle.ts` |
| Experience | as tuned | Levels arrive earlier or later against fixed enemies | `rules.xpPerLevel` |

### Presets

| Preset | Enemy damage | Enemy Resolve | Beds | Camps | Nerve | Rewinds | Targeting | Aim | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Story | ×0.75 | ×0.85 | 2 per level | 3 | +4 | 2 | Personalities, never Opportunist | A Novice wins at least 95% of fights, 2148 included; Echo fights also take reduced damage from non-Chronal hits | this simulator |
| Standard | ×1 | 2064 ×1.25, 2031 ×1.5 on ordinary fights | 5 per level | 2 | as now | 1 | Personalities | A Competent player spends 3 to 4 rounds on an ordinary fight in every era; a Novice wins about 85% | this simulator |
| Hard | ×1.2 | ×1.15, plus the Standard era scale | 6 per level | 1 | as now | 1 | Half the field Opportunist | A Competent player wins about 85% of hard fights; an Expert still clears the Stack at level 20 | this simulator |
| Audit | ×1.3 | ×1.25, plus the era scale | none in the Stack, 8 per level elsewhere | 1 | −2 | 0 | Opportunist | Only an Expert clears the Stack; a loss ends the run at the last save | this simulator |

Two notes on building them:

1. Scale enemies when the battle is created, not in the content files, so one setting reaches every
   fight and the save only has to remember the preset. The battle code already multiplies enemy
   Resolve by `tierScale` and the encounter's `scale` in one place; a difficulty multiplier belongs
   beside them.
2. Tune each preset against the simulator's aim, not by feel. Add the preset to `partyAt` in
   `tests/balance.ts`, rerun `npm run sim`, and check the column above before shipping it.
