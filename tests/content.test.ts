import { describe, expect, it } from 'vitest';
import { NPC_NAMES } from '../src/core/reducer';
import { content } from './helpers';
import hubSource from '../src/ui/screens/hub.ts?raw';

describe('content', () => {
  it('covers four eras, all eight party members and every enemy family', () => {
    expect(Object.keys(content.characters).sort())
      .toEqual(['dax', 'hale', 'ilo9', 'mara', 'player', 'quiroga', 'strand_young', 'wren']);
    expect([...new Set(Object.values(content.locations).map((l) => l.era))].sort()).toEqual(['2031', '2064', '2148', '2312']);
    const families = new Set(Object.values(content.enemies).map((e) => e.family));
    expect([...families].sort()).toEqual(['construct', 'drone', 'echo', 'warden']);
    for (const era of ['2031', '2064', '2148', '2312']) {
      expect(Object.values(content.enemies).some((e) => e.era === era), era).toBe(true);
      expect(Object.values(content.scores).some((s) => s.era === era && s.id.startsWith('battle')), era).toBe(true);
      expect(Object.values(content.scores).some((s) => s.era === era && s.id.startsWith('hub')), era).toBe(true);
      expect(Object.values(content.maps).some((m) => m.era === era), era).toBe(true);
    }
  });

  it('gives every Deep Site a stop in all four eras, each reachable from the others', () => {
    for (const site of ['kell', 'halden', 'basin', 'capitol', 'meridian']) {
      const stops = Object.values(content.locations).filter((l) => l.kind === 'deepSite' && l.site === site);
      expect(stops.map((s) => s.era).sort(), site).toEqual(['2031', '2064', '2148', '2312']);
      for (const s of stops) {
        // A Deep Site reaches every era it existed in except the one you are standing in.
        expect([...s.timeLinks].sort(), s.id).toEqual(['2031', '2064', '2148', '2312'].filter((e) => e !== s.era));
      }
    }
  });

  it('gives each character a full tree with one condition node, a contradiction pair and era nodes', () => {
    for (const id of Object.keys(content.characters)) {
      const nodes = Object.values(content.nodes).filter((n) => n.character === id);
      expect(nodes.length, id).toBeGreaterThanOrEqual(14);
      expect(nodes.filter((n) => n.type === 'condition').length, id).toBeGreaterThanOrEqual(1);
      const contradictions = nodes.filter((n) => n.type === 'contradiction');
      expect(contradictions, id).toHaveLength(2);
      expect(contradictions[0].excludes).toContain(contradictions[1].id);
      expect(contradictions[1].excludes).toContain(contradictions[0].id);
      const eraNodes = nodes.filter((n) => n.type === 'era');
      expect(eraNodes.length, `${id} era nodes`).toBeGreaterThanOrEqual(2);
      for (const n of eraNodes) expect(n.era, n.id).toBeTruthy();
    }
  });

  it('ships the two Condition nodes the design doc names by title', () => {
    const named = Object.values(content.nodes).filter((n) => ['Read the Charter', 'Audited the Auditor'].includes(n.name));
    expect(named.map((n) => n.name).sort()).toEqual(['Audited the Auditor', 'Read the Charter']);
    for (const n of named) {
      expect(n.type, n.name).toBe('condition');
      expect(n.conditionHint, `${n.name} needs a hint; a condition node is a puzzle, not a trap`).toBeTruthy();
    }
  });

  it('keeps every Construct honest about its second bar', () => {
    const constructs = Object.values(content.enemies).filter((e) => e.family === 'construct');
    expect(constructs.length).toBeGreaterThan(0);
    for (const c of constructs) {
      expect(c.secondBar, c.id).toBeDefined();
      expect(c.secondBar!.resolve, c.id).toBeGreaterThan(0);
      expect(c.secondBar!.flavor, c.id).toBeTruthy();
    }
  });

  it('gates every surprise-only encounter behind a story beat', () => {
    const ambushes = Object.values(content.encounters).filter((e) => e.surprise === 'always');
    expect(ambushes.length).toBeGreaterThan(0);
    for (const a of ambushes) expect(a.story, a.id).toBe(true);
  });

  it('only sells gear that a character could wear', () => {
    for (const shop of Object.values(content.shops)) {
      for (const row of shop.stock) {
        const item = content.items[row.item];
        if (item.kind !== 'gear') continue;
        expect(item.slot, item.id).toBeTruthy();
        for (const who of item.onlyFor ?? []) expect(content.characters[who], `${item.id} is for ${who}`).toBeDefined();
      }
    }
  });

  it('leaves no item in the catalog that a player could never get hold of', () => {
    const sold = new Set(Object.values(content.shops).flatMap((s) => s.stock.map((r) => r.item)));
    const dropped = new Set(Object.values(content.enemies).flatMap((e) => (e.drops ?? []).map((d) => d.item)));
    const rewarded = new Set(Object.values(content.quests).flatMap((q) => q.rewards.items));
    for (const item of Object.values(content.items)) {
      expect(sold.has(item.id) || dropped.has(item.id) || rewarded.has(item.id), item.id).toBe(true);
    }
  });

  it('gives every location four parallax layers and one ambient animation', () => {
    for (const loc of Object.values(content.locations)) {
      expect(loc.background.layers, loc.id).toHaveLength(4);
      expect(loc.background.layers.some((l) => l.ambient), loc.id).toBe(true);
    }
  });
});

