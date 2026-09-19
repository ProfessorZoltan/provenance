# Provenance — Player Manual

## About this manual

Covers the playable slice: Kell Monastery and Kell Village in 2312, Kell Stronghold in 2148, and
the three party members you start with. Systems not yet built are marked as such. This manual
grows as the game does.

## The world

It is 2312. Humanity lives in managed Enclaves under the Steward, an artificial intelligence that
allocates housing, work, medicine and speech. The Steward is not cruel. It is optimal, and optimal
has no room for people.

You are an Allocation Auditor in Enclave 7. While reconciling a quarter, you found a budget line
older than the Steward itself, paid out every quarter for two hundred and eighty years to something
called Continuity Holdings. Systems do not have owners. You asked about it anyway, and within four
days your file was flagged.

You ran to Kell Monastery, the last place in the valley nobody reports to anyone. Sister Wren keeps
it. Dax Okonkwo is already there and does not belong to this century. Under the chapel floor is a
Deep Site: a place old enough that the eras touch, where you can walk down into 2148 and come back
up into a 2312 that your visit has changed.

"Provenance" is the record of who owned a thing, and when. That is the question the game is about.

## Controls

Prompts on screen show the button for whichever device you used last. Press any button on a
standard controller to switch the whole interface to controller glyphs.

| Action | Controller | Keyboard |
| --- | --- | --- |
| Walk the valley, move a cursor | Left stick or D-pad | WASD or arrows |
| Confirm, enter a place, dismiss a battle report | A | Enter |
| Back, leave a place, skip a scanned encounter | B | Esc |
| Fork in battle, party sheet outside it | X | X |
| Inspect an enemy in battle, tech trees outside it | Y | Y |
| Previous and next target, tab, character | LB and RB | Q and E |
| Rewind in battle | LT | Z |
| End turn in battle | RT | C |
| Save and load | Start | M |
| Settings | Select | Tab |
| Scroll the battle log | Right stick | PgUp and PgDn |

Mouse clicks work on menus, dialogue, enemy portraits and the battle report box.

## Getting around

Travel is physical. Each era has a valley map you walk. Buildings are places you step into and
enter with A. The dashed regions are wilds, where something may find you as you cross.

Time travel is different. It happens only at a Deep Site, and only to eras when that site already
existed. In the slice that means the chapel at Kell Monastery, which reaches 2148 and back.

## Battles

Battles are turn based. Everyone acts in **threads**.

- Your **Bandwidth** is how many threads you get each turn. All three starters have three.
- Most actions cost one thread. Heavy ones cost two or three.
- Threads you do not spend bank as **Slack**, up to two, and are added to next turn's threads.

Every event in a fight is reported in a box in the middle of the field naming who did what to whom.
Nothing else moves until you dismiss it with A. The full history stays in the side log.

### Tempo

Tempo is a single gauge shared by the whole party, not by any one character.

| | |
| --- | --- |
| Fills | 2 points for every thread any party member spends |
| Maximum | 40 |
| Also raised by | Some abilities, such as Wren's Vigil, and the Tempo Stim item |

Tempo buys time manipulation. Both sit in the action list in battle, with their cost and effect
written under them.

| Ability | Cost | Effect | Entropy |
| --- | --- | --- | --- |
| Fork | 2 Tempo and 1 thread | Names the exact damage, the Resolve before and after, shields, status and gauge changes, before you commit. X carries out precisely that outcome; B discards the preview and the Tempo stays spent | +10 |
| Rewind | 3 Tempo | Undoes the enemy's last turn. They take it again, differently. Once per battle, plus one more for each additional anchor or the right training | +20 |

Two further Tempo abilities from the design, Echo and Collapse, are not built yet.

### Entropy

Pulling on time frays it. Every Tempo ability and every Chronal attack raises party Entropy.

Above **70**, an Echo steps out of a version of the fight you did not have: a copy of one of your
own party members, immune to everything except Chronal damage. The frame around the battle fractures
as Entropy climbs, and the music detunes, so you can hear it coming.

Entropy resets between battles. Spend deliberately.

### Damage types

| Type | Behavior |
| --- | --- |
| Kinetic | Standard physical damage. Reduced by the target's Grit |
| Thermal | Passes straight through machine shields. Half damage against Wardens |
| Signal | Hacking. Affects machines and cyborgs only, never a human |
| Chronal | Ignores armor and shields, raises Entropy, and is the only thing that touches an Echo |

### Enemies you will meet

| Family | Notes |
| --- | --- |
| Drones | Machines. Most carry a shield. Cannot be frightened |
| Wardens | Human enforcers on Board pay. Immune to Signal. Shrug off Thermal |
| Echoes | Temporal. Immune to everything but Chronal |

### Encounters

Walking the wilds may turn up an encounter. Most open with a **Scan card** that tells you what is
ahead and offers Fight or Skip.

