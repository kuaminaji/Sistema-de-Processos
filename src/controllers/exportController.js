const { Database } = require('../database/init');
const { auditLog } = require('../middleware/audit');
const { sanitizarInput } = require('../middleware/validators');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Constantes
const MAX_PDF_AUDITORIA_RECORDS = 500;

// Helper: Construir cláusula WHERE para filtros
function buildWhereClause(filters, params, table = 'processos') {
  const whereConditions = [];
  
  if (table === 'processos') {
    if (filters.numero_processo) {
      whereConditions.push('numero_processo LIKE ?');
      params.push(`%${sanitizarInput(filters.numero_processo)}%`);
    }
    
    if (filters.titulo) {
      whereConditions.push('titulo LIKE ?');
      params.push(`%${sanitizarInput(filters.titulo)}%`);
    }
    
    if (filters.status) {
      whereConditions.push('status = ?');
      params.push(sanitizarInput(filters.status));
    }
    
    if (filters.autor) {
      whereConditions.push('autor LIKE ?');
      params.push(`%${sanitizarInput(filters.autor)}%`);
    }
    
    if (filters.reu) {
      whereConditions.push('reu LIKE ?');
      params.push(`%${sanitizarInput(filters.reu)}%`);
    }
    
    if (filters.data_inicio) {
      whereConditions.push('data_distribuicao >= ?');
      params.push(filters.data_inicio);
    }
    
    if (filters.data_fim) {
      whereConditions.push('data_distribuicao <= ?');
      params.push(filters.data_fim);
    }
  } else if (table === 'auditoria') {
    if (filters.acao) {
      whereConditions.push('acao LIKE ?');
      params.push(`%${sanitizarInput(filters.acao)}%`);
    }
    
    if (filters.tela) {
      whereConditions.push('tela = ?');
      params.push(sanitizarInput(filters.tela));
    }
    
    if (filters.usuario_email) {
      whereConditions.push('usuario_email LIKE ?');
      params.push(`%${sanitizarInput(filters.usuario_email)}%`);
    }
    
    if (filters.status_http) {
      whereConditions.push('status_http = ?');
      params.push(parseInt(filters.status_http));
    }
    
    if (filters.data_inicio) {
      whereConditions.push('criado_em >= ?');
      params.push(filters.data_inicio);
    }
    
    if (filters.data_fim) {
      whereConditions.push('criado_em <= ?');
      params.push(filters.data_fim);
    }
  }
  
  return whereConditions.length > 0 ?'WHERE ' + whereConditions.join(' AND ') : '';
}

// Helper: Escapar CSV
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Se contém vírgula, aspas ou quebra de linha, envolve em aspas
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    // Duplica aspas existentes
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  
  return stringValue;
}

// Helper: Converter para CSV
function arrayToCSV(headers, rows) {
  const csvRows = [];
  
  // BOM para UTF-8 (compatibilidade com Excel)
  csvRows.push('\ufeff');
  
  // Headers
  csvRows.push(headers.map(escapeCSV).join(','));
  
  // Rows
  for (const row of rows) {
    csvRows.push(row.map(escapeCSV).join(','));
  }
  
  return csvRows.join('\n');
}

