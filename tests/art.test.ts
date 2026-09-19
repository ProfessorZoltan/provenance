import { describe, expect, it } from 'vitest';
import { artAssetUrl } from '../src/art/library';
import { rigSvg, portraitSvg, tokenSvg } from '../src/art/rigs';
import { pixelBackground, sceneAssetId } from '../src/art/pixel-backgrounds';
import { content } from './helpers';
import catalogPage from '../public/art/index.html?raw';

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
  it('takes each scene from the location content, variants included', () => {
    const village = content.locations.kell_village_2312;
    const armed = village.variants!.find((v) => v.when.includes('armedResistance'))!;
    const fell = village.variants!.find((v) => v.when.includes('letItFall'))!;
    expect(sceneAssetId(village, armed)).toBe('2312_kell_village_armed_resistance');
    expect(sceneAssetId(village, fell)).toBe('2312_kell_village_let_it_fall');
    expect(sceneAssetId(village, null)).toBe('2312_kell_village');
    // Every location names art the catalog actually holds.
    for (const loc of Object.values(content.locations)) {
      expect(artAssetUrl(loc.art, 'hub'), loc.id).toBeDefined();
      for (const v of loc.variants ?? []) if (v.art) expect(artAssetUrl(v.art, 'hub'), v.art).toBeDefined();
    }
    expect(pixelBackground('2031_meridian:sky', content.eras['2031'], [])).toContain('locations/deep-sites/2031/meridian/sky.svg');
    expect(artAssetUrl('missing-art', 'hub')).toBeUndefined();
  });
});

describe('the art directory page', () => {
  it('stays inlinable, so the offline export cannot silently break', () => {
    // scripts/art-export.mjs rewrites these two things; if the generator stops emitting them the
    // export would quietly produce a page full of broken images.
    expect(catalogPage, 'the entry data the detail dialog reads').toContain('const entries=');
    expect(catalogPage, 'card previews as plain relative <img src>').toMatch(/src="(?:characters|locations)\/[^"]+\.svg"/);
    expect(catalogPage, 'the file-list line the export relabels').toContain("a.textContent=role+' → '+file");
    expect(catalogPage, 'nothing is fetched at runtime').not.toContain('fetch(');
    expect(catalogPage, 'no remote dependencies to fail offline').not.toMatch(/(?:href|src)="https?:/);
  });

  it('lays the directory out for a phone as well as a desktop', () => {
    expect(catalogPage).toContain('name="viewport"');
    expect(catalogPage, 'a narrow-screen layout').toMatch(/@media\(max-width:700px\)/);
    expect(catalogPage, 'two columns rather than one on a phone').toContain('minmax(140px,1fr)');
  });
});