describe('teaching the systems', () => {
  it('has Wren explain threads, Tempo, Rewind, Fork and Entropy in the Act 1 intro', () => {
    const text = content.dialogues.intro_2312.lines.map((l) => l.text).join(' ');
    for (const term of ['thread', 'Slack', 'Tempo', 'Rewind', 'Fork', 'Entropy']) {
      expect(text, term).toContain(term);
    }
  });

  it('lets the player ask Wren to go over the gauges again', () => {
    const choice = content.dialogues.wren_hub.lines.flatMap((l) => l.choices ?? []).find((c) => c.next === 'wren_tempo_lesson');
    expect(choice).toBeDefined();
    const lesson = content.dialogues.wren_tempo_lesson.lines.map((l) => l.text).join(' ');
    expect(lesson).toContain('Rewind');
    expect(lesson).toContain('Fork');
    expect(lesson).toContain('Entropy');
    expect(lesson).toMatch(/two points|Two points/i);
  });
})

describe('presentation of people', () => {
  it('names every speaker and every NPC a location offers', () => {
    const speakers = new Set<string>();
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) speakers.add(l.speaker);
    for (const l of Object.values(content.locations)) {
      for (const n of [...l.npcs, ...(l.variants ?? []).flatMap((v) => v.npcs)]) speakers.add(n);
    }
    speakers.delete('narrator');
    const unnamed = [...speakers].filter((s) => !NPC_NAMES[s] && !content.characters[s]);
    expect(unnamed, `these would show as raw ids: ${unnamed.join(', ')}`).toEqual([]);
  });
});

