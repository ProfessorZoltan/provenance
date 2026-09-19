import { describe, expect, it } from 'vitest';
import { artAssetUrl } from '../src/art/library';
import { rigSvg, portraitSvg, tokenSvg } from '../src/art/rigs';
import { pixelBackground, sceneAssetId } from '../src/art/pixel-backgrounds';
import { content } from './helpers';

describe('art library integration', () => {
  it('resolves each party deliverable and swaps actual pose files', () => {
    for (const id of ['auditor','wren','dax','ilo9','mara','hale','quiroga','strand_young']) {
      expect(rigSvg(id, '#fff', '#fff', 'down')).toContain(`${id}_down.svg`);
      expect(portraitSvg(id, '#fff')).toContain(`${id}_portrait.svg`);
      expect(tokenSvg(id, '#fff')).toContain(`${id}_token.svg`);
    }
  });
  it('keeps legacy rig IDs compatible and uses authored Echo skins', () => {
    expect(rigSvg('drone_sentry', '#fff')).toContain('drone_sentry_2312');
    expect(rigSvg('warden', '#fff')).toContain('warden_2148');
    expect(rigSvg('wren', '#fff', '#fff', 'idle', true, '2148')).toContain('wren_echo_2148_idle.svg');
  });
  it('selects visible timeline variants without conflating flag names with catalog IDs', () => {
    expect(sceneAssetId('kell_village_2312', ['armedResistance'])).toBe('2312_kell_village_armed_resistance');
    expect(sceneAssetId('kell_village_2312', ['letItFall'])).toBe('2312_kell_village_let_it_fall');
    expect(sceneAssetId('kell_village_2312', [])).toBe('2312_kell_village');
    expect(pixelBackground('2031_meridian:sky', content.eras['2031'], [])).toContain('locations/deep-sites/2031/meridian/sky.svg');
    expect(artAssetUrl('missing-art', 'hub')).toBeUndefined();
  });
});
