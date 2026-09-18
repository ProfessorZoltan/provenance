// Tiny expression evaluator for ability formulas: numbers, identifiers with dots, + - * /, parentheses,
// unary minus and min()/max(). Context values are looked up by dotted path, e.g. "a.grit".

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/(),'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`Bad character "${c}" in formula "${src}"`);
  }
  return out;
}

export type FormulaContext = Record<string, unknown>;

function lookup(ctx: FormulaContext, path: string): number {
  let cur: unknown = ctx;
  for (const part of path.split('.')) {
    if (typeof cur !== 'object' || cur === null) return 0;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'number' ? cur : 0;
}

export function evalFormula(src: string, ctx: FormulaContext): number {
  const toks = tokenize(src);
  let pos = 0;
  const peek = () => toks[pos];
  const take = () => toks[pos++];

  function primary(): number {
    const tok = take();
    if (!tok) throw new Error(`Unexpected end of formula "${src}"`);
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'id') {
      if ((tok.v === 'min' || tok.v === 'max') && peek()?.t === 'op' && peek().v === '(') {
        take();
        const args: number[] = [expr()];
        while (peek()?.t === 'op' && peek().v === ',') { take(); args.push(expr()); }
        const close = take();
        if (!close || close.t !== 'op' || close.v !== ')') throw new Error(`Expected ) in "${src}"`);
        return tok.v === 'min' ? Math.min(...args) : Math.max(...args);
      }
      return lookup(ctx, tok.v);
    }
    if (tok.v === '(') {
      const v = expr();
      const close = take();
      if (!close || close.t !== 'op' || close.v !== ')') throw new Error(`Expected ) in "${src}"`);
      return v;
    }
    if (tok.v === '-') return -primary();
    throw new Error(`Unexpected token "${tok.v}" in "${src}"`);
  }
  function term(): number {
    let v = primary();
    while (peek()?.t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = take().v;
      const r = primary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = take().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const result = expr();
  if (pos !== toks.length) throw new Error(`Trailing tokens in formula "${src}"`);
  return result;
}
