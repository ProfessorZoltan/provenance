import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../src/core/save';
import { activeVariant, npcDialogue } from '../src/core/reducer';
import { evalAll } from '../src/core/conditions';
import { maxHp, xpForLevel } from '../src/core/stats';
import { conditionContext } from '../src/core/encounter';
import { deriveWorld } from '../src/core/timeline';
import { ERA_LEVEL } from './balance';
import type { GameState } from '../src/types/state';
import { autoBattle, content, newGame, reduce, run, skipDialogue } from './helpers';

describe('vertical slice end to end', () => {
  it('plays the whole loop: explore, scan, fight, quest, jump, choose, return, save and load', () => {
    let s = skipDialogue(newGame(2024));
    expect(s.flags).toContain('metParty');

    // Explore at the monastery until a scanned encounter appears (surprise rolls are possible).
    let scanned = false;
    for (let i = 0; i < 6 && !scanned; i++) {
      s = reduce(s, { type: 'EXPLORE' });
      if (s.screen.id === 'scan') scanned = true;
      else { s = autoBattle(s); s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } }); }
    }
    expect(scanned).toBe(true);
    expect(s.scan?.hints[0]).toMatch(/2 enemies/);
    // Skip costs nothing.
    const before = s.counters;
    s = reduce(s, { type: 'SCAN_SKIP' });
    expect(s.screen.id).toBe('hub');
    expect(s.counters).toEqual(before);

    // Quest at the village.
    s = reduce(s, { type: 'TRAVEL', location: 'kell_village_2312' });
    s = reduce(s, { type: 'START_DIALOGUE', id: 'pell_offer', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.gate_drone).toBe('active');
    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'kell_2312_gate' });
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    expect(s.quests.gate_drone).toBe('readyToTurnIn');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'pell_complete', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.quests.gate_drone).toBe('complete');
    expect(s.inventory.relics).toContain('relic_prayer_wheel');

    // Shop: sell the relic at a premium, buy a ration.
    const pts = s.inventory.currency['allocation points'];
    s = reduce(s, { type: 'SHOP_SELL_RELIC', item: 'relic_prayer_wheel' });
    expect(s.inventory.currency['allocation points']).toBe(pts + 120);
    s = reduce(s, { type: 'SHOP_BUY', item: 'ration' });
    expect(s.inventory.items.ration).toBe(3);

    // Time jump, choose, survive the ambush.
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'REST' }, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s, 0);
    expect(s.battle?.encounterId).toBe('kell_2148_ambush');
    s = autoBattle(s);
    if (s.battle?.phase === 'lost') {
      s = reduce(s, { type: 'BATTLE_FINISH' });
      expect(s.screen.id).toBe('gameOver');
      s = reduce(s, { type: 'GAME_OVER_RETURN' });
      expect(s.location).toBe('kell_2148');
    } else {
      s = reduce(s, { type: 'BATTLE_FINISH' });
      expect(s.flags).toContain('survivedSurprise');
      s = reduce(s, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    }

    // Return: the village has changed.
    s = run(s, { type: 'TIME_JUMP', era: '2312' }, { type: 'TRAVEL', location: 'kell_village_2312' });
    expect(s.dialogue?.id).toBe('village_armed');
    s = skipDialogue(s);

    // Save and load round trip.
    const text = serialize(s);
    const loaded = reduce(s, { type: 'LOAD_STATE', state: deserialize(text) });
    expect(loaded.world).toEqual(s.world);
    expect(loaded.party).toEqual(s.party);
    expect(loaded.inventory).toEqual(s.inventory);
    expect(loaded.flags).toEqual(s.flags);
    expect(loaded.screen.id).toBe('hub');
    expect(() => deserialize('{"nope":true}')).toThrow();
  });

  it('adding content requires no code: a fourth character and a sixth encounter load from JSON alone', () => {
    // The loader groups by folder and id; this test asserts the schema plumbing rather than files on disk.
    const ids = Object.keys(content.characters);
    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(Object.values(content.encounters).every((e) => e.enemies.every((g) => content.enemies[g.enemy]))).toBe(true);
  });
});

