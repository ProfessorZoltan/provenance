// Wraps the packaged Windows app in an NSIS installer. Runs after scripts/pack-win.mjs, on the
// folder that produced, so the installer and the portable zip are the same bits.
import { stat, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const p = (...parts) => fileURLToPath(new URL(parts.join('/'), import.meta.url));

const ARCH = process.argv.includes('--ia32') ? 'ia32' : process.argv.includes('--arm64') ? 'arm64' : 'x64';
const appDir = p('..', 'build', 'win', `Provenance-win32-${ARCH}`);
const icon = p('..', 'build', 'icon.ico');

if (!existsSync(`${appDir}/Provenance.exe`)) {
  throw new Error(`${appDir} is missing: run \`node scripts/pack-win.mjs\` first`);
}
if (!existsSync(icon)) throw new Error('build/icon.ico is missing: run `npm run icon`');

const { version } = JSON.parse(await readFile(p('..', 'package.json'), 'utf8'));
const out = p('..', 'build', 'win', `Provenance-${version}-win32-${ARCH}-setup.exe`);
await mkdir(p('..', 'build', 'win'), { recursive: true });

// makensis wants Windows separators in the paths it bakes into the script.
const win = (s) => s.replaceAll('/', '\\');

console.log(`Compressing ${basename(appDir)} with LZMA — this takes a few minutes.`);
// The Windows build of makensis takes /SWITCH; the POSIX port takes -SWITCH.
const o = process.platform === 'win32' ? '/' : '-';
const { stdout } = await run('makensis', [
  `${o}V2`,
  `${o}DAPP_DIR=${win(appDir)}`,
  `${o}DOUT_FILE=${win(out)}`,
  `${o}DVERSION=${version}`,
  `${o}DARCH=${ARCH}`,
  `${o}DICON=${win(icon)}`,
  p('..', 'electron', 'installer.nsi'),
], { maxBuffer: 1 << 28 });
if (stdout.trim()) console.log(stdout.trim());

const { size } = await stat(out);
if (size < 20 * 1024 * 1024) throw new Error('the installer is too small to contain the game');
console.log(`${basename(out)} — ${(size / 1024 / 1024).toFixed(1)} MB`);