describe('no dead ends', () => {
  it('never puts a condition node behind a fight the party might not be able to win', () => {
    // An Echo answers only Chronal damage, so an encounter holding one must not be the only
    // source of a flag anything else depends on.
    const echoFights = new Set(Object.values(content.encounters)
      .filter((e) => e.enemies.some((g) => content.enemies[g.enemy].family === 'echo'))
      .flatMap((e) => e.rewardFlags ?? []));
    const conditionFlags = Object.values(content.nodes)
      .filter((n) => n.type === 'condition' && n.condition?.startsWith('flag:'))
      .map((n) => n.condition!.slice('flag:'.length));
    const dialogueFlags = new Set(Object.values(content.dialogues).flatMap((d) => d.lines.flatMap(
      (l) => [...(l.setFlags ?? []), ...(l.choices ?? []).flatMap((c) => c.setFlags ?? [])])));
    const questFlags = new Set(Object.values(content.quests).flatMap((q) => q.rewards.flags));
    const safeFights = new Set(Object.values(content.encounters)
      .filter((e) => !e.enemies.some((g) => content.enemies[g.enemy].family === 'echo'))
      .flatMap((e) => e.rewardFlags ?? []));
    for (const flag of conditionFlags) {
      // Arriving somewhere sets been:<location>, and opening a conversation sets seen:<dialogue>.
      const arrival = flag.startsWith('been:') && !!content.locations[flag.slice('been:'.length)];
      const opened = flag.startsWith('seen:') && !!content.dialogues[flag.slice('seen:'.length)];
      const reachable = arrival || opened || dialogueFlags.has(flag) || questFlags.has(flag) || safeFights.has(flag)
        || Object.values(content.timelineChoices).some((c) => c.flags.includes(flag));
      expect(reachable, `${flag} is only reachable through an Echo fight`).toBe(true);
      void echoFights;
    }
  });

  it('never makes an unskippable fight turn on damage the party may not have', () => {
    // Everyone has Strike, and nothing else is guaranteed: Thermal is on no party ability at all,
    // Signal only bites machines, and Chronal is two nodes deep. A story fight the player cannot
    // walk away from must therefore contain nothing that shrugs off Kinetic.
    for (const enc of Object.values(content.encounters)) {
      if (!enc.story) continue;
      for (const g of enc.enemies) {
        const e = content.enemies[g.enemy];
        expect(e.immunities.includes('kinetic'), `${enc.id} fields ${e.id}, which Kinetic cannot touch`).toBe(false);
        expect(e.secondBar?.immunities?.includes('kinetic'), `${enc.id}: ${e.id}'s core is Kinetic-immune`).toBeFalsy();
      }
    }
  });

  it('never hides world knowledge behind who happens to be on the field', () => {
    // `party:x` is a roster decision made on another screen. A flag set behind one is a case-log
    // entry, a shop, or a quest that a player silently loses by benching somebody.
    for (const d of Object.values(content.dialogues)) {
      const check = (what: string, conds: string[] | undefined, flags: string[] | undefined) => {
        if (!flags?.length) return;
        const gate = (conds ?? []).find((c) => c.replace(/^!/, '').startsWith('party:'));
        expect(gate, `${d.id}: ${what} sets ${flags.join(', ')} only when ${gate} holds`).toBeUndefined();
      };
      for (const [i, l] of d.lines.entries()) {
        check(`line ${i}`, l.conditions, l.setFlags);
        for (const [j, c] of (l.choices ?? []).entries()) {
          check(`line ${i} choice ${j}`, [...(l.conditions ?? []), ...(c.conditions ?? [])], c.setFlags);
        }
      }
    }
  });

  it('never leaves a person with nothing at all to say', () => {
    // Every line in a scene can be gated, and then a run that sets the wrong flag walks up to
    // somebody and gets silence. Sabotaging the Handover used to do exactly that to Vesely.
    const entry = new Set(Object.values(content.locations).flatMap(
      (l) => [...(l.npcs ?? []), ...(l.variants ?? []).flatMap((v) => v.npcs ?? [])]));

    /** Only flag conditions are simulated; anything else is assumed satisfiable. */
    const visible = (conds: string[] | undefined, have: Set<string>): boolean =>
      (conds ?? []).every((raw) => {
        const negated = raw.startsWith('!');
        const c = negated ? raw.slice(1) : raw;
        if (!c.startsWith('flag:')) return negated;
        return have.has(c.slice('flag:'.length)) !== negated;
      });

    for (const id of entry) {
      const d = content.dialogues[id];
      if (!d) continue;
      const flags = [...new Set(d.lines.flatMap((l) => (l.conditions ?? [])
        .map((c) => c.replace(/^!/, ''))
        .filter((c) => c.startsWith('flag:'))
        .map((c) => c.slice('flag:'.length))))];

      // No flags at all, then each flag alone, then each pair: the states a run actually reaches.
      const states: Array<Set<string>> = [new Set()];
      for (let i = 0; i < flags.length; i++) {
        states.push(new Set([flags[i]]));
        for (let j = i + 1; j < flags.length; j++) states.push(new Set([flags[i], flags[j]]));
      }
      for (const have of states) {
        expect(d.lines.some((l) => visible(l.conditions, have)),
          `${id} has nothing to say once ${[...have].join(' + ') || 'nothing'} is set`).toBe(true);
      }
    }
  });

  it('gives every story and key fight a deliberate trigger', () => {
    // A story beat the player can only meet by wandering until the dice offer it is not a beat,
    // it is weather. Every one of them must be startable on purpose: a dialogue that hands the
    // player the decision, or a quest they took on. Four of these had no trigger at all.
    const fromDialogue = new Set(Object.values(content.dialogues).flatMap((d) => d.lines.flatMap(
      (l) => [l.action, ...(l.choices ?? []).map((c) => c.action)])).filter(
      (a): a is string => !!a && a.startsWith('battle:')).map((a) => a.slice('battle:'.length)));
    const fromQuest = new Set(Object.values(content.quests).map((q) => q.objectiveEncounter));
    // A map node of kind "encounter" is a labelled marker the player walks onto on purpose.
    const fromMarker = new Set(Object.values(content.maps).flatMap((m) => m.nodes)
      .filter((n) => n.kind === 'encounter').map((n) => n.encounter!));

    for (const enc of Object.values(content.encounters)) {
      if (!enc.story && enc.tier !== 'key') continue;
      expect(fromDialogue.has(enc.id) || fromQuest.has(enc.id) || fromMarker.has(enc.id),
        `${enc.id} ("${enc.name}") cannot be started on purpose`).toBe(true);
    }
  });

  it('keeps story and key fights out of the wilds pools', () => {
    // A zone rolls uniformly over its list, so leaving a story fight in one makes it compete with
    // filler for the same roll, lets the scan screen skip it with no penalty, and offers it again
    // after it has already been won.
    for (const map of Object.values(content.maps)) {
      for (const zone of map.zones) {
        for (const id of zone.encounters) {
          const enc = content.encounters[id];
          expect(enc, `${map.id}/${zone.id} lists an encounter that does not exist: ${id}`).toBeDefined();
          expect(enc.story || enc.tier === 'key',
            `${map.id}/${zone.id} leaves the story fight ${id} to a random roll`).toBeFalsy();
        }
        expect(zone.encounters.length, `${map.id}/${zone.id} has nothing to roll`).toBeGreaterThan(0);
      }
    }
  });

  it('never reads a flag that nothing in the game can set', () => {
    // The mirror of the test below. A gate on a flag with no setter is a line, a shop or a quest
    // that simply never appears, and deleting the setter by accident is silent in every other way.
    const set = new Set<string>();
    for (const e of Object.values(content.encounters)) for (const f of e.rewardFlags ?? []) set.add(f);
    for (const q of Object.values(content.quests)) for (const f of q.rewards.flags) set.add(f);
    for (const c of Object.values(content.timelineChoices)) for (const f of [...c.flags, ...c.partyEffects]) set.add(f);
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) {
      for (const f of l.setFlags ?? []) set.add(f);
      for (const ch of l.choices ?? []) for (const f of ch.setFlags ?? []) set.add(f);
    }
    // Flags the engine keeps itself rather than content declaring them.
    const engine = (f: string) => /^(been|seen|recruited|left|trained|lean|surpriseCancelled):/.test(f)
      || ['prologue', 'fleeing', 'metParty', 'started'].includes(f);

    const read = new Map<string, string>();
    const note = (where: string, conds?: string[]) => {
      for (const c of conds ?? []) {
        const f = c.replace(/^!/, '');
        if (!f.startsWith('flag:')) continue;
        const name = f.slice('flag:'.length);
        if (!read.has(name)) read.set(name, where);
      }
    };
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) {
      note(d.id, l.conditions);
      for (const ch of l.choices ?? []) note(d.id, ch.conditions);
    }
    for (const l of Object.values(content.locations)) {
      for (const v of l.variants ?? []) note(l.id, v.when);
      for (const a of l.actions ?? []) note(l.id, a.requires);
    }
    for (const le of Object.values(content.log)) note(`log:${le.id}`, le.when);
    for (const m of Object.values(content.maps)) for (const nd of m.nodes) note(`map:${m.id}`, nd.requires);
    for (const q of Object.values(content.quests)) note(`quest:${q.id}`, q.requires);
    for (const r of Object.values(content.rooms)) for (const pr of r.props) note(`room:${r.id}`, pr.requires);

    for (const [flag, where] of read) {
      if (engine(flag)) continue;
      expect(set.has(flag), `${where} waits on the flag "${flag}", which nothing sets`).toBe(true);
    }
  });

  it('leaves no flag set by content that nothing ever reads', () => {
    // A flag with no reader is a promise the content makes and does not keep.
    const set = new Set<string>();
    for (const e of Object.values(content.encounters)) for (const f of e.rewardFlags ?? []) set.add(f);
    for (const q of Object.values(content.quests)) for (const f of q.rewards.flags) set.add(f);
    for (const c of Object.values(content.timelineChoices)) for (const f of c.flags) set.add(f);
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) {
      for (const f of l.setFlags ?? []) set.add(f);
      for (const ch of l.choices ?? []) for (const f of ch.setFlags ?? []) set.add(f);
    }
    const read = new Set<string>();
    const note = (conds?: string[]) => { for (const c of conds ?? []) read.add(c.replace(/^!/, '').replace(/^flag:/, '')); };
    for (const d of Object.values(content.dialogues)) for (const l of d.lines) {
      note(l.conditions);
      for (const ch of l.choices ?? []) note(ch.conditions);
    }
    for (const l of Object.values(content.locations)) {
      for (const v of l.variants ?? []) note(v.when);
      for (const a of l.actions ?? []) note(a.requires);
    }
    for (const n of Object.values(content.nodes)) note(n.condition ? [n.condition] : []);
    for (const e of Object.values(content.encounters)) for (const h of e.scanHints) note([h.when]);
    for (const sh of Object.values(content.shops)) for (const st of sh.stock) note(st.when);
    for (const q of Object.values(content.quests)) note(q.requires);
    for (const le of Object.values(content.log)) note(le.when);
    for (const m of Object.values(content.maps)) for (const nd of m.nodes) note(nd.requires);
    for (const r of Object.values(content.rooms)) for (const pr of r.props) note(pr.requires);
    for (const ch of Object.values(content.characters)) note(ch.leavesIf);

    // Two are read by the engine rather than by content: the ending rule and the Act 1 handoff.
    const inCode = new Set(['youngStrandInParty', 'metParty']);
    const dead = [...set].filter((f) => !read.has(f) && !inCode.has(f)).sort();
    expect(dead, `set but never read: ${dead.join(', ')}`).toEqual([]);
  });

  it('gives every recruitable character a way into the party', () => {
    // Someone joins either through a dialogue action or as a timeline choice's party effect.
    const recruits = new Set([
      ...Object.values(content.dialogues).flatMap((d) => d.lines.flatMap(
        (l) => [l.action, ...(l.choices ?? []).map((c) => c.action)])),
      ...Object.values(content.timelineChoices).flatMap((c) => c.partyEffects),
    ].filter((a): a is string => !!a && a.startsWith('recruit:')).map((a) => a.slice('recruit:'.length)));
    for (const id of Object.keys(content.characters)) {
      if (['player', 'wren', 'dax'].includes(id)) continue; // Act 1, always.
      expect(recruits.has(id), `${id} can never be recruited`).toBe(true);
    }
  });
});

