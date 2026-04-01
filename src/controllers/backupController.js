const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Database, bootstrapAdmin } = require('../database/init');
const { auditLog } = require('../middleware/audit');
const { getUploadBaseDir, resolveStoredUploadPath } = require('../utils/storagePaths');

function readAttachmentPayload(anexo) {
  const absolutePath = resolveStoredUploadPath(anexo.caminho_relativo);
  if (!fs.existsSync(absolutePath)) {
    return { ...anexo, arquivo_base64: null };
  }
  return {
    ...anexo,
    arquivo_base64: fs.readFileSync(absolutePath).toString('base64')
  };
}

async function backup(req, res) {
  const db = new Database();

  try {
    await db.connect();
    const usuarios = await db.all(
      `SELECT id, nome, email, perfil, ativo, twofa_secret, twofa_enabled, forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
       FROM usuarios`,
      []
    );
    const clientes = await db.all('SELECT * FROM clientes', []);
    const processos = await db.all('SELECT * FROM processos', []);
    const processoClientes = await db.all('SELECT * FROM processo_clientes', []);
    const movimentacoes = await db.all('SELECT * FROM movimentacoes', []);
    const anexos = await db.all('SELECT * FROM anexos_processo', []);
    const permissoes = await db.all('SELECT * FROM permissoes', []);
    const usuarioPermissoes = await db.all('SELECT * FROM usuario_permissoes', []);
    await db.close();

    const backupData = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      exportedBy: req.session.usuario.email,
      includes_files: true,
      data: {
        usuarios,
        clientes,
        processos,
        processo_clientes: processoClientes,
        movimentacoes,
        anexos: anexos.map(readAttachmentPayload),
        permissoes,
        usuario_permissoes: usuarioPermissoes
      }
    };

    await auditLog(req, 'backup_export', {
      tela: 'backup',
      status: 200,
      total_usuarios: usuarios.length,
      total_clientes: clientes.length,
      total_processos: processos.length,
      total_vinculos_processo_cliente: processoClientes.length,
      total_movimentacoes: movimentacoes.length,
      total_anexos: anexos.length
    });

    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.json(backupData);
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    try { await db.close(); } catch (closeError) {}
    await auditLog(req, 'backup_export_erro', { tela: 'backup', status: 500, erro: error.message });
    return res.status(500).json({ success: false, message: 'Erro ao criar backup' });
  }
}

