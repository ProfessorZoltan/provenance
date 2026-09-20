// Generates docs/CASE_LOG_AND_TIMELINE.md from the content itself, so the reference cannot drift
// away from the game. Run it with `npm run reference`.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (dir) => readdirSync(`${root}content/${dir}`)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => {
    const j = JSON.parse(readFileSync(`${root}content/${dir}/${f}`, 'utf8'));
    return Array.isArray(j) ? j : [j];
  });

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const locations = byId(load('locations'));
const dialogues = byId(load('dialogues'));
const encounters = byId(load('encounters'));
const quests = byId(load('quests'));
const timeline = byId(load('timelineChoices'));
const log = JSON.parse(readFileSync(`${root}content/log/case.json`, 'utf8'));
const rooms = byId(load('rooms'));
const eras = byId(load('eras'));

// ---------- where a conversation can be reached ----------

/** Every dialogue a location can open directly: its story beat, its people, its actions. */
function rootsFor(loc) {
  const out = new Set();
  if (loc.storyDialogue) out.add(loc.storyDialogue);
  for (const npc of loc.npcs ?? []) {
    out.add(npc);
    if (dialogues[`${npc}_after`]) out.add(`${npc}_after`);
    for (const q of Object.values(quests)) {
      if (q.giver !== npc) continue;
      for (const d of Object.values(q.dialogue ?? {})) out.add(d);
    }
  }
  for (const a of loc.actions ?? []) out.add(a.dialogue);
  for (const v of loc.variants ?? []) {
    for (const npc of v.npcs ?? []) out.add(npc);
    for (const a of v.actions ?? []) out.add(a.dialogue);
  }
  return [...out].filter((d) => dialogues[d]);
}

/** Follow `next` from a dialogue so a flag set three lines deep still names the place it happens. */
function reach(start, seen = new Set()) {
  if (!dialogues[start] || seen.has(start)) return seen;
  seen.add(start);
  for (const line of dialogues[start].lines ?? []) {
    if (line.next) reach(line.next, seen);
    for (const c of line.choices ?? []) if (c.next) reach(c.next, seen);
  }
  return seen;
}

const placeOf = {};
for (const loc of Object.values(locations)) {
  for (const r of rootsFor(loc)) {
    for (const d of reach(r)) (placeOf[d] ??= new Set()).add(loc.id);
  }
}
// A room's props are conversations too: the prologue's entire investigation is a desk and a door.
for (const room of Object.values(rooms)) {
  const starts = [room.storyDialogue, ...(room.props ?? []).map((p) => p.dialogue)].filter(Boolean);
  for (const r of starts) for (const d of reach(r)) (placeOf[d] ??= new Set()).add(room.id);
}
const nameOf = (id) => locations[id]?.name ?? rooms[id]?.name ?? id;
const where = (d) => [...(placeOf[d] ?? [])].map(nameOf).sort();

// The display names live with the reducer, which is the only place that knows them.
const NPC_NAMES = Object.fromEntries(
  [...readFileSync(`${root}src/core/reducer.ts`, 'utf8')
    .slice(readFileSync(`${root}src/core/reducer.ts`, 'utf8').indexOf('NPC_NAMES'))
    .matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));

/** Who a conversation belongs to, when it is somebody rather than something. */
const npcOf = {};
for (const loc of Object.values(locations)) {
  for (const npc of [...(loc.npcs ?? []), ...(loc.variants ?? []).flatMap((v) => v.npcs ?? [])]) {
    npcOf[npc] = NPC_NAMES[npc] ?? npc;
    if (dialogues[`${npc}_after`]) npcOf[`${npc}_after`] = NPC_NAMES[npc] ?? npc;
    for (const q of Object.values(quests)) {
      if (q.giver !== npc) continue;
      for (const d of Object.values(q.dialogue ?? {})) npcOf[d] = NPC_NAMES[npc] ?? npc;
    }
  }
}
const storyOf = new Set(Object.values(locations).map((l) => l.storyDialogue).filter(Boolean));

/** Props are labelled in the room, so name the thing the player walks up to. */
const propLabel = {};
for (const room of Object.values(rooms)) {
  for (const prop of room.props ?? []) if (prop.dialogue && prop.label) propLabel[prop.dialogue] = prop.label;
}

/** The words on the button that opens a conversation, for the ones reached by choosing something. */
const entryChoice = {};
for (const d of Object.values(dialogues)) {
  for (const line of d.lines ?? []) {
    for (const c of line.choices ?? []) if (c.next && c.text) entryChoice[c.next] ??= c.text;
    if (line.next) entryChoice[line.next] ??= null;
  }
}

