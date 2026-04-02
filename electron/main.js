const fs = require('fs');
const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  shell,
  ipcMain
} = require('electron');

const {
  loadDesktopConfig,
  saveDesktopConfig,
  getDefaultDataDirectory,
  buildRuntimePaths
} = require('./desktopConfig');
const { createDesktopUpdater } = require('./updater');

let mainWindow = null;
let setupWindow = null;
let serverInstance = null;
let appBaseUrl = '';
let activeDesktopConfig = null;
let desktopUpdater = null;

function applyDesktopEnvironment(config) {
  const runtimePaths = buildRuntimePaths(config?.dataDir || getDefaultDataDirectory(app));

  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.DESKTOP_APP = 'true';
  process.env.PORT = '0';
  process.env.COOKIE_SECURE = 'false';
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@local';
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123456';
  process.env.DB_PATH = runtimePaths.dbPath;
  process.env.UPLOAD_DIR = runtimePaths.uploadDir;
  process.env.BRANDING_DIR = runtimePaths.brandingDir;
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || `desktop-session-${app.name}`;

  return runtimePaths;
}

async function startLocalServer(config) {
  if (serverInstance) {
    return appBaseUrl;
  }

  applyDesktopEnvironment(config);
  const { start } = require('../src/server');
  serverInstance = await start({
    port: 0,
    host: '127.0.0.1',
    exitOnError: false
  });

  const address = serverInstance.address();
  appBaseUrl = `http://127.0.0.1:${address.port}`;
  return appBaseUrl;
}

function createAppWindow(targetUrl = `${appBaseUrl}/login.html`) {
  const isMac = process.platform === 'darwin';

  const window = new BrowserWindow({
    width: isMac ? 1366 : 1440,
    height: isMac ? 840 : 920,
    minWidth: isMac ? 1100 : 1180,
    minHeight: isMac ? 700 : 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f3f6fb',
    title: 'Sistema de Processos',
    icon: path.join(__dirname, '../public/assets/branding/company-mark.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.on('did-finish-load', () => {
    desktopUpdater?.syncWindow(window);
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appBaseUrl)) {
      createAppWindow(url);
      return { action: 'deny' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(appBaseUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  window.loadURL(targetUrl);
  return window;
}

function createSetupWindow() {
  const window = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 860,
    minHeight: 620,
    show: false,
    resizable: true,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#eef4fb',
    title: 'Configuracao inicial',
    icon: path.join(__dirname, '../public/assets/branding/company-mark.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.on('closed', () => {
    if (setupWindow === window) {
      setupWindow = null;
    }
  });

  window.loadFile(path.join(__dirname, 'setup-window.html'));
  return window;
}

async function openConfiguredApp(config) {
  activeDesktopConfig = config;
  await startLocalServer(config);
  desktopUpdater?.configure(config);

  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.close();
    setupWindow = null;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    await mainWindow.loadURL(`${appBaseUrl}/login.html`);
    mainWindow.show();
    return;
  }

  mainWindow = createAppWindow();
}

function registerDesktopSetupHandlers() {
  ipcMain.handle('desktop-setup:get-state', () => {
    const savedConfig = loadDesktopConfig(app);
    const defaultDataDir = getDefaultDataDirectory(app);
    const currentDataDir = savedConfig?.dataDir || defaultDataDir;

    return {
      defaultDataDir,
      currentDataDir,
      suggestedDatabasePath: buildRuntimePaths(currentDataDir).dbPath,
      platform: process.platform
    };
  });

  ipcMain.handle('desktop-setup:choose-data-directory', async (_event, initialPath) => {
    const result = await dialog.showOpenDialog({
      title: 'Escolha a pasta de destino do banco de dados',
      defaultPath: initialPath || getDefaultDataDirectory(app),
      properties: ['openDirectory', 'createDirectory']
    });

    return {
      canceled: result.canceled,
      path: result.canceled ? '' : result.filePaths[0] || ''
    };
  });

  ipcMain.handle('desktop-setup:save-config', async (_event, payload) => {
    try {
      const config = saveDesktopConfig(app, payload);
      await openConfiguredApp(config);

      return {
        success: true,
        data: {
          dataDir: config.dataDir,
          dbPath: config.dbPath
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Nao foi possivel salvar a configuracao inicial.'
      };
    }
  });

  ipcMain.handle('desktop-updater:get-state', () => desktopUpdater?.getState() || null);

  ipcMain.handle('desktop-updater:check', async () => {
    try {
      const state = await desktopUpdater.checkForUpdates();
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Nao foi possivel verificar atualizacoes.'
      };
    }
  });

  ipcMain.handle('desktop-updater:save-settings', async (_event, payload) => {
    try {
      const currentConfig = activeDesktopConfig || loadDesktopConfig(app) || {
        dataDir: getDefaultDataDirectory(app)
      };
      const updatedConfig = saveDesktopConfig(app, {
        dataDir: currentConfig.dataDir,
        updater: payload
      });

      activeDesktopConfig = updatedConfig;
      const state = desktopUpdater.configure(updatedConfig);
      return { success: true, data: state };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Nao foi possivel salvar as configuracoes de atualizacao.'
      };
    }
  });

  ipcMain.handle('desktop-updater:install', async () => {
    try {
      const result = await desktopUpdater.installDownloadedUpdate();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Nao foi possivel instalar a atualizacao.'
      };
    }
  });

  ipcMain.handle('desktop-updater:open-release-page', async () => {
    try {
      const result = desktopUpdater.openReleasePage();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Nenhuma pagina de releases foi configurada.'
      };
    }
  });
}

