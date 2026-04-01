const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'desktop-config.json';
const DATABASE_FILE = 'database.sqlite';

function normalizeUpdateChannel(channel) {
  return String(channel || '').trim().toLowerCase() === 'beta' ? 'beta' : 'stable';
}

function getDefaultUpdaterConfig() {
  const feedUrl = String(process.env.AUTO_UPDATE_URL || '').trim();
  const releasesUrl = String(process.env.AUTO_UPDATE_RELEASES_URL || feedUrl).trim();
  const autoCheckRaw = String(process.env.AUTO_UPDATE_AUTO_CHECK || 'true').trim().toLowerCase();

  return {
    channel: normalizeUpdateChannel(process.env.AUTO_UPDATE_CHANNEL),
    feedUrl,
    releasesUrl,
    autoCheck: autoCheckRaw !== 'false'
  };
}

function normalizeUpdaterConfig(updaterConfig = {}) {
  const defaults = getDefaultUpdaterConfig();

  return {
    channel: normalizeUpdateChannel(updaterConfig.channel || defaults.channel),
    feedUrl: String(updaterConfig.feedUrl ?? defaults.feedUrl ?? '').trim(),
    releasesUrl: String(updaterConfig.releasesUrl ?? defaults.releasesUrl ?? '').trim(),
    autoCheck: updaterConfig.autoCheck === undefined ? defaults.autoCheck : Boolean(updaterConfig.autoCheck)
  };
}

function getConfigPath(electronApp) {
  return path.join(electronApp.getPath('userData'), CONFIG_FILE);
}

function getDefaultDataDirectory(electronApp) {
  return path.join(electronApp.getPath('documents'), 'Sistema de Processos');
}

function buildRuntimePaths(dataDir) {
  const baseDir = path.resolve(String(dataDir || '').trim());

  return {
    dataDir: baseDir,
    dbPath: path.join(baseDir, DATABASE_FILE),
    uploadDir: path.join(baseDir, 'uploads'),
    brandingDir: path.join(baseDir, 'branding')
  };
}

function ensureRuntimeDirectories(runtimePaths) {
  fs.mkdirSync(runtimePaths.dataDir, { recursive: true });
  fs.mkdirSync(runtimePaths.uploadDir, { recursive: true });
  fs.mkdirSync(runtimePaths.brandingDir, { recursive: true });
}

function normalizeConfigPayload(payload) {
  const dataDir = String(payload?.dataDir || '').trim();
  if (!dataDir) {
    throw new Error('Escolha a pasta onde o banco de dados sera armazenado.');
  }

  return {
    ...buildRuntimePaths(dataDir),
    updater: normalizeUpdaterConfig(payload?.updater)
  };
}

function loadDesktopConfig(electronApp) {
  const configPath = getConfigPath(electronApp);
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  const runtimePaths = buildRuntimePaths(parsed.dataDir);

  return {
    dataDir: runtimePaths.dataDir,
    dbPath: runtimePaths.dbPath,
    uploadDir: runtimePaths.uploadDir,
    brandingDir: runtimePaths.brandingDir,
    updater: normalizeUpdaterConfig(parsed.updater)
  };
}

function saveDesktopConfig(electronApp, payload) {
  const currentConfig = loadDesktopConfig(electronApp);
  const runtimePaths = normalizeConfigPayload({
    ...currentConfig,
    ...payload,
    updater: {
      ...(currentConfig?.updater || {}),
      ...(payload?.updater || {})
    }
  });
  ensureRuntimeDirectories(runtimePaths);

  const configPath = getConfigPath(electronApp);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        dataDir: runtimePaths.dataDir,
        dbPath: runtimePaths.dbPath,
        updater: runtimePaths.updater
      },
      null,
      2
    ),
    'utf8'
  );

  return runtimePaths;
}

module.exports = {
  getConfigPath,
  getDefaultDataDirectory,
  buildRuntimePaths,
  getDefaultUpdaterConfig,
  normalizeUpdaterConfig,
  loadDesktopConfig,
  saveDesktopConfig
};
