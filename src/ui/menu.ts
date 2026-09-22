import type { Button } from '../input/input';
import { glyph } from '../input/prompts';

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
  cost?: string;
  disabled?: boolean;
  shortcut?: Button;
  onSelect?: () => void;
}

export interface MenuHandle {
  el: HTMLUListElement;
  index: number;
  focus(i: number): void;
  input(btn: Button): boolean;
  current(): MenuItem | undefined;
}

/**
 * A focusable list. Up/Down move, A selects, a shortcut button selects directly, clicks work too.
 * With `columns` above one it lays out as a grid read left to right: Up/Down move a row, Left/Right
 * move along it, so a long list fits a short box without scrolling.
 */
export function menu(items: MenuItem[], start = 0, onChange?: (i: number) => void, opts: { columns?: number } = {}): MenuHandle {
  const cols = Math.max(1, opts.columns ?? 1);
  const el = document.createElement('ul');
  el.className = cols > 1 ? `menu cols cols-${cols}` : 'menu';
  el.setAttribute('role', 'listbox');
  let index = Math.min(Math.max(0, start), Math.max(0, items.length - 1));

  const render = () => {
    el.innerHTML = '';
    items.forEach((it, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === index));
      li.className = (i === index ? 'focused ' : '') + (it.disabled ? 'disabled' : '');
      li.innerHTML = `<span class="lbl">${it.shortcut ? glyph(it.shortcut) : i === index ? glyph('a') : '<span class="glyph" style="visibility:hidden">A</span>'}<span>${it.label}</span>${it.cost ? `<span class="cost">${it.cost}</span>` : ''}</span>${it.hint ? `<span class="hint">${it.hint}</span>` : ''}`;
      li.addEventListener('click', () => { handle.focus(i); select(); });
      el.appendChild(li);
    });
    el.querySelector('.focused')?.scrollIntoView({ block: 'nearest' });
  };
  const select = () => {
    const it = items[index];
    if (!it || it.disabled) return;
    it.onSelect?.();
  };
  const handle: MenuHandle = {
    el,
    get index() { return index; },
    set index(v: number) { index = v; },
    focus(i) {
      if (!items.length) return;
      index = ((i % items.length) + items.length) % items.length;
      render();
      onChange?.(index);
    },
    input(btn) {
      const to = gridStep(index, items.length, cols, btn);
      if (to !== null) { handle.focus(to); return true; }
      if (btn === 'a') { select(); return true; }
      const sc = items.find((it) => it.shortcut === btn);
      if (sc && !sc.disabled) { sc.onSelect?.(); return true; }
      return false;
    },
    current: () => items[index],
  };
  render();
  return handle;
}

/**
 * Where a direction moves focus in a list laid out `cols` wide, read left to right; null when the
 * button is not a direction the list uses. One column: Up/Down step and wrap. More: Up/Down move a
 * row in the same column, wrapping to the far end of that column; Left/Right step along the list.
 */
export function gridStep(index: number, count: number, cols: number, btn: Button): number | null {
  if (count <= 0) return null;
  const wrap = (i: number) => ((i % count) + count) % count;
  if (cols <= 1) {
    if (btn === 'up') return wrap(index - 1);
    if (btn === 'down') return wrap(index + 1);
    return null;
  }
  if (btn === 'up') return index - cols >= 0 ? index - cols : index + cols * Math.floor((count - 1 - index) / cols);
  if (btn === 'down') return index + cols < count ? index + cols : index % cols;
  if (btn === 'left') return wrap(index - 1);
  if (btn === 'right') return wrap(index + 1);
  return null;
}

/** A horizontal focus group (cards, tabs). Left/Right move. */
export function cycle(count: number, index: number, btn: Button): number {
  if (btn === 'left' || btn === 'lb') return (index - 1 + count) % count;
  if (btn === 'right' || btn === 'rb') return (index + 1) % count;
  return index;
}
