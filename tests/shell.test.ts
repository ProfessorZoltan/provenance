import { describe, expect, it } from 'vitest';
import appSource from '../src/ui/app.ts?raw';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const screensDir = fileURLToPath(new URL('../src/ui/screens', import.meta.url));

describe('screens that send the player somewhere else', () => {
  /**
   * Several screens have nothing to show in some states and dispatch their way out while still
   * rendering. That runs render() again from inside itself: the inner call draws the real screen
   * and installs its handle, then the outer call returns a no-op stub. Without a guard the stub
   * overwrote the live handle and every button went dead until something forced another render --
   * which a keyboard press does, by changing the input device, and a gamepad press does not.
   */
  it('exist, so the re-entrancy is real and not hypothetical', () => {
    const offenders = readdirSync(screensDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /dispatch\([^)]*\);\s*return \{ input\(\) \{\} \}/.test(readFileSync(`${screensDir}/${f}`, 'utf8')));
    expect(offenders.length, 'screens that dispatch mid-render').toBeGreaterThan(0);
  });

  it('cannot leave the shell holding a stale handle', () => {
    // A render id taken on entry and checked before the handle is assigned.
    expect(appSource).toMatch(/const id = \+\+renderId;/);
    expect(appSource, 'the handle is assigned only when this render is still the current one')
      .toMatch(/if \(id !== renderId\) return;\s*\n\s*handle = next;/);
  });

  it('clears the old handle before rendering, so nothing is destroyed twice', () => {
    expect(appSource).toMatch(/handle\?\.destroy\?\.\(\);\s*\n\s*handle = null;/);
  });
});

describe('the rewards screen', () => {
  const source = readFileSync(`${screensDir}/scan.ts`, 'utf8');

  it('ignores input for a moment, so the press that cleared the narration does not skip it', () => {
    expect(source).toMatch(/SPOILS_GRACE_MS\s*=\s*\d{3}/);
    expect(source, 'the guard has to sit in front of the dispatch').toMatch(/if \(settled\(\)\)/);
  });

  it('times the grace period from the fight, not from each render', () => {
    // Re-rendering on a device change must not restart the wait, or a gamepad could never leave.
    expect(source).toMatch(/spoilsKey !== key/);
  });
});