// ---------- what sets each flag ----------

const setters = {};
const add = (flag, how) => ((setters[flag] ??= []).push(how));

for (const d of Object.values(dialogues)) {
  const at = where(d.id);
  const place = at.length ? at.join(' / ') : null;
  for (const line of d.lines ?? []) {
    for (const f of line.setFlags ?? []) add(f, { kind: 'talk', dialogue: d.id, place, speaker: line.speaker });
    for (const c of line.choices ?? []) {
      for (const f of c.setFlags ?? []) add(f, { kind: 'choose', dialogue: d.id, place, choice: c.text });
      if (c.timelineChoice) {
        const t = timeline[c.timelineChoice];
        for (const f of [...(t?.flags ?? []), ...(t?.partyEffects ?? [])]) {
          add(f, { kind: 'edit', dialogue: d.id, place, choice: c.text, edit: c.timelineChoice });
        }
      }
    }
  }
}
for (const e of Object.values(encounters)) {
  for (const f of e.rewardFlags ?? []) add(f, { kind: 'fight', encounter: e.id, name: e.name, place: locations[e.location]?.name ?? e.location });
}
for (const q of Object.values(quests)) {
  for (const f of q.rewards?.flags ?? []) add(f, { kind: 'quest', quest: q.id, name: q.name, place: locations[q.location]?.name ?? q.location });
}

// Flags the engine keeps, which no content file mentions.
function systemicNote(flag) {
  const arg = flag.slice(flag.indexOf(':') + 1);
  if (flag.startsWith('been:')) return `travel to **${nameOf(arg)}**`;
  if (flag.startsWith('seen:')) {
    const at = where(arg);
    const named = propLabel[arg] ?? entryChoice[arg];
    const place = at.length ? ` at ${at.join(' / ')}` : '';
    return named ? `examine **${named}**${place}` : `open the conversation **${arg}**${place}`;
  }
  if (flag.startsWith('recruited:')) return `recruit **${arg}**`;
  if (flag.startsWith('trained:')) return `have the trainer at **${arg}** pay out`;
  if (flag.startsWith('lean:')) return `start the run on the **${arg}** stance`;
  if (flag.startsWith('surpriseCancelled:')) return `have a high-Noise member cancel an ambush at ${arg}`;
  const fixed = {
    fleeing: 'be in flight from the Allocation Office, before reaching Kell',
    prologue: 'be in the prologue',
    runFinished: 'beat the chair',
    metParty: 'meet Wren and Dax at Kell',
    survivedSurprise: 'win a fight the party did not start',
    killedWardenWithoutSignal: 'put down a Warden without using a Signal ability',
    facedOwnEcho: 'let Entropy cross 70 and fight the Echo it opens',
  };
  return fixed[flag] ?? null;
}

/** Turn one condition into something a player could act on. */
function explain(cond) {
  const c = cond.trim();
  if (c.startsWith('!')) return `NOT: ${explain(c.slice(1))}`;
  const cmp = /^(signal|noise|sync|ownership|entropy|continuity)\s*(>=|<=|>|<|==)\s*(-?\d+)$/.exec(c);
  if (cmp) {
    const of = { signal: 'the party\'s best Signal', noise: 'the party\'s best Noise', sync: 'party Sync',
      ownership: 'Ownership', entropy: 'Entropy', continuity: 'the lowest Continuity in the party' }[cmp[1]];
    return `${of} ${cmp[2]} ${cmp[3]}`;
  }
  const [kind, ...rest] = c.split(':');
  const arg = rest.join(':');
  if (kind === 'party') return `${arg} is in the active party`;
  if (kind === 'visited') return `the party has been to ${arg}`;
  if (kind === 'era') return `standing in ${arg}`;
  if (kind === 'quest') {
    const [id, status] = arg.split(':');
    return `the quest "${quests[id]?.name ?? id}" is ${status}`;
  }
  const flag = kind === 'flag' ? arg : c;
  const note = systemicNote(flag);
  if (note) return note;
  const from = setters[flag];
  if (!from?.length) return `the flag \`${flag}\` (nothing in the content sets this)`;
  return from.map((s) => {
    if (s.kind === 'fight') return `win **${s.name}** at ${s.place}`;
    if (s.kind === 'quest') return `finish the quest **${s.name}** at ${s.place}`;
    if (s.kind === 'edit') return `choose **"${s.choice}"** (${timeline[s.edit]?.name}) at ${s.place ?? s.dialogue}`;
    if (s.kind === 'choose') return `answer **"${s.choice}"** at ${s.place ?? s.dialogue}`;
    const door = propLabel[s.dialogue] ?? entryChoice[s.dialogue];
    const at = s.place ? ` at ${s.place}` : '';
    const verb = propLabel[s.dialogue] ? 'examine' : 'choose';
    if (door) return `${verb} **${propLabel[s.dialogue] ? door : `"${door}"`}**${at}`;
    if (npcOf[s.dialogue]) return `talk to **${npcOf[s.dialogue]}**${at}`;
    if (storyOf.has(s.dialogue)) return `arrive${at} and hear the scene out`;
    return `hear out the conversation${at}`;
  }).join(', or ');
}

