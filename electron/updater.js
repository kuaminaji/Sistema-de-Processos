const { dialog, shell } = require('electron');
const { NsisUpdater, MacUpdater } = require('electron-updater');

function normalizeChannel(channel) {
  return String(channel || '').trim().toLowerCase() === 'beta' ? 'beta' : 'stable';
}

function toUpdaterChannel(channel) {
  return normalizeChannel(channel) === 'beta' ? 'beta' : 'latest';
}

function buildSnapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

function createDesktopUpdater({
  electronApp,
  getConfig,
  getMainWindow,
  getWindows,
  prepareForInstall
}) {
  let updater = null;
  let checkTimer = null;
  let checkInterval = null;
  let downloadedInfo = null;
  let promptVersion = '';
  let currentState = {
    status: 'idle',
    currentVersion: electronApp.getVersion(),
    channel: 'stable',
    feedUrl: '',
    releasesUrl: '',
    autoCheck: true,
    configured: false,
    supported: ['win32', 'darwin'].includes(process.platform),
    packaged: electronApp.isPackaged,
    canAutoInstall: ['win32', 'darwin'].includes(process.platform) && electronApp.isPackaged,
    progressPercent: 0,
    downloadVersion: '',
    releaseDate: '',
    lastCheckedAt: '',
    message: '',
    backupPath: '',
    error: ''
  };

  function broadcastState(patch = null) {
    if (patch) {
      currentState = {
        ...currentState,
        ...patch
      };
    }

    const snapshot = buildSnapshot(currentState);
    getWindows().forEach((window) => {
      if (!window || window.isDestroyed()) return;
      window.webContents.send('desktop-updater:state', snapshot);
    });
  }

  function getState() {
    return buildSnapshot(currentState);
  }

  function clearScheduledChecks() {
    if (checkTimer) {
      clearTimeout(checkTimer);
      checkTimer = null;
    }

    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  function buildProviderOptions(config) {
    return {
      provider: 'generic',
      url: config.feedUrl,
      channel: toUpdaterChannel(config.channel),
      useMultipleRangeRequest: false
    };
  }

  function attachUpdaterEvents() {
    if (!updater || updater.__desktopEventsAttached) return;
    updater.__desktopEventsAttached = true;

    updater.on('checking-for-update', () => {
      broadcastState({
        status: 'checking',
        message: 'Verificando atualizacoes...',
        error: ''
      });
    });

    updater.on('update-available', (info) => {
      downloadedInfo = null;
      broadcastState({
        status: 'downloading',
        downloadVersion: info?.version || '',
        releaseDate: info?.releaseDate || '',
        progressPercent: 0,
        message: `Nova versao ${info?.version || ''} encontrada. Download iniciado.`
      });
    });

    updater.on('update-not-available', () => {
      downloadedInfo = null;
      promptVersion = '';
      broadcastState({
        status: 'not-available',
        lastCheckedAt: new Date().toISOString(),
        progressPercent: 0,
        message: 'Voce ja esta na versao mais atual.'
      });
    });

    updater.on('download-progress', (progress) => {
      broadcastState({
        status: 'downloading',
        progressPercent: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
        message: 'Baixando atualizacao em segundo plano...'
      });
    });

    updater.on('update-downloaded', async (info) => {
      downloadedInfo = info;
      broadcastState({
        status: 'downloaded',
        downloadVersion: info?.version || '',
        releaseDate: info?.releaseDate || '',
        progressPercent: 100,
        lastCheckedAt: new Date().toISOString(),
        message: `Atualizacao ${info?.version || ''} pronta para instalar.`
      });

      if (promptVersion === info?.version) return;
      promptVersion = info?.version || 'downloaded';

      const window = getMainWindow();
      if (!window || window.isDestroyed()) return;

      const result = await dialog.showMessageBox(window, {
        type: 'info',
        buttons: ['Reiniciar e atualizar', 'Depois'],
        defaultId: 0,
        cancelId: 1,
        title: 'Atualizacao pronta',
        message: `A versao ${info?.version || ''} ja foi baixada.`,
        detail: 'Um backup do banco sera criado automaticamente antes da instalacao.'
      });

      if (result.response === 0) {
        try {
          await installDownloadedUpdate();
        } catch (_error) {
          // O renderer recebera o estado de erro.
        }
      }
    });

    updater.on('error', (error) => {
      broadcastState({
        status: 'error',
        error: error?.message || 'Falha ao verificar atualizacao.',
        message: error?.message || 'Falha ao verificar atualizacao.'
      });
    });
  }

  function scheduleChecks() {
    clearScheduledChecks();

    if (!currentState.packaged || !currentState.supported || !currentState.configured || !currentState.autoCheck) {
      return;
    }

    checkTimer = setTimeout(() => {
      checkForUpdates().catch(() => {});
    }, 8000);

    checkInterval = setInterval(() => {
      checkForUpdates().catch(() => {});
    }, 1000 * 60 * 60 * 6);
  }

  function configure(config) {
    const updaterConfig = config?.updater || {};
    const channel = normalizeChannel(updaterConfig.channel);
    const feedUrl = String(updaterConfig.feedUrl || '').trim();
    const releasesUrl = String(updaterConfig.releasesUrl || feedUrl).trim();
    const autoCheck = updaterConfig.autoCheck !== false;

    currentState = {
      ...currentState,
      channel,
      feedUrl,
      releasesUrl,
      autoCheck,
      configured: Boolean(feedUrl),
      supported: ['win32', 'darwin'].includes(process.platform),
      packaged: electronApp.isPackaged,
      canAutoInstall: ['win32', 'darwin'].includes(process.platform) && electronApp.isPackaged && Boolean(feedUrl),
      message: '',
      error: ''
    };

    if (!currentState.packaged) {
      broadcastState({
        status: 'disabled',
        message: 'Atualizacao automatica fica ativa apenas no aplicativo empacotado.'
      });
      clearScheduledChecks();
      return getState();
    }

    if (!currentState.supported) {
      broadcastState({
        status: 'manual',
        message: 'Nesta plataforma, o sistema abrira a pagina de releases para atualizacao manual.'
      });
      clearScheduledChecks();
      return getState();
    }

    if (!currentState.configured) {
      broadcastState({
        status: 'unconfigured',
        message: 'Defina a URL do feed de atualizacao para automatizar novas versoes.'
      });
      clearScheduledChecks();
      return getState();
    }

    const providerOptions = buildProviderOptions(currentState);
    if (!updater) {
      updater = process.platform === 'win32'
        ? new NsisUpdater(providerOptions)
        : new MacUpdater(providerOptions);
      attachUpdaterEvents();
    } else {
      updater.setFeedURL(providerOptions);
    }

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = false;
    updater.allowPrerelease = currentState.channel === 'beta';
    updater.channel = providerOptions.channel;

    broadcastState({
      status: downloadedInfo ? 'downloaded' : 'idle',
      message: downloadedInfo ? currentState.message : 'Atualizacao automatica pronta para verificar novas versoes.'
    });

    scheduleChecks();
    return getState();
  }

  async function checkForUpdates() {
    if (!currentState.packaged) {
      broadcastState({
        status: 'disabled',
        message: 'Atualizacao automatica fica ativa apenas no aplicativo empacotado.'
      });
      return getState();
    }

    if (!currentState.supported) {
      broadcastState({
        status: 'manual',
        message: 'Use a pagina de releases para atualizar esta plataforma.'
      });
      return getState();
    }

    if (!currentState.configured || !updater) {
      broadcastState({
        status: 'unconfigured',
        message: 'Feed de atualizacao nao configurado.'
      });
      return getState();
    }

    await updater.checkForUpdates();
    return getState();
  }

  async function installDownloadedUpdate() {
    if (!updater || !downloadedInfo) {
      throw new Error('Nenhuma atualizacao baixada esta pronta para instalar.');
    }

    const backupPath = await prepareForInstall(downloadedInfo);
    broadcastState({
      status: 'installing',
      backupPath: backupPath || '',
      message: backupPath
        ? `Backup criado em ${backupPath}. Reiniciando para concluir a atualizacao...`
        : 'Reiniciando para concluir a atualizacao...'
    });

    updater.quitAndInstall(false, true);
    return {
      success: true,
      backupPath: backupPath || ''
    };
  }

  function openReleasePage() {
    const config = getConfig();
    const targetUrl = config?.updater?.releasesUrl || config?.updater?.feedUrl || currentState.releasesUrl || currentState.feedUrl;
    if (!targetUrl) {
      throw new Error('Nenhuma URL de releases foi configurada.');
    }

    shell.openExternal(targetUrl);
    return { success: true };
  }

  function syncWindow(window) {
    if (!window || window.isDestroyed()) return;
    window.webContents.send('desktop-updater:state', getState());
  }

  return {
    configure,
    getState,
    checkForUpdates,
    installDownloadedUpdate,
    openReleasePage,
    syncWindow
  };
}

module.exports = {
  createDesktopUpdater
};
