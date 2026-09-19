# Provenance — Player Manual

## About this manual

Covers what is playable: three Deep Sites, Kell, Port Halden and the Basin, across four eras, 2031,
2064, 2148 and 2312, and the party you can gather there. Systems not yet built are marked as such.
This manual grows as the game does.

## Before Kell

The game opens in the Allocation Office on the fourth floor of Enclave 7, at twenty to midnight,
with a quarter that will not close. You walk the room, and the monitor array on the desk is where
the work happens: reconcile the quarter, trace the counterparty, pull the payment history, and then
query the charter itself. Each answer is worse than the last, and the last one is the one that flags
your file.

After that there is a corridor lit end to end and four hours of valley road between you and the only
place in this century that does not report to anyone.

You can skip all of it on a replay: press X on the stance screen instead of A, and you start at Kell
with the party already met.

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

Inland from both of them is the Basin: a datacenter going up in the desert in 2031, a hyperscale
farm in 2064, sand-buried racks in 2148, and in 2312 the cooling fields where the Steward actually
does its thinking. It has never once been audited, because the line item that pays for it is the
one you asked about.

Down the coast road from Kell is Port Halden, and it is a Deep Site too. In 2031 it is a working
shipping city, and four crates a week leave its quay for an address in the hills. In 2064 it is nine
million people stacked on a city built for two, in the week the Handover treaty goes to the floor. In
2148 the sea is in the third storey. In 2312 it is Enclave 7, and Enclave 7 is where you used to live.

"Provenance" is the record of who owned a thing, and when. That is the question the game is about.

## Controls

Prompts on screen show the button for whichever device you used last. Press any button on a
standard controller to switch the whole interface to controller glyphs.

| Action | Controller | Keyboard |
| --- | --- | --- |
| Walk the valley, move a cursor | Left stick or D-pad | WASD or arrows |
| Confirm, enter a place, dismiss a battle report | A | Enter |
| Back, leave a place, skip a scanned encounter | B | Esc |
| Fork in battle, roster and gear outside it | X | X |
| Inspect an enemy in battle, tech trees outside it | Y | Y |
| Previous and next target, tab, character | LB and RB | Q and E |
| Case log, outside a fight | LB | Q |
| Rewind in battle | LT | Z |
| End turn in battle | RT | C |
| Save and load | Start | M |
| Settings | Select | Tab |
| Scroll the battle log | Right stick | PgUp and PgDn |

Mouse clicks work on menus, dialogue, enemy portraits and the battle report box.

## Getting around

Travel is physical. Each era has one map you walk, holding the Kell valley in the north-west, Port
Halden on the coast to the south-east, and the Basin inland to the east, joined by road. The map is
larger than the screen: the view follows the party, and the panel in the bottom-left corner is the
whole world with your position on it. Buildings are
places you step into and enter with A. The dashed regions are wilds, where something may find you as
you cross.

Time travel is different. It happens only at a Deep Site, and only to eras when that site already
existed. Both sites reach all four centuries, so you can jump from either and arrive at the same
place in another era.

| Era | Kell | Port Halden | The Basin | Reference |
| --- | --- | --- | --- | --- |
| 2031 | The retreat being founded | Shipping city and its market | A datacenter under construction | The Founding |
| 2064 | An off-grid commune | Migrant megacity, the week of the vote | Hyperscale farm, blue aisles | The Handover |
| 2148 | The stronghold holding out | Drowned ruins and roof gardens | Wasteland and standing racks | The Quiet |
| 2312 | The monastery, the last free place | Enclave 7, your own address | Cooling fields and steam towers | Now |

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
| Wardens | Human enforcers. Immune to Signal. Shrug off Thermal |
| Constructs | Two health bars. Break the machine shell and whoever is inside keeps fighting, with their own kit and their own weaknesses. The core is usually human, so Signal stops working on it |
| Echoes | Temporal. Immune to everything but Chronal |

