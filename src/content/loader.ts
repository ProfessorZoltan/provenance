import type { ContentDB, RulesDef } from '../types/content';

// Every JSON file under /content is picked up here. A file may hold one object or an array of objects,
// each with an `id`. Adding a new character, encounter or node is a new file, not a code change.
const files = import.meta.glob('../../content/**/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;

const FOLDERS = [
  'characters', 'nodes', 'abilities', 'enemies', 'encounters', 'locations', 'eras',
  'scores', 'dialogues', 'timelineChoices', 'quests', 'shops', 'items',
] as const;

type Folder = (typeof FOLDERS)[number];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function buildContent(source: Record<string, unknown> = files): ContentDB {
  const db: Record<string, Record<string, unknown>> = {};
  for (const f of FOLDERS) db[f] = {};
  let rules: RulesDef | null = null;

  for (const [path, data] of Object.entries(source)) {
    const m = path.match(/content\/(?:([^/]+)\/)?([^/]+)\.json$/);
    if (!m) continue;
    const folder = m[1] as Folder | undefined;
    const file = m[2];
    if (!folder) {
      if (file === 'rules') rules = data as RulesDef;
      continue;
    }
    if (!FOLDERS.includes(folder)) throw new Error(`Unknown content folder "${folder}" in ${path}`);
    const entries = Array.isArray(data) ? data : [data];
    for (const entry of entries) {
      if (!isRecord(entry) || typeof entry.id !== 'string') {
        throw new Error(`Content in ${path} is missing an "id"`);
      }
      if (db[folder][entry.id]) throw new Error(`Duplicate ${folder} id "${entry.id}" (${path})`);
      db[folder][entry.id] = entry;
    }
  }
  if (!rules) throw new Error('content/rules.json is missing');
  const content = { ...(db as unknown as Omit<ContentDB, 'rules'>), rules };
  validate(content);
  return content;
}

function validate(c: ContentDB): void {
  const problems: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) problems.push(msg); };
  for (const ch of Object.values(c.characters)) {
    for (const a of ch.abilities) need(!!c.abilities[a], `character ${ch.id}: unknown ability ${a}`);
    need(ch.trunks.length === 3, `character ${ch.id}: needs three trunks`);
  }
  for (const n of Object.values(c.nodes)) {
    need(!!c.characters[n.character], `node ${n.id}: unknown character ${n.character}`);
    for (const r of n.requires) need(!!c.nodes[r], `node ${n.id}: unknown requirement ${r}`);
    for (const x of n.excludes) need(!!c.nodes[x], `node ${n.id}: unknown exclusion ${x}`);
    for (const e of n.effects) if (e.kind === 'ability') need(!!c.abilities[e.ability], `node ${n.id}: unknown ability ${e.ability}`);
    if (n.type === 'contradiction') need(n.excludes.length > 0, `node ${n.id}: contradiction needs an excludes`);
    if (n.type === 'condition') need(!!n.condition, `node ${n.id}: condition node needs a condition`);
  }
  for (const e of Object.values(c.enemies)) for (const a of e.abilities) need(!!c.abilities[a], `enemy ${e.id}: unknown ability ${a}`);
  for (const e of Object.values(c.encounters)) {
    for (const g of e.enemies) need(!!c.enemies[g.enemy], `encounter ${e.id}: unknown enemy ${g.enemy}`);
    need(!!c.scores[e.music], `encounter ${e.id}: unknown score ${e.music}`);
  }
  const questGivers = new Set(Object.values(c.quests).map((q) => q.giver));
  const npcOk = (id: string) => !!c.dialogues[id] || questGivers.has(id);
  for (const l of Object.values(c.locations)) {
    need(!!c.eras[l.era], `location ${l.id}: unknown era ${l.era}`);
    need(!!c.scores[l.music], `location ${l.id}: unknown score ${l.music}`);
    for (const n of l.npcs) need(npcOk(n), `location ${l.id}: unknown npc dialogue ${n}`);
    for (const q of l.quests) need(!!c.quests[q], `location ${l.id}: unknown quest ${q}`);
    for (const e of l.encounters) need(!!c.encounters[e], `location ${l.id}: unknown encounter ${e}`);
    for (const k of l.links) need(!!c.locations[k.to], `location ${l.id}: unknown link ${k.to}`);
    if (l.shop) need(!!c.shops[l.shop], `location ${l.id}: unknown shop ${l.shop}`);
    for (const v of l.variants ?? []) {
      if (v.shop) need(!!c.shops[v.shop], `location ${l.id}: unknown variant shop ${v.shop}`);
      for (const n of v.npcs) need(npcOk(n), `location ${l.id}: unknown variant npc ${n}`);
    }
  }
  for (const d of Object.values(c.dialogues)) for (const line of d.lines) {
    if (line.next) need(!!c.dialogues[line.next], `dialogue ${d.id}: unknown next ${line.next}`);
    for (const ch of line.choices ?? []) {
      if (ch.next) need(!!c.dialogues[ch.next], `dialogue ${d.id}: unknown choice next ${ch.next}`);
      if (ch.timelineChoice) need(!!c.timelineChoices[ch.timelineChoice], `dialogue ${d.id}: unknown timeline choice ${ch.timelineChoice}`);
    }
  }
  for (const q of Object.values(c.quests)) {
    need(!!c.encounters[q.objectiveEncounter], `quest ${q.id}: unknown encounter`);
    for (const k of ['offer', 'inProgress', 'complete'] as const) need(!!c.dialogues[q.dialogue[k]], `quest ${q.id}: unknown dialogue ${q.dialogue[k]}`);
    for (const i of q.rewards.items) need(!!c.items[i], `quest ${q.id}: unknown item ${i}`);
  }
  for (const s of Object.values(c.shops)) for (const st of s.stock) need(!!c.items[st.item], `shop ${s.id}: unknown item ${st.item}`);
  if (problems.length) throw new Error('Content validation failed:\n' + problems.join('\n'));
}

let cached: ContentDB | null = null;
export function getContent(): ContentDB {
  if (!cached) cached = buildContent();
  return cached;
}