// Exportar processos para CSV
async function exportProcessosCSV(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'processos');
    
    const query = `
      SELECT 
        numero_processo, titulo, descricao, autor, reu, status,
        tipo_acao, valor_causa, data_distribuicao, data_ultima_movimentacao,
        vara, comarca, advogado_autor, advogado_reu, observacoes,
        criado_em, atualizado_em
      FROM processos
      ${whereClause}
      ORDER BY criado_em DESC
    `;
    
    const processos = await db.all(query, params);
    await db.close();
    
    // Preparar dados para CSV
    const headers = [
      'Número do Processo', 'Título', 'Descrição', 'Autor', 'Réu', 'Status',
      'Tipo de Ação', 'Valor da Causa', 'Data de Distribuição', 'Última Movimentação',
      'Vara', 'Comarca', 'Advogado Autor', 'Advogado Réu', 'Observações',
      'Criado Em', 'Atualizado Em'
    ];
    
    const rows = processos.map(p => [
      p.numero_processo, p.titulo, p.descricao, p.autor, p.reu, p.status,
      p.tipo_acao, p.valor_causa, p.data_distribuicao, p.data_ultima_movimentacao,
      p.vara, p.comarca, p.advogado_autor, p.advogado_reu, p.observacoes,
      p.criado_em, p.atualizado_em
    ]);
    
    const csv = arrayToCSV(headers, rows);
    
    // Registrar auditoria
    await auditLog(req, 'export_processos_csv', {
      tela: 'export',
      status: 200,
      total_registros: processos.length
    });
    
    // Definir headers para download
    const filename = `processos_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.send(csv);
    
  } catch (error) {
    console.error('Erro ao exportar processos para CSV:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_processos_csv_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar processos para CSV'
    });
  }
}

// Exportar processos para Excel
async function exportProcessosExcel(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'processos');
    
    const query = `
      SELECT 
        numero_processo, titulo, descricao, autor, reu, status,
        tipo_acao, valor_causa, data_distribuicao, data_ultima_movimentacao,
        vara, comarca, advogado_autor, advogado_reu, observacoes,
        criado_em, atualizado_em
      FROM processos
      ${whereClause}
      ORDER BY criado_em DESC
    `;
    
    const processos = await db.all(query, params);
    await db.close();
    
    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Processos');
    
    // Definir colunas
    worksheet.columns = [
      { header: 'Número do Processo', key: 'numero_processo', width: 20 },
      { header: 'Título', key: 'titulo', width: 30 },
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Autor', key: 'autor', width: 25 },
      { header: 'Réu', key: 'reu', width: 25 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Tipo de Ação', key: 'tipo_acao', width: 20 },
      { header: 'Valor da Causa', key: 'valor_causa', width: 15 },
      { header: 'Data de Distribuição', key: 'data_distribuicao', width: 18 },
      { header: 'Última Movimentação', key: 'data_ultima_movimentacao', width: 18 },
      { header: 'Vara', key: 'vara', width: 20 },
      { header: 'Comarca', key: 'comarca', width: 20 },
      { header: 'Advogado Autor', key: 'advogado_autor', width: 25 },
      { header: 'Advogado Réu', key: 'advogado_reu', width: 25 },
      { header: 'Observações', key: 'observacoes', width: 40 },
      { header: 'Criado Em', key: 'criado_em', width: 18 },
      { header: 'Atualizado Em', key: 'atualizado_em', width: 18 }
    ];
    
    // Estilizar header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Adicionar dados
    processos.forEach(processo => {
      worksheet.addRow(processo);
    });
    
    // Adicionar bordas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Registrar auditoria
    await auditLog(req, 'export_processos_excel', {
      tela: 'export',
      status: 200,
      total_registros: processos.length
    });
    
    // Definir headers para download
    const filename = `processos_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Enviar arquivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erro ao exportar processos para Excel:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_processos_excel_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar processos para Excel'
    });
  }
}

// Exportar processos para PDF
async function exportProcessosPDF(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'processos');
    
    const query = `
      SELECT 
        numero_processo, titulo, descricao, autor, reu, status,
        tipo_acao, valor_causa, data_distribuicao, vara, comarca
      FROM processos
      ${whereClause}
      ORDER BY criado_em DESC
    `;
    
    const processos = await db.all(query, params);
    await db.close();
    
    // Criar documento PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Definir headers para download
    const filename = `processos_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe para response
    doc.pipe(res);
    
    // Título
    doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Processos', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Processos
    processos.forEach((processo, index) => {
      // Verificar se precisa de nova página
      if (doc.y > 700) {
        doc.addPage();
      }
      
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${processo.numero_processo}`, { continued: false });
      doc.fontSize(10).font('Helvetica');
      doc.text(`Título: ${processo.titulo || 'N/A'}`);
      doc.text(`Status: ${processo.status || 'N/A'}`);
      doc.text(`Autor: ${processo.autor || 'N/A'}`);
      doc.text(`Réu: ${processo.reu || 'N/A'}`);
      doc.text(`Tipo de Ação: ${processo.tipo_acao || 'N/A'}`);
      doc.text(`Valor da Causa: ${processo.valor_causa ?`R$ ${processo.valor_causa}` : 'N/A'}`);
      doc.text(`Data de Distribuição: ${processo.data_distribuicao || 'N/A'}`);
      doc.text(`Vara: ${processo.vara || 'N/A'}`);
      doc.text(`Comarca: ${processo.comarca || 'N/A'}`);
      
      if (processo.descricao) {
        doc.text(`Descrição: ${processo.descricao}`, { width: 500 });
      }
      
      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);
    });
    
    // Rodapé com número de páginas
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Página ${i + 1} de ${range.count}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
    }
    
    // Finalizar documento
    doc.end();
    
    // Registrar auditoria
    await auditLog(req, 'export_processos_pdf', {
      tela: 'export',
      status: 200,
      total_registros: processos.length
    });
    
  } catch (error) {
    console.error('Erro ao exportar processos para PDF:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_processos_pdf_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar processos para PDF'
    });
  }
}