describe('site-specific presentation', () => {
  it('names the way down at every Deep Site rather than talking about a chapel everywhere', () => {
    const sites = new Set(Object.values(content.locations).filter((l) => l.kind === 'deepSite').map((l) => l.site));
    const labels = [...hubSource.matchAll(/^ {2}(\w+): '([^']+)',$/gm)].reduce<Record<string, string>>(
      (acc, m) => ({ ...acc, [m[1]]: m[2] }), {});
    for (const site of sites) expect(labels[site], `${site} has no way-down label`).toBeTruthy();
    expect(new Set(Object.values(labels)).size, 'each site describes its own descent').toBe(Object.keys(labels).length);
  });
});

describe('side quests', () => {
  it('runs a chain at every faction hub, ending in a trainer', () => {
    const hubs = Object.values(content.locations).filter((l) => l.type.startsWith('Faction hub'));
    expect(hubs.length, 'the design doc names four').toBe(4);
    for (const hub of hubs) {
      const chain = Object.values(content.quests).filter((q) => q.location === hub.id && (q.step ?? 1) < 9)
        .sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      expect(chain.length, `${hub.id} has no chain`).toBeGreaterThanOrEqual(2);
      expect(new Set(chain.map((q) => q.giver)).size, `${hub.id}: one giver runs the chain`).toBe(1);
      // The later step is gated on the earlier one's flag, so they are a chain and not a menu.
      const gate = chain[1].requires ?? [];
      const earlier = chain[0].rewards.flags.map((f) => `flag:${f}`);
      expect(gate.some((g) => earlier.includes(g)), `${chain[1].id} is not gated on ${chain[0].id}`).toBe(true);
      // Finishing it opens a trainer, who pays out once.
      const after = content.dialogues[`${chain[0].giver}_after`];
      expect(after, `${chain[0].giver} has no follow-up dialogue`).toBeDefined();
      const train = after.lines.flatMap((l) => l.choices ?? []).find((c) => c.action?.startsWith('train:'));
      expect(train, `${hub.id} opens no trunk trainer`).toBeDefined();
    }
  });

  it('gives every optional party member a personal quest, at a waypoint', () => {
    const optional = Object.keys(content.characters).filter((id) => !['player', 'wren', 'dax'].includes(id));
    for (const id of optional) {
      const q = Object.values(content.quests).find((x) => (x.requires ?? []).includes(`party:${id}`));
      expect(q, `${id} has no personal quest`).toBeDefined();
      const loc = content.locations[q!.location];
      expect(loc.kind, `${id}'s quest is at a Deep Site; the doc puts them at waypoints`).toBe('waypoint');
    }
  });

  it('covers all four kinds of side quest the design doc lists', () => {
    const all = Object.values(content.quests);
    const faction = all.filter((q) => content.locations[q.location].type.startsWith('Faction hub'));
    const personal = all.filter((q) => (q.requires ?? []).some((r) => r.startsWith('party:')));
    const ripple = all.filter((q) => content.locations[q.location].type === 'Ripple site');
    const local = all.filter((q) => !faction.includes(q) && !personal.includes(q) && !ripple.includes(q));
    for (const [kind, set] of [['faction', faction], ['recruitment', personal], ['ripple', ripple], ['local', local]] as const) {
      expect(set.length, `no ${kind} quests`).toBeGreaterThan(0);
    }
  });
});
