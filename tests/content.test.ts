import { describe, expect, it } from 'vitest';
import { content } from './helpers';

describe('content', () => {
  it('loads every slice folder', () => {
    expect(Object.keys(content.characters).sort()).toEqual(['dax', 'player', 'wren']);
    expect(Object.keys(content.encounters)).toHaveLength(5);
    expect(Object.keys(content.enemies).sort()).toEqual(['drone_hunter', 'drone_sentry', 'echo_kell', 'warden_2148']);
    expect(Object.keys(content.scores)).toHaveLength(4);
    expect(Object.keys(content.timelineChoices).sort()).toEqual(['arm_resistance', 'let_it_fall']);
  });

  it('gives each character 12 nodes with one condition node and one contradiction pair', () => {
    for (const id of Object.keys(content.characters)) {
      const nodes = Object.values(content.nodes).filter((n) => n.character === id);
      expect(nodes, id).toHaveLength(12);
      expect(nodes.filter((n) => n.type === 'condition'), id).toHaveLength(1);
      const contradictions = nodes.filter((n) => n.type === 'contradiction');
      expect(contradictions, id).toHaveLength(2);
      expect(contradictions[0].excludes).toContain(contradictions[1].id);
      expect(contradictions[1].excludes).toContain(contradictions[0].id);
    }
  });

  it('has exactly one surprise-only encounter in the slice', () => {
    expect(Object.values(content.encounters).filter((e) => e.surprise === 'always')).toHaveLength(1);
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