async function restore(req, res) {
  const db = new Database();

  try {
    const backupData = req.body;
    if (!backupData?.data) {
      return res.status(400).json({ success: false, message: 'Formato de backup invalido' });
    }

    const {
      usuarios = [],
      clientes = [],
      processos = [],
      processo_clientes = [],
      movimentacoes = [],
      anexos = [],
      permissoes = [],
      usuario_permissoes = []
    } = backupData.data;

    await db.connect();
    const stats = {
      usuarios: { created: 0, updated: 0 },
      clientes: { created: 0, updated: 0 },
      processos: { created: 0, updated: 0 },
      processo_clientes: { created: 0, updated: 0 },
      movimentacoes: { created: 0, updated: 0 },
      anexos: { created: 0, updated: 0 },
      permissoes: { created: 0, updated: 0 },
      usuario_permissoes: { created: 0, updated: 0 }
    };

    for (const permissao of permissoes) {
      const existing = await db.get('SELECT id FROM permissoes WHERE codigo = ?', [permissao.codigo]);
      if (existing) {
        await db.run('UPDATE permissoes SET modulo = ?, descricao = ?WHERE codigo = ?', [permissao.modulo, permissao.descricao, permissao.codigo]);
        stats.permissoes.updated += 1;
      } else {
        await db.run('INSERT INTO permissoes (codigo, modulo, descricao) VALUES (?, ?, ?)', [permissao.codigo, permissao.modulo, permissao.descricao]);
        stats.permissoes.created += 1;
      }
    }

    for (const usuario of usuarios) {
      const existing = await db.get('SELECT id FROM usuarios WHERE email = ?', [usuario.email]);
      if (existing) {
        await db.run(
          `UPDATE usuarios
           SET nome = ?, perfil = ?, ativo = ?, twofa_enabled = ?, forcar_troca_senha = ?, senha_expira_em = ?, ultimo_login_em = ?, atualizado_em = ?
           WHERE email = ?`,
          [usuario.nome, usuario.perfil, usuario.ativo, usuario.twofa_enabled, usuario.forcar_troca_senha, usuario.senha_expira_em, usuario.ultimo_login_em, usuario.atualizado_em, usuario.email]
        );
        stats.usuarios.updated += 1;
      } else {
        const senhaHash = await bcrypt.hash(`Temp!${Date.now()}Ab1`, parseInt(process.env.PASSWORD_ROUNDS || '12', 10));
        await db.run(
          `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, twofa_secret, twofa_enabled, forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [usuario.nome, usuario.email, senhaHash, usuario.perfil, usuario.ativo, usuario.twofa_secret, usuario.twofa_enabled, usuario.senha_expira_em, usuario.ultimo_login_em, usuario.criado_em, usuario.atualizado_em]
        );
        stats.usuarios.created += 1;
      }
    }

    for (const cliente of clientes) {
      const existing = await db.get('SELECT id FROM clientes WHERE cpf = ?', [cliente.cpf]);
      if (existing) {
        await db.run(
          `UPDATE clientes
           SET nome = ?, tipo_documento = ?, email = ?, whatsapp = ?, telefone_secundario = ?, endereco = ?, observacoes = ?, atualizado_em = ?
           WHERE cpf = ?`,
          [cliente.nome, cliente.tipo_documento || 'CPF', cliente.email, cliente.whatsapp, cliente.telefone_secundario, cliente.endereco, cliente.observacoes, cliente.atualizado_em, cliente.cpf]
        );
        stats.clientes.updated += 1;
      } else {
        await db.run(
          `INSERT INTO clientes (nome, cpf, tipo_documento, email, whatsapp, telefone_secundario, endereco, observacoes, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [cliente.nome, cliente.cpf, cliente.tipo_documento || 'CPF', cliente.email, cliente.whatsapp, cliente.telefone_secundario, cliente.endereco, cliente.observacoes, cliente.criado_em, cliente.atualizado_em]
        );
        stats.clientes.created += 1;
      }
    }

    for (const processo of processos) {
      const existing = await db.get('SELECT id FROM processos WHERE numero_processo = ?', [processo.numero_processo]);
      if (existing) {
        await db.run(
          `UPDATE processos
           SET titulo = ?, descricao = ?, autor = ?, reu = ?, status = ?, tipo_acao = ?, valor_causa = ?, data_distribuicao = ?, data_ultima_movimentacao = ?, prazo_final = ?, prioridade = ?, vara = ?, comarca = ?, advogado_autor = ?, advogado_reu = ?, observacoes = ?, cliente_id = ?, atualizado_em = ?
           WHERE numero_processo = ?`,
          [processo.titulo, processo.descricao, processo.autor, processo.reu, processo.status, processo.tipo_acao, processo.valor_causa, processo.data_distribuicao, processo.data_ultima_movimentacao, processo.prazo_final || null, processo.prioridade || 'media', processo.vara, processo.comarca, processo.advogado_autor, processo.advogado_reu, processo.observacoes, processo.cliente_id, processo.atualizado_em, processo.numero_processo]
        );
        stats.processos.updated += 1;
      } else {
        await db.run(
          `INSERT INTO processos (numero_processo, titulo, descricao, autor, reu, status, tipo_acao, valor_causa, data_distribuicao, data_ultima_movimentacao, prazo_final, prioridade, vara, comarca, advogado_autor, advogado_reu, observacoes, cliente_id, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [processo.numero_processo, processo.titulo, processo.descricao, processo.autor, processo.reu, processo.status, processo.tipo_acao, processo.valor_causa, processo.data_distribuicao, processo.data_ultima_movimentacao, processo.prazo_final || null, processo.prioridade || 'media', processo.vara, processo.comarca, processo.advogado_autor, processo.advogado_reu, processo.observacoes, processo.cliente_id, processo.criado_em, processo.atualizado_em]
        );
        stats.processos.created += 1;
      }
    }

    const processosPorIdBackup = new Map(processos.map((processo) => [processo.id, processo.numero_processo]));
    const clientesPorIdBackup = new Map(clientes.map((cliente) => [cliente.id, cliente.cpf]));
    const vinculosBackup = processo_clientes.length
      ?processo_clientes
      : processos
        .filter((processo) => processo.cliente_id)
        .map((processo) => ({ processo_id: processo.id, cliente_id: processo.cliente_id }));

    for (const vinculo of vinculosBackup) {
      const numeroProcesso = processosPorIdBackup.get(vinculo.processo_id);
      const documentoCliente = clientesPorIdBackup.get(vinculo.cliente_id);
      if (!numeroProcesso || !documentoCliente) continue;

      const processoAtual = await db.get('SELECT id FROM processos WHERE numero_processo = ?', [numeroProcesso]);
      const clienteAtual = await db.get('SELECT id FROM clientes WHERE cpf = ?', [documentoCliente]);
      if (!processoAtual || !clienteAtual) continue;

      const existing = await db.get(
        'SELECT processo_id FROM processo_clientes WHERE processo_id = ?AND cliente_id = ?',
        [processoAtual.id, clienteAtual.id]
      );

      if (existing) {
        stats.processo_clientes.updated += 1;
      } else {
        await db.run(
          'INSERT INTO processo_clientes (processo_id, cliente_id) VALUES (?, ?)',
          [processoAtual.id, clienteAtual.id]
        );
        stats.processo_clientes.created += 1;
      }
    }

    for (const movimentacao of movimentacoes) {
      const processoExists = await db.get('SELECT id FROM processos WHERE id = ?', [movimentacao.processo_id]);
      if (processoExists) {
        await db.run(
          'INSERT INTO movimentacoes (processo_id, tipo, descricao, data_movimentacao, criado_em) VALUES (?, ?, ?, ?, ?)',
          [movimentacao.processo_id, movimentacao.tipo, movimentacao.descricao, movimentacao.data_movimentacao, movimentacao.criado_em]
        );
        stats.movimentacoes.created += 1;
      }
    }

    const uploadDir = getUploadBaseDir();
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    for (const anexo of anexos) {
      const existing = await db.get('SELECT id FROM anexos_processo WHERE nome_arquivo = ?', [anexo.nome_arquivo]);
      const absolutePath = resolveStoredUploadPath(anexo.caminho_relativo);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      if (anexo.arquivo_base64) {
        fs.writeFileSync(absolutePath, Buffer.from(anexo.arquivo_base64, 'base64'));
      }
      if (existing) {
        await db.run(
          `UPDATE anexos_processo
           SET processo_id = ?, nome_original = ?, caminho_relativo = ?, mime_type = ?, tamanho_bytes = ?, criado_por_usuario_id = ?, criado_em = ?
           WHERE nome_arquivo = ?`,
          [anexo.processo_id, anexo.nome_original, anexo.caminho_relativo, anexo.mime_type, anexo.tamanho_bytes, anexo.criado_por_usuario_id, anexo.criado_em, anexo.nome_arquivo]
        );
        stats.anexos.updated += 1;
      } else {
        await db.run(
          `INSERT INTO anexos_processo (processo_id, nome_original, nome_arquivo, caminho_relativo, mime_type, tamanho_bytes, criado_por_usuario_id, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [anexo.processo_id, anexo.nome_original, anexo.nome_arquivo, anexo.caminho_relativo, anexo.mime_type, anexo.tamanho_bytes, anexo.criado_por_usuario_id, anexo.criado_em]
        );
        stats.anexos.created += 1;
      }
    }

    for (const up of usuario_permissoes) {
      const usuarioExists = await db.get('SELECT id FROM usuarios WHERE id = ?', [up.usuario_id]);
      const permissaoExists = await db.get('SELECT id FROM permissoes WHERE id = ?', [up.permissao_id]);
      if (!usuarioExists || !permissaoExists) continue;
      const existing = await db.get('SELECT usuario_id FROM usuario_permissoes WHERE usuario_id = ?AND permissao_id = ?', [up.usuario_id, up.permissao_id]);
      if (existing) {
        await db.run('UPDATE usuario_permissoes SET concedido = ?WHERE usuario_id = ?AND permissao_id = ?', [up.concedido, up.usuario_id, up.permissao_id]);
        stats.usuario_permissoes.updated += 1;
      } else {
        await db.run('INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)', [up.usuario_id, up.permissao_id, up.concedido]);
        stats.usuario_permissoes.created += 1;
      }
    }

    await db.close();
    await auditLog(req, 'backup_restore', { tela: 'backup', status: 200, stats });
    return res.json({ success: true, message: 'Backup restaurado com sucesso', stats });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    try { await db.close(); } catch (closeError) {}
    await auditLog(req, 'backup_restore_erro', { tela: 'backup', status: 500, erro: error.message });
    return res.status(500).json({ success: false, message: `Erro ao restaurar backup: ${error.message}` });
  }
}

async function reset(req, res) {
  const db = new Database();

  try {
    const uploadDir = getUploadBaseDir();
    await db.connect();
    await db.run('DELETE FROM anexos_temporarios_processo');
    await db.run('DELETE FROM movimentacoes');
    await db.run('DELETE FROM processo_clientes');
    await db.run('DELETE FROM anexos_processo');
    await db.run('DELETE FROM processos');
    await db.run('DELETE FROM clientes');
    await db.run('DELETE FROM usuario_permissoes');
    await db.run('DELETE FROM historico_senhas');
    await db.run('DELETE FROM reset_tokens');
    await db.run('DELETE FROM auditoria');
    await db.run('DELETE FROM usuarios');
    await db.close();

    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    fs.mkdirSync(uploadDir, { recursive: true });

    const initDb = new Database();
    await initDb.connect();
    await bootstrapAdmin(initDb);
    await initDb.close();

    await auditLog(req, 'system_reset', { tela: 'configuracoes', status: 200, detalhes: 'Sistema resetado completamente' });
    req.session.destroy(() => {});
    return res.json({ success: true, message: 'Sistema resetado com sucesso. Faça login novamente com o admin configurado.' });
  } catch (error) {
    console.error('Erro ao resetar sistema:', error);
    try { await db.close(); } catch (closeError) {}
    return res.status(500).json({ success: false, message: 'Erro ao resetar sistema' });
  }
}

module.exports = { backup, restore, reset };
