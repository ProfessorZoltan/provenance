// Builds build/icon.ico from the game's own pixel art. The art is flat <rect> SVG on an integer
// grid, so it rasterises exactly by painting rectangles — no converter, no blurring, and the icon
// is the same pixels the player sees in the roster.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const SOURCE = new URL('../public/art/characters/auditor/auditor_portrait.svg', import.meta.url);
const OUT = new URL('../build/icon.ico', import.meta.url);
const SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Paint every <rect> in document order onto a grid the size of the viewBox. */
function rasterise(svg) {
  const [, , vw, vh] = /viewBox="([^"]+)"/.exec(svg)[1].split(/\s+/).map(Number);
  const grid = new Uint8Array(vw * vh * 4);
  for (const m of svg.matchAll(/<rect\s([^>]*)\/?>/g)) {
    const at = (k) => {
      const v = new RegExp(`${k}="([^"]*)"`).exec(m[1]);
      return v ? v[1] : null;
    };
    const fill = at('fill');
    if (!fill || fill === 'none') continue;
    const [r, g, b] = hex(fill);
    const x0 = Number(at('x') ?? 0), y0 = Number(at('y') ?? 0);
    const w = Number(at('width') ?? 0), h = Number(at('height') ?? 0);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
        const i = (y * vw + x) * 4;
        grid[i] = r; grid[i + 1] = g; grid[i + 2] = b; grid[i + 3] = 255;
      }
    }
  }
  return { grid, width: vw, height: vh };
}

function hex(s) {
  const v = s.trim().replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Nearest neighbour, so a pixel stays a pixel at every size Windows asks for. */
function scale(src, size) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / size));
    for (let x = 0; x < size; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / size));
      const s = (sy * src.width + sx) * 4, d = (y * size + x) * 4;
      out[d] = src.grid[s]; out[d + 1] = src.grid[s + 1]; out[d + 2] = src.grid[s + 2]; out[d + 3] = src.grid[s + 3];
    }
  }
  return out;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;      // bit depth
  ihdr[9] = 6;      // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;   // filter: none
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const art = rasterise(await readFile(SOURCE, 'utf8'));
const images = SIZES.map((size) => ({ size, png: png(scale(art, size), size) }));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);            // 1 = icon
header.writeUInt16LE(images.length, 4);
let offset = 6 + images.length * 16;
const dir = [];
for (const img of images) {
  const e = Buffer.alloc(16);
  e[0] = img.size >= 256 ? 0 : img.size;  // 256 is written as 0
  e[1] = img.size >= 256 ? 0 : img.size;
  e[4] = 1;                                // colour planes
  e.writeUInt16LE(32, 6);                  // bits per pixel
  e.writeUInt32LE(img.png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += img.png.length;
  dir.push(e);
}

await mkdir(new URL('../build/', import.meta.url), { recursive: true });
await writeFile(OUT, Buffer.concat([header, ...dir, ...images.map((i) => i.png)]));
console.log(`build/icon.ico — ${images.length} sizes (${SIZES.join(', ')}), ${(offset / 1024).toFixed(1)} KB`);