// ---------- the document ----------

const esc = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const out = [];
out.push('# The case log and the timeline\n');
out.push('Generated from `content/` by `npm run reference`. Everything here is what the game');
out.push('actually checks, not what it was meant to check.\n');

// Timeline first: it is what the run is about.
out.push('## Timeline edits\n');
out.push('Twenty-one edits across seven sites. Each one moves Ownership and Sync, which decide the');
out.push('ending, and most decide who exists to stand beside you. The rule that governs them: for');
out.push('any one site, an edit made later in play at an **earlier** era erases every edit you had');
out.push('made at that site in later eras. Editing 2031 last throws away your 2148.\n');
out.push('| Edit | Site | Era | Ownership | Sync | What it does to the party | How the player gets there |');
out.push('| --- | --- | --- | --- | --- | --- | --- |');
const offers = {};
for (const d of Object.values(dialogues)) {
  for (const line of d.lines ?? []) for (const c of line.choices ?? []) {
    if (!c.timelineChoice) continue;
    const list = (offers[c.timelineChoice] ??= []);
    const place = where(d.id);
    const key = `${place.join('/')}:${c.text}`;
    if (!list.some((x) => x.key === key)) list.push({ key, dialogue: d.id, text: c.text, place });
  }
}
for (const t of Object.values(timeline).sort((a, b) => a.site.localeCompare(b.site) || a.era.localeCompare(b.era))) {
  const o = offers[t.id] ?? [];
  const how = o.length
    ? o.map((x) => `${x.place.length ? x.place.join(' / ') : x.dialogue}: choose "${esc(x.text)}"`).join('; ')
    : '(not offered by any conversation)';
  const party = (t.partyEffects ?? []).length ? t.partyEffects.join(', ') : '—';
  out.push(`| **${esc(t.name)}** | ${t.site} | ${t.era} | ${t.ownershipDelta >= 0 ? '+' : ''}${t.ownershipDelta} | ${t.syncDelta >= 0 ? '+' : ''}${t.syncDelta} | ${esc(party)} | ${esc(how)} |`);
}

out.push('\n## The case log\n');
out.push(`${log.length} entries. An entry appears the moment every condition in its row holds, and`);
out.push('is struck through if a later edit stops that being true.\n');
const cats = [...new Set(log.map((e) => e.category))];
for (const cat of cats) {
  const rows = log.filter((e) => e.category === cat).sort((a, b) => a.order - b.order);
  out.push(`\n### ${cat[0].toUpperCase()}${cat.slice(1)} (${rows.length})\n`);
  out.push('| Entry | What it says | What the player must do | Where the game says it came from |');
  out.push('| --- | --- | --- | --- |');
  for (const e of rows) {
    const how = (e.when ?? []).map(explain).join(' **and** ');
    out.push(`| **${esc(e.title)}** | ${esc(e.detail)} | ${esc(how)} | ${esc(e.source)} |`);
  }
}

out.push('\n## Endings\n');
out.push('| Ending | Condition | Source |');
out.push('| --- | --- | --- |');
const ENDINGS = [
  ['Reconciled', 'Ownership >= 50 and young Strand recruited in 2031'],
  ['The Commons', 'Ownership >= 50 and Sync between -30 and +30'],
  ['The Gift', 'Sync >= 60 and Ownership < 50'],
  ['The Silence', 'Sync <= -60'],
  ['Perpetuity', 'anything else'],
];
for (const [name, cond] of ENDINGS) {
  out.push(`| **${name}** | ${esc(cond)} | \`endingFor\` in src/core/timeline.ts |`);
}

writeFileSync(`${root}docs/CASE_LOG_AND_TIMELINE.md`, `${out.join('\n')}\n`);
console.log(`docs/CASE_LOG_AND_TIMELINE.md — ${log.length} log entries, ${Object.keys(timeline).length} timeline edits`);
const unexplained = log.flatMap((e) => e.when ?? []).filter((c) => explain(c).includes('nothing in the content sets this'));
if (unexplained.length) console.log('unreachable conditions:', [...new Set(unexplained)].join(', '));
