const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getDefaultDataDirectory,
  buildRuntimePaths,
  saveDesktopConfig,
  loadDesktopConfig
} = require('../electron/desktopConfig');

describe('desktopConfig', () => {
  function createFakeApp(baseDir) {
    return {
      getPath(name) {
        if (name === 'userData') {
          return path.join(baseDir, 'user-data');
        }

        if (name === 'documents') {
          return path.join(baseDir, 'documents');
        }

        throw new Error(`Unsupported path lookup: ${name}`);
      }
    };
  }

  test('monta a pasta padrao a partir de documents', () => {
    const app = createFakeApp('C:\\temp');
    expect(getDefaultDataDirectory(app)).toBe(path.join('C:\\temp', 'documents', 'Sistema de Processos'));
  });

  test('salva e recarrega a configuracao desktop com pastas auxiliares', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-config-'));
    const app = createFakeApp(tempDir);
    const selectedDataDir = path.join(tempDir, 'dados-do-cliente');

    const saved = saveDesktopConfig(app, {
      dataDir: selectedDataDir,
      updater: {
        channel: 'beta',
        feedUrl: 'https://updates.exemplo.com',
        releasesUrl: 'https://updates.exemplo.com/releases',
        autoCheck: false
      }
    });
    const runtime = buildRuntimePaths(selectedDataDir);
    const loaded = loadDesktopConfig(app);

    expect(saved).toEqual({
      ...runtime,
      updater: {
        channel: 'beta',
        feedUrl: 'https://updates.exemplo.com',
        releasesUrl: 'https://updates.exemplo.com/releases',
        autoCheck: false
      }
    });
    expect(loaded).toEqual({
      ...runtime,
      updater: {
        channel: 'beta',
        feedUrl: 'https://updates.exemplo.com',
        releasesUrl: 'https://updates.exemplo.com/releases',
        autoCheck: false
      }
    });
    expect(fs.existsSync(runtime.dataDir)).toBe(true);
    expect(fs.existsSync(runtime.uploadDir)).toBe(true);
    expect(fs.existsSync(runtime.brandingDir)).toBe(true);
    expect(fs.existsSync(path.join(tempDir, 'user-data', 'desktop-config.json'))).toBe(true);
  });
});