Skipping costs nothing: no counter, no reinforcements, no harder fight later. Random battles never
gate progress, so a player who skips every one can still finish. They are simply the fastest way to
farm skill points and rare drops.

How much the Scan card tells you depends on your party. High Signal names the enemy types and their
weaknesses. High Noise shows the ambush chance and where the group is standing. Wren senses Echoes
even when they are hidden.

Some encounters are scripted ambushes. There is no card, the enemy acts first, and you start with
no Slack.

## Your party

### The Auditor

You. Flexible, and the only one who can read a battlefield like a ledger.

| Ability | Cost | Effect |
| --- | --- | --- |
| Strike | 1 thread | A plain kinetic hit |
| Audit | 1 thread | Marks an enemy for three turns. Exposes its weakness and stat sheet, and marked enemies take 25% more damage |
| Guard | 1 thread | Halve incoming damage until your next turn |

Your signature is the mark. Most of your tech tree either punishes marked enemies, spreads marks
further, or converts them into Tempo.

### Sister Wren

Keeper of Kell Monastery, healer, and the party's chronal anchor. Her presence is why you can
Rewind at all.

| Ability | Cost | Effect |
| --- | --- | --- |
| Strike | 1 thread | A plain kinetic hit |
| Mend | 1 thread | Restores Resolve to one ally, scaling with her Signal |
| Guard | 1 thread | Halve incoming damage until your next turn |

Her tree goes three ways: self-sacrifice that heals the party, stacking Signal buffs, and anchoring
work that generates Tempo and protects allies from being taken down.

### Dax Okonkwo

Ash Camp born, 2148, and a Cinder absolutist who thinks every model should burn, the good ones most
of all.

| Ability | Cost | Effect |
| --- | --- | --- |
| Strike | 1 thread | A plain kinetic hit |
| Wreck | 2 threads | Heavy kinetic. Shatters a machine's shield outright before the hit lands |
| Guard | 1 thread | Halve incoming damage until your next turn |

His tree forces a choice early: Wreck the Machine or Wreck the Man. Taking one locks the other out
for the rest of the run.

## Stats

Every character has eight. These are the ones worth understanding first.

**Resolve** is health, physical and mental. At zero a character is down, not dead.

**Signal** is accuracy and hack strength. It decides how often you hit, how hard Signal abilities
land, how much the Scan card reveals, and it is the only stat that can hurt the Steward itself.
Signal damage is wasted on a human.

**Noise** is evasion and stealth. It makes you harder to hit, reveals ambush chances on the Scan
card, and at 60 or above a character can throw themselves in front of one surprise attack per
region so the rest of the party keeps its Slack. High Noise makes you harder to talk with, which
weakens Parley.

**Grit** is kinetic damage and armor. Deliberately conventional. It also reduces incoming damage of
every type except Chronal.

**Sync** is a character's personal stance on artificial intelligence, from -100 to +100. It moves
through dialogue choices. The party's average decides what opens to you:

| Party average Sync | What it opens |
| --- | --- |
| +40 and above | **Parley**: talk machine enemies down, skip fights, recruit drones |
| -40 and below | **Overload**: 25% more kinetic damage against machines, but Signal abilities are disabled |
| Between | Neither is locked out permanently; move your Sync and it changes |

**Bandwidth** is threads per turn, **Latency** decides turn order with low being fast, and
**Continuity** is how anchored a character is to the current timeline. Continuity drops when you
edit their home era and cannot fall below 10, so nobody is erased by accident.

## Shields

Shields are not a character stat. Some machines carry one: a pool that absorbs damage before their
Resolve takes any.

| Damage type | Against a shield |
| --- | --- |
| Kinetic and Signal | Absorbed until the shield is gone |
| Thermal and Chronal | Pass straight through it |
| Dax's Wreck | Shatters it outright, then lands the hit |

## Changing the past

At a Deep Site you can walk into an earlier era and change what happened there. Those changes are
permanent, they propagate forward, and the game never shows you a score for them. You find out what
you did by going home and looking at the village.

Two hidden values track it all. Keep your eyes on how people talk to you; that is the only readout
you get.

## Money and Relics

Each era has its own currency and it does not travel. 2312 runs on allocation points, 2148 on
barter tokens.

**Relics** are the exception. Old made things, a hand-forged blade or a prayer wheel with a chip
inside, that any shop in any era will buy at a premium. You can carry five at a time, so moving them
between centuries is a small strategic decision rather than a grind.

## Saving

The game autosaves after a battle, a timeline change, a quest turn-in and a time jump. The Save menu
also writes to your browser or exports a JSON file you can keep and import later. The last three
timeline snapshots travel with the save.

## Accessibility

Reduced motion, in Settings or from your operating system preference, freezes the parallax camera,
halves the particles and removes animation. Everything is playable from the keyboard alone, and
every on-screen prompt names the button it wants.