Some enemies cannot be hurt the ordinary way at all. A rack buried in the Basin for eighty years
shrugs off Kinetic entirely: sand simply moves. Read the Scan card.

Enemies differ by century. A 2031 prototype has no shielding at all and folds to Signal. A 2064
machine is the polished commercial article, well shielded and well maintained, and the Wardens beside
it are private security rather than state enforcers. The same role in 2148 has been rained on for a
hundred years and hits harder than it should.

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

Four can take the field at once. The Auditor always goes. Anyone benched still earns experience, at
half rate, so nobody falls behind for sitting out. Press X anywhere outside a fight for the roster.

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

### ILO-9

A liturgical model from the monastery's old server, buried in the Server Graveyard when the racks
came down and still running on trickle power. Free it in 2148 and it joins. Break it instead and it
is a boss. It leaves if the party's average Sync falls to -60.

| Ability | Cost | Effect |
| --- | --- | --- |
| Probe | 1 thread | Signal damage straight into a machine's stack. Nothing to say to a human |
| Checksum | 1 thread | Restores Resolve to one ally, scaling with its Signal |
| Guard | 1 thread | Halve incoming damage until its next turn |

Where everyone else has a Breaker trunk, ILO-9 has Fork: it puts short-lived copies of itself on the
field that act for a couple of rounds and then dissolve. Two at a time at most, and a copy falling
is not a party wipe.

### Mara Vesely

A reform staffer in the 2064 Handover senate who spent four years drafting amendments nobody read.
She joins at Port Halden in 2064, and only if you did not collapse the vote she had been waiting for.

| Ability | Cost | Effect |
| --- | --- | --- |
| Strike | 1 thread | A plain kinetic hit |
| Terms | 1 thread | Binds an enemy to a contract for three turns. While bound it takes 20% more damage and deals 30% less, because breaching costs it |
| Parley | 1 thread | Talks a machine down. Hers lands more often than anyone else's |
| Guard | 1 thread | Halve incoming damage until her next turn |

Her trees are Leverage, which punishes a contract already broken, Diplomacy, which ends fights
without having them, and Accord, which puts everyone under the same terms. Her capstone, Settlement,
ends a battle outright if every enemy on the field is bound by Terms when she calls it.

### Tomas Hale

Ash Camp's best shot, and the only one of that crew who ever came back from the Basin. He is on a
ridge above it in 2148, and he is only up there because somebody at Kell handed out rifles. He walks
away if the party's average Sync climbs above +60.

| Ability | Cost | Effect |
| --- | --- | --- |
| Strike | 1 thread | A plain kinetic hit |
| Held Shot | 1 thread | Settle in. Every turn spent holding adds 60% to the shot you eventually take |
| Guard | 1 thread | Halve incoming damage until his next turn |

His trees are Longshot, which spends the charge on one target, Recon, which target-locks the whole
field so nobody misses, and Patience, which raises the Slack cap to four so he can bank two turns
and spend them at once. The charge is paid out the moment he fires, hit or miss.

His capstone, Killing Silence, is one shot that cannot miss and that armor, shields, Guard and
immunity are not consulted about. It is the only thing in the game that ignores an immunity.

## Roster and gear

Press X outside a fight. The left column is the roster; A benches or fields whoever is focused. The
right column is the focused member's sheet and their two equipment slots.

| Slot | Holds |
| --- | --- |
| Weapon | Blades, hammers, slates. Mostly Grit or Signal |
| Gear | Plating, shrouds, weaves. Resolve, Noise, Continuity |

Some pieces are made for one person and nobody else can carry them. Equipping something swaps
whatever was in that slot back into the bag. Shops in each era sell gear from that century, and
enemies drop it.

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

**The order you visit eras in matters more than the choices themselves.** A place has one history,
and the last edit you make to it wins:

- Change 2148 at Kell, then change 2031 at Kell, and the 2031 edit rewrites everything downstream
  of it. The 2148 decision you made never happened, because the century it happened in now runs
  differently.
- Change 2031 first and then 2148, and both stand. You shaped the founding, then shaped what grew
  out of it.
- Different places are independent. Editing the monastery does not touch the Server Graveyard, and
  nothing you do at Port Halden rewrites a decision you made at Kell.

So an era you are saving for last is an era that can undo your work. Plan the sequence.

Two hidden values track it all. Keep your eyes on how people talk to you; that is the only readout
you get.

### Ripple sites

Some waypoints are not fixed. A **ripple site** is a place whose state was decided somewhere else,
in another century, usually by a side quest rather than a Deep Site choice. Their swings are small
on purpose: five to ten points of Ownership or Sync, enough to colour an ending but never to pick
one.

| Ripple site | Decided by | What changes | Reference |
| --- | --- | --- | --- |
| Tolliver Bakery, 2031 | Whether you sit the night shift, and what you tell Mattie to do at nine the next morning | The corner is a going concern or a burnt shell | The Night Shift |
| Tolliver Corner, 2148 | The same decision, 117 years upstream | A safehouse with a cellar, a trader and a bed, or a collapsed brick corner | — |
| The Stacks, 2148 | What you tell Sana on the Migrant Causeway in 2064 | Whether anyone on those roofs was taught to swim | — |
| Strand Memorial, 2312 | Your party's average Sync | A museum, a ruin, or a shrine people leave things at | — |
| Cooling Fields, 2312 | Whether the Basin crew list was filed in 2031 | Whether four hundred and six names are cast into the service gate | The Second Column |
| The Basin, 2148 | Whether the Kell resistance was armed | Whether there is anyone on the north ridge to find | — |
| Kell Village, 2312 | Whether the stronghold was armed in 2148 | A drilling town with a memorial, or a watched one with half its stalls shut | — |
| Enclave 7 Commissary, 2312 | Ownership | How much is on the shelves and who put it there | — |

Nothing marks a ripple site on the map. You find out the same way you find out everything else in
this game: by going there and looking.

## Money and Relics

Each era has its own currency and it does not travel. 2031 and 2064 run on credits, 2148 on barter
tokens, 2312 on allocation points.

What a shop will sell you also depends on how much of the world is owned by the people living in it.
The Undercity Bazaar in 2064 and the Enclave 7 Commissary in 2312 both stock more, and stock it more
openly, the further Ownership has moved your way.

**Relics** are the exception. Old made things, a hand-forged blade or a prayer wheel with a chip
inside, that any shop in any era will buy at a premium. You can carry five at a time, so moving them
between centuries is a small strategic decision rather than a grind.

## The case log

Press LB, or pick **Case log** from any location's action list. It is the Auditor's own notes, and
it fills itself: every name, date, place and clue is written down the moment you learn it, with
where you learned it kept in its own column.

| Section | What it holds | Reference |
| --- | --- | --- |
| Clues | What does not add up, and what it points at | Budget line 88-231-C |
| People | Who is in this, and on whose side | Continuity Holdings |
| Places | Where it happened, and what it is now | The Basin |
| Dates | The centuries you can reach, and what turns on each | 2064, the Handover |

The log never forgets. If you rewrite the century an entry came from, the entry stays, struck
through and marked **no longer true** — because the Auditor does not unlearn a thing just because it
stopped having happened. Those struck-through lines are the clearest readout the game gives you of
what your edits actually did.

## Saving

The game autosaves after a battle, a timeline change, a quest turn-in and a time jump. The Save menu
also writes to your browser or exports a JSON file you can keep and import later. The last three
timeline snapshots travel with the save.

## Accessibility

Reduced motion, in Settings or from your operating system preference, freezes the parallax camera,
halves the particles and removes animation. Everything is playable from the keyboard alone, and
every on-screen prompt names the button it wants.
