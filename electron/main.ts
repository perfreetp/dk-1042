import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

log.info('Application starting...');

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (_, folderPath: string) => {
  log.info('Scanning folder:', folderPath);
  return scanDirectory(folderPath);
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    log.error('Error reading file:', error);
    return null;
  }
});

ipcMain.handle('scan-folder-with-content', async (_, folderPath: string) => {
  log.info('Scanning folder with content:', folderPath);
  const files = scanDirectory(folderPath);
  const contents: Record<string, string> = {};
  
  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh', '.bat', '.txt'];
  
  for (const file of files) {
    if (scriptExtensions.includes(file.extension)) {
      try {
        const stats = fs.statSync(file.path);
        if (stats.size < 1024 * 1024) {
          const content = fs.readFileSync(file.path, 'utf-8');
          contents[file.path] = content;
        }
      } catch (error) {
        log.error('Error reading script content:', file.path, error);
      }
    }
  }
  
  return { files, contents };
});

function scanDirectory(dirPath: string, depth = 0): any[] {
  const files: any[] = [];
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        if (depth < 10) {
          const subFiles = scanDirectory(fullPath, depth + 1);
          files.push(...subFiles);
        }
      } else {
        const stats = fs.statSync(fullPath);
        const ext = path.extname(entry.name).toLowerCase();
        
        files.push({
          id: Buffer.from(fullPath).toString('base64'),
          name: entry.name,
          path: fullPath,
          extension: ext,
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
          createdTime: stats.birthtime.toISOString(),
          type: getFileType(ext)
        });
      }
    }
  } catch (error) {
    log.error('Error scanning directory:', error);
  }
  
  return files;
}

function getFileType(ext: string): string {
  const types: Record<string, string[]> = {
    'table': ['.xlsx', '.xls', '.csv', '.parquet', '.db', '.sqlite'],
    'script': ['.py', '.sql', '.r', '.js', '.sh', '.bat'],
    'report': ['.pdf', '.docx', '.html', '.md', '.pptx'],
    'config': ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf'],
    'data': ['.txt', '.log', '.xml', '.json']
  };
  
  for (const [type, extensions] of Object.entries(types)) {
    if (extensions.includes(ext)) {
      return type;
    }
  }
  return 'other';
}