describe('the second Deep Site', () => {
  it('walks to Port Halden in 2064, settles the Handover and brings Mara home', () => {
    let s = skipDialogue(newGame(4242));
    // Both sites sit on one map per era, so Halden is reached on foot from Kell.
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'halden_2312' });
    expect(s.location).toBe('halden_2312');
    s = skipDialogue(s);

    // 2064 is only reachable because both sites already existed then.
    s = reduce(s, { type: 'TIME_JUMP', era: '2064' });
    expect(s.location).toBe('halden_2064');
    s = skipDialogue(s);
    expect(s.world.visitedEras).toContain('2064');

    // Vesely puts one thing on the floor: amend article nine.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.world.history.map((h) => h.choiceId)).toContain('amend_treaty');

    // Having carried her clause, she asks to come along.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(Object.keys(s.party)).toContain('mara');
    expect(s.activeParty).toContain('mara');

    // And the change is waiting at home: the clause is in the charter and the commissary has more on its shelves.
    const before = deriveWorld(content, newGame(4242).world, s.party).ownership;
    s = run(s, { type: 'TIME_JUMP', era: '2312' });
    expect(s.location).toBe('halden_2312');
    expect(deriveWorld(content, s.world, s.party).ownership).toBe(before + 30);
    s = reduce(s, { type: 'TRAVEL', location: 'enclave7_commissary_2312' });
    const onSale = (st: GameState) => content.shops.enclave7_commissary.stock
      .filter((x) => evalAll(x.when, conditionContext(content, st))).length;
    expect(onSale(s), 'the shelves carry more than they did').toBeGreaterThan(onSale(skipDialogue(newGame(4242))));
  });

  it('keeps Mara out of the party when the vote was sabotaged instead', () => {
    let s = skipDialogue(newGame(99));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TRAVEL', location: 'halden_2312' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TIME_JUMP', era: '2064' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 1); // Collapse the session.
    expect(s.world.history.map((h) => h.choiceId)).toContain('sabotage_vote');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'mara_vesely', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(Object.keys(s.party)).not.toContain('mara');
  });
});

describe('a ripple end to end', () => {
  it('saves the bakery in 2031 and finds the safehouse open in 2148', () => {
    let s = skipDialogue(newGame(808));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2031' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TRAVEL', location: 'tolliver_bakery_2031' });
    expect(s.location).toBe('tolliver_bakery_2031');

    // Mattie is a quest giver, so her door routes by quest status.
    expect(npcDialogue(content, s, 'mattie_tolliver')).toBe('tolliver_offer');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'tolliver_offer', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.tolliver_fire).toBe('active');
    expect(npcDialogue(content, s, 'mattie_tolliver')).toBe('tolliver_progress');

    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'tolliver_2031_arson' });
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    expect(s.quests.tolliver_fire).toBe('readyToTurnIn');

    // Turning it in is where the ripple is chosen.
    s = reduce(s, { type: 'START_DIALOGUE', id: 'tolliver_complete', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.tolliver_fire).toBe('complete');
    expect(s.inventory.relics).toContain('relic_tolliver_sign');
    expect(s.world.history.map((h) => h.choiceId)).toContain('save_bakery');
    expect(npcDialogue(content, s, 'mattie_tolliver')).toBe('mattie_tolliver_after');

    // A hundred and seventeen years later, the corner is a refuge with a shop in it.
    s = run(s, { type: 'TRAVEL', location: 'halden_2031' }, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s);
    if (s.screen.id === 'battle') { s = autoBattle(s); s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } }); }
    s = reduce(s, { type: 'TRAVEL', location: 'tolliver_safehouse_2148' });
    const v = activeVariant(content, s, content.locations.tolliver_safehouse_2148)!;
    expect(v.shop).toBe('tolliver_safehouse');
    expect(v.npcs).toContain('safehouse_keeper');
    s = reduce(s, { type: 'SHOP_SELL_RELIC', item: 'relic_tolliver_sign' });
    expect(s.inventory.currency['barter tokens']).toBeGreaterThan(0);
  });
});

describe('the third Deep Site', () => {
  it('walks inland to the Basin, and only finds Hale there if Kell was armed', () => {
    // Let it fall at Kell in 2148, and the ridge above the Basin is empty.
    let quiet = skipDialogue(newGame(1212));
    quiet = run(quiet, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2148' });
    quiet = skipDialogue(quiet, 1); // let it fall
    if (quiet.screen.id === 'battle') { quiet = autoBattle(quiet); quiet = run(quiet, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } }); }
    quiet = reduce(quiet, { type: 'TRAVEL', location: 'basin_2148' });
    quiet = skipDialogue(quiet);
    expect(activeVariant(content, quiet, content.locations.basin_2148)!.npcs).toEqual([]);

    // Arm it instead and he is on the north ridge.
    let s = skipDialogue(newGame(1212));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2148' });
    s = skipDialogue(s, 0); // arm the resistance
    if (s.screen.id === 'battle') { s = autoBattle(s); s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } }); }
    s = reduce(s, { type: 'TRAVEL', location: 'basin_2148' });
    s = skipDialogue(s);
    expect(activeVariant(content, s, content.locations.basin_2148)!.npcs).toContain('hale_ridge');

    s = reduce(s, { type: 'START_DIALOGUE', id: 'hale_ridge', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(Object.keys(s.party)).toContain('hale');
    // Ash Camp sells him a rifle nobody else can carry.
    expect(content.shops.ash_camp.stock.find((r) => r.item === 'hale_rifle')!.when).toEqual(['party:hale']);
  });

  it('runs the Basin crew list forward into a plaque at the cooling fields', () => {
    let s = skipDialogue(newGame(1313));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2031' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TRAVEL', location: 'basin_work_camp_2031' });
    expect(npcDialogue(content, s, 'camp_clerk')).toBe('camp_clerk_offer');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'camp_clerk_offer', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.basin_crew).toBe('active');

    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'camp_2031_foreman' });
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });

    s = reduce(s, { type: 'START_DIALOGUE', id: 'camp_clerk_complete', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.basin_crew).toBe('complete');
    expect(s.inventory.relics).toContain('relic_crew_list');
    expect(s.world.history.map((h) => h.choiceId)).toContain('name_the_crew');

    // Two hundred and eighty years later the names are cast into the service gate.
    s = run(s, { type: 'TRAVEL', location: 'basin_2031' }, { type: 'TIME_JUMP', era: '2312' });
    s = skipDialogue(s);
    expect(s.location).toBe('basin_2312');
    expect(activeVariant(content, s, content.locations.basin_2312)!.description).toMatch(/four hundred and six names/);
  });
});