async function initializeDesktopApp() {
  Menu.setApplicationMenu(null);
  desktopUpdater = createDesktopUpdater({
    electronApp: app,
    getConfig: () => activeDesktopConfig || loadDesktopConfig(app),
    getMainWindow: () => mainWindow,
    getWindows: () => BrowserWindow.getAllWindows(),
    prepareForInstall: backupDatabaseBeforeInstall
  });
  registerDesktopSetupHandlers();

  const savedConfig = loadDesktopConfig(app);
  if (savedConfig) {
    await openConfiguredApp(savedConfig);
    return;
  }

  setupWindow = createSetupWindow();
}

async function backupDatabaseBeforeInstall(updateInfo) {
  const config = activeDesktopConfig || loadDesktopConfig(app);
  if (!config?.dbPath) {
    throw new Error('O caminho do banco de dados nao foi encontrado para o backup da atualizacao.');
  }

  await shutdownServer();

  try {
    if (!fs.existsSync(config.dbPath)) {
      return '';
    }

    const backupDir = path.join(config.dataDir, 'backups', 'updates');
    fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const targetName = `database-before-${updateInfo?.version || app.getVersion()}-${timestamp}.sqlite`;
    const targetPath = path.join(backupDir, targetName);
    fs.copyFileSync(config.dbPath, targetPath);

    const metadataPath = `${targetPath}.json`;
    fs.writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          fromVersion: app.getVersion(),
          toVersion: updateInfo?.version || '',
          sourceDatabase: config.dbPath
        },
        null,
        2
      ),
      'utf8'
    );

    return targetPath;
  } catch (error) {
    await openConfiguredApp(config);
    throw error;
  }
}

async function shutdownServer() {
  if (!serverInstance) return;

  await new Promise((resolve) => {
    serverInstance.close(() => resolve());
  });

  serverInstance = null;
  appBaseUrl = '';
}

const hasLock = app.requestSingleInstanceLock();

if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const targetWindow = mainWindow || setupWindow;
    if (targetWindow) {
      if (targetWindow.isMinimized()) targetWindow.restore();
      targetWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      await initializeDesktopApp();
    } catch (error) {
      console.error('Erro ao iniciar aplicativo desktop:', error);
      dialog.showErrorBox(
        'Falha ao abrir o Sistema de Processos',
        `${error.message}\n\nVerifique se a pasta escolhida para o banco de dados esta acessivel.`
      );
      await shutdownServer();
      app.quit();
    }
  });

  app.on('window-all-closed', async () => {
    await shutdownServer();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length > 0) return;

    const savedConfig = loadDesktopConfig(app);
    if (savedConfig) {
      await openConfiguredApp(savedConfig);
      return;
    }

    setupWindow = createSetupWindow();
  });

  app.on('before-quit', async () => {
    await shutdownServer();
  });
}
