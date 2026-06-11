import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath: string) => ipcRenderer.invoke('scan-folder', folderPath),
  scanFolderWithContent: (folderPath: string) => ipcRenderer.invoke('scan-folder-with-content', folderPath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath)
});
