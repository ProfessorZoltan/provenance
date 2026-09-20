// Packages the built game as a native Windows application. Stages only what ships — the desktop
// shell and dist/ — so the release carries no source, no tests and no node_modules.
import { cp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packager } from '@electron/packager';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const p = (...parts) => fileURLToPath(new URL(parts.join('/'), import.meta.url));

const ARCH = process.argv.includes('--ia32') ? 'ia32' : process.argv.includes('--arm64') ? 'arm64' : 'x64';
const stage = p('..', 'build', 'app');
const out = p('..', 'build', 'win');

if (!existsSync(p('..', 'dist', 'index.html'))) {
  throw new Error('dist/ is missing: run `npm run build` first');
}

const pkg = JSON.parse(await readFile(p('..', 'package.json'), 'utf8'));
const shell = JSON.parse(await readFile(p('..', 'electron', 'package.json'), 'utf8'));
shell.version = pkg.version;

await rm(stage, { recursive: true, force: true });
await rm(out, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await writeFile(`${stage}/package.json`, `${JSON.stringify(shell, null, 2)}\n`);
await cp(p('..', 'electron', 'main.cjs'), `${stage}/main.cjs`);
await cp(p('..', 'dist'), `${stage}/dist`, { recursive: true });
// The art folder carries the design docs for the web catalog; a release does not need them.
for (const doc of ['ART_GUIDE.md', 'GAME_DESIGN_v0.1.md']) {
  await rm(`${stage}/dist/art/${doc}`, { force: true });
}

if (!existsSync(p('..', 'build', 'icon.ico'))) {
  await run(process.execPath, [p('make-icon.mjs')]);
}

const [app] = await packager({
  dir: stage,
  out,
  platform: 'win32',
  arch: ARCH,
  icon: p('..', 'build', 'icon.ico'),
  appVersion: pkg.version,
  name: 'Provenance',
  executableName: 'Provenance',
  overwrite: true,
  asar: true,
  prune: false,          // the staged tree has no dependencies to prune
  win32metadata: {
    CompanyName: 'Provenance',
    FileDescription: 'Provenance — an RPG about who owns the future',
    ProductName: 'Provenance',
    OriginalFilename: 'Provenance.exe',
  },
});

// The manual sits beside the executable, not inside the asar, so README.txt and the installer's
// finish page can both point a player at a file they can actually open.
await cp(p('..', 'docs', 'PLAYER_MANUAL.md'), `${app}/PLAYER_MANUAL.md`);

// A README the player sees before they run an unsigned executable.
await writeFile(`${app}/README.txt`, `Provenance ${pkg.version} — Windows ${ARCH}

Run Provenance.exe. Nothing to install; the folder is the game.

  F11         fullscreen
  Ctrl+Q      quit
  Arrow keys / WASD  move        Enter select      Esc back
  A controller works as soon as you press a button on it.

Saves live in your Windows user profile, under
  %APPDATA%\\Provenance
and survive replacing this folder with a newer one. "Export save file" on the
save screen writes a JSON copy anywhere you like.

This build is not code-signed, so Windows SmartScreen will warn the first time.
"More info" then "Run anyway" if you trust where you got it.

PLAYER_MANUAL.md, beside this file, is the full manual; it is also in the game
under Player manual.
`);

// The blank-window failure mode is quiet and only shows up on Windows, so check the payload here.
const asar = `${app}/resources/app.asar`;
const { listPackage } = await import('@electron/asar');
// asar lists with the host's separator, so this comparison has to be made on one of them.
const inside = listPackage(asar, { isPack: false }).map((entry) => entry.replaceAll('\\', '/'));
for (const need of ['/main.cjs', '/dist/index.html', '/dist/fonts/fonts.css', '/package.json']) {
  if (!inside.includes(need)) throw new Error(`${need} is missing from app.asar`);
}
for (const beside of ['PLAYER_MANUAL.md', 'README.txt', 'Provenance.exe']) {
  if (!existsSync(`${app}/${beside}`)) throw new Error(`${beside} is missing from the app folder`);
}
const exe = await stat(`${app}/Provenance.exe`);
if (exe.size < 50 * 1024 * 1024) throw new Error('Provenance.exe looks truncated');
console.log(`app.asar: ${inside.length} entries, Provenance.exe ${(exe.size / 1024 / 1024).toFixed(0)} MB`);

const name = `Provenance-${pkg.version}-win32-${ARCH}`;
const folder = basename(app);
// Windows runners have no `zip`; their bundled bsdtar writes zip archives with -a. POSIX has zip.
const archive = process.platform === 'win32'
  ? ['tar', ['-a', '-c', '-f', `${name}.zip`, folder]]
  : ['zip', ['-qry', `${name}.zip`, folder]];
await run(archive[0], archive[1], { cwd: out, maxBuffer: 1 << 28 });
const zip = await stat(`${out}/${name}.zip`);
console.log(app.replace(root, ''));
console.log(`${name}.zip — ${(zip.size / 1024 / 1024).toFixed(1)} MB`);
