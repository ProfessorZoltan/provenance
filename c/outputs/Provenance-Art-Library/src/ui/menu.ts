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

/** A focusable vertical list. Up/Down move, A selects, a shortcut button selects directly, clicks work too. */
export function menu(items: MenuItem[], start = 0, onChange?: (i: number) => void): MenuHandle {
  const el = document.createElement('ul');
  el.className = 'menu';
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
      if (btn === 'up') { handle.focus(index - 1); return true; }
      if (btn === 'down') { handle.focus(index + 1); return true; }
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

/** A horizontal focus group (cards, tabs). Left/Right move. */
export function cycle(count: number, index: number, btn: Button): number {
  if (btn === 'left' || btn === 'lb') return (index - 1 + count) % count;
  if (btn === 'right' || btn === 'rb') return (index + 1) % count;
  return index;
}
