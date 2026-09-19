import catalog from './catalog.json';
export type ArtEntry = { id: string; kind: string; name: string; era: string | null; site: string | null; files: Record<string, string | undefined> };
export const artEntries = catalog as ArtEntry[];
const byId = new Map(artEntries.map(entry => [entry.id, entry]));
export function artAssetUrl(id: string, role: string): string | undefined {
  const file = byId.get(id)?.files[role];
  return file ? `${import.meta.env.BASE_URL}art/${file}` : undefined;
}
/** Embed a standalone pixel SVG without injecting content or leaking shared SVG IDs. */
export function librarySvg(id: string, role: string, viewBox = '0 0 32 40', className = 'rig'): string | undefined {
  const url = artAssetUrl(id, role);
  if (!url) return undefined;
  const [, , w, h] = viewBox.split(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="${className}" shape-rendering="crispEdges" aria-label="${id.replaceAll('_', ' ')}"><image href="${url}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" style="image-rendering:pixelated"/></svg>`;
}
