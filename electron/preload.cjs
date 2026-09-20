// The only bridge between the page and the desktop. It exposes two file operations and nothing
// else: the game has no business reaching the rest of the machine.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('provenanceDesktop', {
  /** Write a save where the player chooses. Returns the file name, or null if they cancelled. */
  saveFile: (json, suggestedName) => ipcRenderer.invoke('save:write', String(json), String(suggestedName)),
  /** Read a save the player picks. Returns its text, or null if they cancelled. */
  loadFile: () => ipcRenderer.invoke('save:read'),
  /** Where saves go by default, for telling the player where to look. */
  savesPath: () => ipcRenderer.invoke('save:folder'),
});