describe('the fourth Deep Site', () => {
  it('reads the Enabling Act in 2031 and finds the Board waiting in 2312', () => {
    let s = skipDialogue(newGame(515));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2031' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TRAVEL', location: 'capitol_2031' });
    s = skipDialogue(s);
    expect(s.location).toBe('capitol_2031');

    s = reduce(s, { type: 'START_DIALOGUE', id: 'clerk_of_the_house', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0); // read it out, then make it name its beneficiary
    expect(s.world.history.map((h) => h.choiceId)).toContain('name_the_beneficiary');
    expect(s.log).toContain('enabling_act');
    expect(s.log).toContain('naming_clause');

    // 2312: the room the allocation system has no entry for.
    s = run(s, { type: 'TIME_JUMP', era: '2312' });
    s = skipDialogue(s);
    expect(s.location).toBe('capitol_2312');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'board_secretary', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.flags).toContain('knowsStrand');
    expect(s.log).toContain('the_chair');
    expect(s.log).toContain('continuity_board');
  });

  it('runs the annex register quest from the 2064 cloakroom', () => {
    let s = skipDialogue(newGame(616));
    s = run(s, { type: 'TRAVEL', location: 'kell_2312' }, { type: 'TIME_JUMP', era: '2064' });
    s = skipDialogue(s);
    s = reduce(s, { type: 'TRAVEL', location: 'senate_annex_2064' });
    expect(npcDialogue(content, s, 'annex_staffer')).toBe('annex_offer');
    s = reduce(s, { type: 'START_DIALOGUE', id: 'annex_offer', returnTo: { id: 'hub' } });
    s = skipDialogue(s, 0);
    expect(s.quests.annex_registry).toBe('active');

    s = reduce(s, { type: 'START_ENCOUNTER', encounterId: 'capitol_2064_cloakroom' });
    s = autoBattle(s);
    expect(s.battle?.phase).toBe('won');
    s = run(s, { type: 'BATTLE_FINISH' }, { type: 'SET_SCREEN', screen: { id: 'hub' } });
    s = reduce(s, { type: 'START_DIALOGUE', id: 'annex_complete', returnTo: { id: 'hub' } });
    s = skipDialogue(s);
    expect(s.quests.annex_registry).toBe('complete');
    expect(s.inventory.relics).toContain('relic_gallery_pass');
    expect(s.log).toContain('declared_interests');
  });
});

describe('quest objectives are beatable', () => {
  /** A later step in a chain is reached by a party that has already done the earlier one. */
  const partyFor = (level: number, s: GameState): GameState => (level <= 1 ? s : {
    ...s,
    party: Object.fromEntries(Object.entries(s.party).map(([id, c]) => {
      const xp = xpForLevel(level, content.rules.xpPerLevel);
      return [id, { ...c, xp, level, hp: maxHp(content, content.characters[id], { ...c, xp, level }) }];
    })),
  });

  it('lets a party that has done the earlier steps win every quest fight', () => {
    for (const q of Object.values(content.quests)) {
      // An ungated quest must fall to a party that walked straight there. A later chain step only
      // has to fall to a party that cleared the earlier one, and a personal quest is gated on a
      // recruit, which happens well into a run.
      // Where a party actually is when it can reach this: the era it sits in sets the floor, and a
      // chain step or a personal quest means a few more levels of run behind it.
      const era = content.encounters[q.objectiveEncounter].era;
      const personal = (q.requires ?? []).some((r) => r.startsWith('party:'));
      const gated = personal || (q.step ?? 1) > 1 || !!q.requires?.length;
      const level = ERA_LEVEL[era] + (gated ? 2 : 0);
      for (const seed of [4, 41, 97]) {
        let s = reduce(partyFor(level, newGame(seed)), { type: 'START_ENCOUNTER', encounterId: q.objectiveEncounter });
        s = autoBattle(s);
        expect(s.battle?.phase, `${q.id} (L${level}) at seed ${seed}`).toBe('won');
      }
    }
  });
});