// Exportar auditoria para CSV
async function exportAuditoriaCSV(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'auditoria');
    
    const query = `
      SELECT 
        id, usuario_email, acao, tela, metodo, rota,
        status_http, ip, user_agent, criado_em
      FROM auditoria
      ${whereClause}
      ORDER BY criado_em DESC
    `;
    
    const registros = await db.all(query, params);
    await db.close();
    
    // Preparar dados para CSV
    const headers = [
      'ID', 'Usuário', 'Ação', 'Tela', 'Método', 'Rota',
      'Status HTTP', 'IP', 'User Agent', 'Data/Hora'
    ];
    
    const rows = registros.map(r => [
      r.id, r.usuario_email, r.acao, r.tela, r.metodo, r.rota,
      r.status_http, r.ip, r.user_agent, r.criado_em
    ]);
    
    const csv = arrayToCSV(headers, rows);
    
    // Registrar auditoria
    await auditLog(req, 'export_auditoria_csv', {
      tela: 'export',
      status: 200,
      total_registros: registros.length
    });
    
    // Definir headers para download
    const filename = `auditoria_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.send(csv);
    
  } catch (error) {
    console.error('Erro ao exportar auditoria para CSV:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_auditoria_csv_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar auditoria para CSV'
    });
  }
}

// Exportar auditoria para Excel
async function exportAuditoriaExcel(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'auditoria');
    
    const query = `
      SELECT 
        id, usuario_email, acao, tela, metodo, rota,
        status_http, ip, user_agent, criado_em
      FROM auditoria
      ${whereClause}
      ORDER BY criado_em DESC
    `;
    
    const registros = await db.all(query, params);
    await db.close();
    
    // Criar workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Auditoria');
    
    // Definir colunas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Usuário', key: 'usuario_email', width: 30 },
      { header: 'Ação', key: 'acao', width: 30 },
      { header: 'Tela', key: 'tela', width: 20 },
      { header: 'Método', key: 'metodo', width: 10 },
      { header: 'Rota', key: 'rota', width: 40 },
      { header: 'Status HTTP', key: 'status_http', width: 12 },
      { header: 'IP', key: 'ip', width: 15 },
      { header: 'User Agent', key: 'user_agent', width: 40 },
      { header: 'Data/Hora', key: 'criado_em', width: 20 }
    ];
    
    // Estilizar header
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Adicionar dados
    registros.forEach(registro => {
      worksheet.addRow(registro);
    });
    
    // Adicionar bordas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
    
    // Registrar auditoria
    await auditLog(req, 'export_auditoria_excel', {
      tela: 'export',
      status: 200,
      total_registros: registros.length
    });
    
    // Definir headers para download
    const filename = `auditoria_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Enviar arquivo
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Erro ao exportar auditoria para Excel:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_auditoria_excel_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar auditoria para Excel'
    });
  }
}

// Exportar auditoria para PDF
async function exportAuditoriaPDF(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    const params = [];
    const whereClause = buildWhereClause(req.query, params, 'auditoria');
    
    const query = `
      SELECT 
        id, usuario_email, acao, tela, metodo, rota,
        status_http, ip, criado_em
      FROM auditoria
      ${whereClause}
      ORDER BY criado_em DESC
      LIMIT ${MAX_PDF_AUDITORIA_RECORDS}
    `;
    
    const registros = await db.all(query, params);
    await db.close();
    
    // Criar documento PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    
    // Definir headers para download
    const filename = `auditoria_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Pipe para response
    doc.pipe(res);
    
    // Título
    doc.fontSize(18).font('Helvetica-Bold').text('Relatório de Auditoria', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Registros
    registros.forEach((registro, index) => {
      // Verificar se precisa de nova página
      if (doc.y > 720) {
        doc.addPage();
      }
      
      doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ID: ${registro.id}`, { continued: false });
      doc.fontSize(9).font('Helvetica');
      doc.text(`Usuário: ${registro.usuario_email || 'N/A'}`);
      doc.text(`Ação: ${registro.acao || 'N/A'}`);
      doc.text(`Tela: ${registro.tela || 'N/A'}`);
      doc.text(`Método: ${registro.metodo || 'N/A'} | Rota: ${registro.rota || 'N/A'}`);
      doc.text(`Status HTTP: ${registro.status_http || 'N/A'} | IP: ${registro.ip || 'N/A'}`);
      doc.text(`Data/Hora: ${registro.criado_em || 'N/A'}`);
      
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
    });
    
    // Rodapé com número de páginas
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Página ${i + 1} de ${range.count}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
    }
    
    // Finalizar documento
    doc.end();
    
    // Registrar auditoria
    await auditLog(req, 'export_auditoria_pdf', {
      tela: 'export',
      status: 200,
      total_registros: registros.length
    });
    
  } catch (error) {
    console.error('Erro ao exportar auditoria para PDF:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'export_auditoria_pdf_erro', {
      tela: 'export',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao exportar auditoria para PDF'
    });
  }
}

module.exports = {
  exportProcessosCSV,
  exportProcessosExcel,
  exportProcessosPDF,
  exportAuditoriaCSV,
  exportAuditoriaExcel,
  exportAuditoriaPDF
};
