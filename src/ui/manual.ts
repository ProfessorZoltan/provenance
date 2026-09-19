// The player manual is rendered from docs/PLAYER_MANUAL.md so the file in the repository and the
// screen in the game can never drift apart. Only the subset of Markdown that file uses is
// supported: headings, paragraphs, bullet lists, tables and bold.

import source from '../../docs/PLAYER_MANUAL.md?raw';

export interface ManualEntry {
  id: string;
  title: string;
  level: 2 | 3;
  html: string;
  /** A heading with no prose of its own: shown in the table of contents, not selectable. */
  group: boolean;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
}

function inline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function renderBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith('#### ')) { out.push(`<h4>${inline(line.slice(5))}</h4>`); i++; continue; }

    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
      const head = rows[0] ?? [];
      // Row 1 is the --- separator; a header of only empty cells is a layout table, not a headed one.
      const body = rows.slice(2);
      const headed = head.some((c) => c.length > 0);
      const thead = headed ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : '';
      const tbody = body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<table>${thead}<tbody>${tbody}</tbody></table>`);
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) { items.push(lines[i].slice(2)); i++; }
      out.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim() || l.startsWith('#') || l.trim().startsWith('|') || l.startsWith('- ')) break;
      para.push(l.trim());
      i++;
    }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parse(md: string): { title: string; entries: ManualEntry[] } {
  const lines = md.split(/\r?\n/);
  let title = 'Player manual';
  const entries: ManualEntry[] = [];
  let current: { title: string; level: 2 | 3; body: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const html = renderBlocks(current.body);
    entries.push({ id: slug(current.title), title: current.title, level: current.level, html, group: html === '' });
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('# ')) { title = line.slice(2).trim(); continue; }
    if (line.startsWith('## ')) { flush(); current = { title: line.slice(3).trim(), level: 2, body: [] }; continue; }
    if (line.startsWith('### ')) { flush(); current = { title: line.slice(4).trim(), level: 3, body: [] }; continue; }
    if (current) current.body.push(line);
  }
  flush();
  return { title, entries };
}

const parsed = parse(source);

export const manualTitle = parsed.title;
export const manualEntries = parsed.entries;
/** The entries a player can open; group headings are skipped. */
export const manualPages = parsed.entries.filter((e) => !e.group);

export { parse as parseManual };
