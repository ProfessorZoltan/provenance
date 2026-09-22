import { describe, expect, it } from 'vitest';
import { content } from './helpers';
import { manualEntries, manualPages, manualTitle, parseManual } from '../src/ui/manual';

describe('player manual', () => {
  it('parses the shipped document into navigable sections', () => {
    expect(manualTitle).toContain('Player Manual');
    expect(manualPages.length).toBeGreaterThan(10);
    const titles = manualEntries.map((e) => e.title);
    for (const want of ['The world', 'Controls', 'Battles', 'Tempo', 'Entropy', 'Stats', 'Shields']) {
      expect(titles, want).toContain(want);
    }
    // Every selectable page has prose, and nothing selectable is an empty heading.
    for (const p of manualPages) expect(p.html.length, p.title).toBeGreaterThan(0);
    expect(manualPages.every((p) => !p.group)).toBe(true);
    expect(manualEntries.filter((e) => !e.group).length).toBe(manualPages.length);
  });

  it('documents the systems the game now has', () => {
    const all = manualPages.map((p) => p.html).join(' ');
    for (const term of ['Construct', 'benched', 'ILO-9', 'Weapon', 'downstream']) {
      expect(all, term).toContain(term);
    }
  });

  it('explains the Tempo abilities the player asked about', () => {
    const tempo = manualPages.find((p) => p.title === 'Tempo')!;
    expect(tempo.html).toContain('Rewind');
    expect(tempo.html).toContain('Fork');
    expect(tempo.html).toContain('every time an enemy lands a hit');
    // The Entropy prices printed here are what the engine actually charges, scale included.
    const charged = (n: number) => `+${Math.round(n * content.rules.damageScale)}`;
    expect(tempo.html, 'Fork').toContain(charged(content.rules.fork.entropy));
    expect(tempo.html, 'Rewind').toContain(charged(content.rules.rewind.entropy));
    expect(tempo.html, 'Echo').toContain(charged(content.rules.echo.entropy));
    expect(tempo.html, 'Collapse').toContain(charged(content.rules.collapse.entropy));
  });

  it('renders headings, paragraphs, bold, lists and tables', () => {
    const { entries } = parseManual([
      '# Title',
      '## First',
      'A **bold** claim',
      'wrapped over two lines.',
      '',
      '- one',
      '- two',
      '',
      '| Head | Other |',
      '| --- | --- |',
      '| a | b |',
      '',
      '#### Deep',
      '## Group',
      '### Child',
      'Body.',
    ].join('\n'));
    const first = entries[0];
    expect(first.html).toContain('<p>A <strong>bold</strong> claim wrapped over two lines.</p>');
    expect(first.html).toContain('<ul><li>one</li><li>two</li></ul>');
    expect(first.html).toContain('<thead><tr><th>Head</th><th>Other</th></tr></thead>');
    expect(first.html).toContain('<tbody><tr><td>a</td><td>b</td></tr></tbody>');
    expect(first.html).toContain('<h4>Deep</h4>');
    expect(entries.find((e) => e.title === 'Group')?.group).toBe(true);
    expect(entries.find((e) => e.title === 'Child')?.level).toBe(3);
  });

  it('drops the header row of a layout table that has no headings', () => {
    const { entries } = parseManual(['## S', '| | |', '| --- | --- |', '| Fills | fast |'].join('\n'));
    expect(entries[0].html).not.toContain('<thead>');
    expect(entries[0].html).toContain('<td>Fills</td>');
  });

  it('escapes markup in the source so the document cannot inject HTML', () => {
    const { entries } = parseManual(['## S', 'A <script>alert(1)</script> & "quoted" line.'].join('\n'));
    expect(entries[0].html).not.toContain('<script>');
    expect(entries[0].html).toContain('&lt;script&gt;');
    expect(entries[0].html).toContain('&amp;');
  });
});

describe('the difficulty page', () => {
  it('prints the numbers each setting actually uses', async () => {
    const { difficulty, DIFFICULTIES } = await import('../src/core/difficulty');
    const page = manualPages.find((p) => p.title === 'Difficulty')!;
    expect(page).toBeTruthy();
    for (const id of DIFFICULTIES) {
      const d = difficulty(content, id);
      const row = page.html.split('<tr>').find((r) => r.includes(`>${d.name}<`))!;
      expect(row, d.name).toBeTruthy();
      const cells = [...row.matchAll(/<td>(.*?)<\/td>/g)].map((m) => m[1]);
      expect(cells[1], `${d.name} enemy hits`).toBe(`×${d.enemyDamage}`);
      expect(cells[2], `${d.name} enemy Resolve`).toBe(`×${d.enemyResolve}`);
      expect(cells[3], `${d.name} bed`).toBe(String(d.restPerLevel));
      expect(cells[4], `${d.name} camps`).toBe(String(d.campsPerEra));
      expect(cells[5], `${d.name} rewinds`).toBe(String(d.rewinds));
    }
  });
});
