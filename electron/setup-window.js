(function () {
  const dataDirInput = document.getElementById('dataDir');
  const dbPathInput = document.getElementById('dbPath');
  const browseButton = document.getElementById('browseButton');
  const defaultButton = document.getElementById('defaultButton');
  const saveButton = document.getElementById('saveButton');
  const platformLabel = document.getElementById('platformLabel');
  const messageBox = document.getElementById('messageBox');

  let defaultDataDir = '';

  function buildDatabasePath(dataDir) {
    if (!dataDir) return '';
    const normalized = dataDir.replace(/[\\\/]+$/, '');
    return `${normalized}/database.sqlite`.replace(/\//g, dataDir.includes('\\') ? '\\' : '/');
  }

  function setBusy(isBusy) {
    browseButton.disabled = isBusy;
    defaultButton.disabled = isBusy;
    saveButton.disabled = isBusy;
    saveButton.textContent = isBusy ? 'Abrindo sistema...' : 'Concluir configuracao';
  }

  function showMessage(type, text) {
    if (!text) {
      messageBox.hidden = true;
      messageBox.textContent = '';
      messageBox.className = 'setup-message';
      return;
    }

    messageBox.hidden = false;
    messageBox.textContent = text;
    messageBox.className = `setup-message is-${type}`;
  }

  function setDataDir(dataDir) {
    dataDirInput.value = dataDir || '';
    dbPathInput.value = buildDatabasePath(dataDir || '');
  }

  async function loadState() {
    try {
      const state = await window.desktopSetup.getState();
      defaultDataDir = state.defaultDataDir || '';
      setDataDir(state.currentDataDir || state.defaultDataDir || '');
      platformLabel.textContent = state.platform || '-';
    } catch (_error) {
      showMessage('error', 'Nao foi possivel carregar a configuracao inicial do desktop.');
    }
  }

  browseButton.addEventListener('click', async () => {
    showMessage('', '');

    const response = await window.desktopSetup.chooseDataDirectory(dataDirInput.value || defaultDataDir);
    if (!response?.canceled && response?.path) {
      setDataDir(response.path);
    }
  });

  defaultButton.addEventListener('click', () => {
    setDataDir(defaultDataDir);
    showMessage('', '');
  });

  saveButton.addEventListener('click', async () => {
    if (!dataDirInput.value.trim()) {
      showMessage('error', 'Escolha uma pasta antes de concluir a configuracao.');
      return;
    }

    setBusy(true);
    showMessage('', '');

    try {
      const response = await window.desktopSetup.saveConfig({
        dataDir: dataDirInput.value.trim()
      });

      if (!response?.success) {
        showMessage('error', response?.message || 'Nao foi possivel salvar a configuracao.');
        setBusy(false);
        return;
      }

      showMessage('success', 'Configuracao salva com sucesso. Abrindo o sistema...');
    } catch (_error) {
      showMessage('error', 'Falha ao concluir a configuracao inicial.');
      setBusy(false);
    }
  });

  loadState();
})();
