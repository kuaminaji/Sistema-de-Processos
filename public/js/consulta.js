function switchConsultaTab(tab) {
  document.getElementById('documentoTab').style.display = tab === 'documento' ?'block' : 'none';
  document.getElementById('numeroTab').style.display = tab === 'numero' ?'block' : 'none';
  document.getElementById('consultaTabDocumento')?.classList.toggle('active', tab === 'documento');
  document.getElementById('consultaTabNumero')?.classList.toggle('active', tab === 'numero');
}

document.getElementById('documento')?.addEventListener('input', (event) => {
  event.target.value = formatDocument(event.target.value);
});

document.getElementById('consultaDocumentoForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const documento = document.getElementById('documento').value.trim();
  if (!validateDocument(documento)) {
    showToast('CPF ou CNPJ inválido', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/public/consultarPorDocumento/${encodeURIComponent(normalizeDigits(documento))}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro na consulta');
    renderDocumentoResult(data.data);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('consultaNumeroForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const numero = document.getElementById('numero').value.trim();
  if (normalizeDigits(numero).length !== 20) {
    showToast('Número do processo inválido', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/public/consultarPorNumero/${encodeURIComponent(numero)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro na consulta');
    renderNumeroResult(data.data);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

function renderDocumentoResult(data) {
  const cliente = data.cliente || {};
  const processos = data.processos || [];
  document.getElementById('resultadosContent').innerHTML = `
    <div class="alert alert-info">
      <strong>${escapeHtml(cliente.nome || '-')}</strong><br>
      ${escapeHtml(cliente.tipo_documento || 'Documento')}: ${escapeHtml(cliente.documento || '-')}<br>
      ${processos.length} processo(s) encontrado(s)
    </div>
    ${processos.length ?processos.map((processo) => `
      <div class="file-item mb-2">
        <div>
          <strong>${escapeHtml(processo.numero_processo)}</strong>
          <div class="text-secondary">${escapeHtml(processo.titulo || '-')}</div>
          <div class="text-secondary">${formatDate(processo.data_distribuicao)} · ${escapeHtml(processo.vara || '-')} · ${escapeHtml(processo.comarca || '-')}</div>
        </div>
        ${getStatusBadge(processo.status)}
      </div>
    `).join('') : renderEmptyState('Sem processos', 'Nenhum processo encontrado para este documento.')}
  `;
  document.getElementById('resultadosContainer').style.display = 'block';
}

function renderNumeroResult(data) {
  const processo = data.processo || {};
  const clientes = processo.clientes || (processo.cliente ?[processo.cliente] : []);
  document.getElementById('resultadosContent').innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="form-row cols-2 mb-3">
          <div><strong>Número</strong><div>${escapeHtml(processo.numero_processo || '-')}</div></div>
          <div><strong>Status</strong><div>${getStatusBadge(processo.status)}</div></div>
          <div><strong>Título</strong><div>${escapeHtml(processo.titulo || '-')}</div></div>
          <div><strong>Distribuição</strong><div>${formatDate(processo.data_distribuicao)}</div></div>
          <div><strong>Autor</strong><div>${escapeHtml(processo.autor || '-')}</div></div>
          <div><strong>Réu</strong><div>${escapeHtml(processo.reu || '-')}</div></div>
        </div>
        ${clientes.length ?`<div class="mb-3"><strong>Clientes</strong><div>${clientes.map((cliente) => `${escapeHtml(cliente.nome)} · ${escapeHtml(cliente.tipo_documento)} ${escapeHtml(cliente.documento)}`).join('<br>')}</div></div>` : ''}
        <div class="file-list">
          ${(processo.movimentacoes || []).length ?processo.movimentacoes.map((mov) => `<div class="file-item"><div><strong>${escapeHtml(mov.tipo)}</strong><div class="text-secondary">${formatDate(mov.data_movimentacao)}</div><div>${escapeHtml(mov.descricao)}</div></div></div>`).join('') : renderEmptyState('Sem movimentações', 'Nenhuma movimentação publicada para este processo.')}
        </div>
      </div>
    </div>
  `;
  document.getElementById('resultadosContainer').style.display = 'block';
}

function limparResultados() {
  document.getElementById('resultadosContainer').style.display = 'none';
  document.getElementById('resultadosContent').innerHTML = '';
  document.getElementById('consultaDocumentoForm')?.reset();
  document.getElementById('consultaNumeroForm')?.reset();
}
