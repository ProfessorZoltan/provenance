import { describe, expect, it } from 'vitest';
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
    expect(tempo.html).toContain('2 points for every thread');
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
