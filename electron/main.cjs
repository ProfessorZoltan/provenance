// The desktop shell. It opens one window on the built game and otherwise stays out of the way:
// no Node in the page, no remote content, no menu bar over a game that draws its own prompts.
const { app, BrowserWindow, Menu, globalShortcut, shell } = require('electron');
const path = require('node:path');

// Packaged, main.cjs sits beside dist/; run straight from the repo it sits in electron/.
const GAME = [
  path.join(__dirname, 'dist', 'index.html'),
  path.join(__dirname, '..', 'dist', 'index.html'),
].find((p) => require('node:fs').existsSync(p));
// The layout is built for this and reads well down to about 1100 wide.
const SIZE = { width: 1440, height: 900, min: { width: 1024, height: 680 } };

function createWindow() {
  const win = new BrowserWindow({
    width: SIZE.width,
    height: SIZE.height,
    minWidth: SIZE.min.width,
    minHeight: SIZE.min.height,
    title: 'Provenance',
    // 2312's background, so the first frame is not a white flash into a dark game.
    backgroundColor: '#0b1020',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  if (!GAME) {
    // Better than a blank window: say which build step was skipped.
    win.loadURL('data:text/html,' + encodeURIComponent(
      '<body style="background:#0b1020;color:#f8efd5;font:16px system-ui;padding:3em">'
      + '<h1>Provenance</h1><p>The game files are missing from this build. '
      + 'If you are running from source, run <code>npm run build</code> first.</p></body>'));
    win.show();
    return win;
  }
  win.loadFile(GAME);

  // F11 toggles fullscreen, Ctrl+Q quits: the two things a Windows player will try.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.control && input.key.toLowerCase() === 'q') {
      app.quit();
      event.preventDefault();
    }
  });

  // Nothing in the game opens a link, but if that changes it goes to the real browser, not here.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  return win;
}

// One instance: a second launch focuses the window that is already open rather than
// starting a second game against the same save.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null);

  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
