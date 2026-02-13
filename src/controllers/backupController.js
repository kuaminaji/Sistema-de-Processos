const { Database } = require('../database/init');
const { auditLog } = require('../middleware/audit');

// Exportar todos os dados do sistema (backup)
async function backup(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Buscar todos os dados, excluindo senha_hash dos usuários
    const usuarios = await db.all(
      `SELECT id, nome, email, perfil, ativo, twofa_secret, twofa_enabled,
              forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em
       FROM usuarios`,
      []
    );
    
    const clientes = await db.all('SELECT * FROM clientes', []);
    const processos = await db.all('SELECT * FROM processos', []);
    const movimentacoes = await db.all('SELECT * FROM movimentacoes', []);
    const permissoes = await db.all('SELECT * FROM permissoes', []);
    const usuarioPermissoes = await db.all('SELECT * FROM usuario_permissoes', []);
    
    await db.close();
    
    // Montar objeto de backup
    const backupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      exportedBy: req.session.usuario.email,
      data: {
        usuarios,
        clientes,
        processos,
        movimentacoes,
        permissoes,
        usuario_permissoes: usuarioPermissoes
      }
    };
    
    // Registrar auditoria
    await auditLog(req, 'backup_export', {
      tela: 'backup',
      status: 200,
      total_usuarios: usuarios.length,
      total_clientes: clientes.length,
      total_processos: processos.length,
      total_movimentacoes: movimentacoes.length
    });
    
    // Definir headers para download
    const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    return res.json(backupData);
    
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'backup_export_erro', {
      tela: 'backup',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao criar backup'
    });
  }
}

// Restaurar dados do sistema (restore)
async function restore(req, res) {
  const db = new Database();
  
  try {
    const backupData = req.body;
    
    // Validar estrutura do backup
    if (!backupData || !backupData.version || !backupData.data) {
      return res.status(400).json({
        success: false,
        message: 'Formato de backup inválido'
      });
    }
    
    const { usuarios, clientes, processos, movimentacoes, permissoes, usuario_permissoes } = backupData.data;
    
    if (!Array.isArray(usuarios) || !Array.isArray(clientes) || !Array.isArray(processos) ||
        !Array.isArray(movimentacoes) || !Array.isArray(permissoes) || !Array.isArray(usuario_permissoes)) {
      return res.status(400).json({
        success: false,
        message: 'Dados do backup estão incompletos ou inválidos'
      });
    }
    
    await db.connect();
    
    const stats = {
      usuarios: { created: 0, updated: 0 },
      clientes: { created: 0, updated: 0 },
      processos: { created: 0, updated: 0 },
      movimentacoes: { created: 0, updated: 0 },
      permissoes: { created: 0, updated: 0 },
      usuario_permissoes: { created: 0, updated: 0 }
    };
    
    // Restaurar permissões primeiro (dependência)
    for (const permissao of permissoes) {
      const existing = await db.get('SELECT id FROM permissoes WHERE codigo = ?', [permissao.codigo]);
      
      if (existing) {
        await db.run(
          `UPDATE permissoes SET modulo = ?, descricao = ? WHERE codigo = ?`,
          [permissao.modulo, permissao.descricao, permissao.codigo]
        );
        stats.permissoes.updated++;
      } else {
        await db.run(
          `INSERT INTO permissoes (codigo, modulo, descricao) VALUES (?, ?, ?)`,
          [permissao.codigo, permissao.modulo, permissao.descricao]
        );
        stats.permissoes.created++;
      }
    }
    
    // Restaurar usuários (sem senha_hash - não será modificado)
    for (const usuario of usuarios) {
      const existing = await db.get('SELECT id FROM usuarios WHERE email = ?', [usuario.email]);
      
      if (existing) {
        // Atualizar apenas dados não sensíveis
        await db.run(
          `UPDATE usuarios SET 
            nome = ?, perfil = ?, ativo = ?, twofa_enabled = ?,
            forcar_troca_senha = ?, senha_expira_em = ?, ultimo_login_em = ?,
            atualizado_em = ?
          WHERE email = ?`,
          [
            usuario.nome, usuario.perfil, usuario.ativo, usuario.twofa_enabled,
            usuario.forcar_troca_senha, usuario.senha_expira_em, usuario.ultimo_login_em,
            usuario.atualizado_em, usuario.email
          ]
        );
        stats.usuarios.updated++;
      } else {
        // Criar novo usuário com senha padrão temporária
        const bcrypt = require('bcryptjs');
        const crypto = require('crypto');
        const senhaTemporaria = crypto.randomBytes(16).toString('hex');
        const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
        
        await db.run(
          `INSERT INTO usuarios 
            (nome, email, senha_hash, perfil, ativo, twofa_secret, twofa_enabled,
             forcar_troca_senha, senha_expira_em, ultimo_login_em, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [
            usuario.nome, usuario.email, senhaHash, usuario.perfil, usuario.ativo,
            usuario.twofa_secret, usuario.twofa_enabled, usuario.senha_expira_em,
            usuario.ultimo_login_em, usuario.criado_em, usuario.atualizado_em
          ]
        );
        stats.usuarios.created++;
      }
    }
    
    // Restaurar clientes
    for (const cliente of clientes) {
      const existing = await db.get('SELECT id FROM clientes WHERE cpf = ?', [cliente.cpf]);
      
      if (existing) {
        await db.run(
          `UPDATE clientes SET 
            nome = ?, email = ?, whatsapp = ?, telefone_secundario = ?,
            endereco = ?, observacoes = ?, atualizado_em = ?
          WHERE cpf = ?`,
          [
            cliente.nome, cliente.email, cliente.whatsapp, cliente.telefone_secundario,
            cliente.endereco, cliente.observacoes, cliente.atualizado_em, cliente.cpf
          ]
        );
        stats.clientes.updated++;
      } else {
        await db.run(
          `INSERT INTO clientes 
            (nome, cpf, email, whatsapp, telefone_secundario, endereco, observacoes, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            cliente.nome, cliente.cpf, cliente.email, cliente.whatsapp,
            cliente.telefone_secundario, cliente.endereco, cliente.observacoes,
            cliente.criado_em, cliente.atualizado_em
          ]
        );
        stats.clientes.created++;
      }
    }
    
    // Restaurar processos
    for (const processo of processos) {
      const existing = await db.get('SELECT id FROM processos WHERE numero_processo = ?', [processo.numero_processo]);
      
      if (existing) {
        await db.run(
          `UPDATE processos SET 
            titulo = ?, descricao = ?, autor = ?, reu = ?, status = ?,
            tipo_acao = ?, valor_causa = ?, data_distribuicao = ?, data_ultima_movimentacao = ?,
            vara = ?, comarca = ?, advogado_autor = ?, advogado_reu = ?,
            observacoes = ?, cliente_id = ?, atualizado_em = ?
          WHERE numero_processo = ?`,
          [
            processo.titulo, processo.descricao, processo.autor, processo.reu, processo.status,
            processo.tipo_acao, processo.valor_causa, processo.data_distribuicao, processo.data_ultima_movimentacao,
            processo.vara, processo.comarca, processo.advogado_autor, processo.advogado_reu,
            processo.observacoes, processo.cliente_id, processo.atualizado_em, processo.numero_processo
          ]
        );
        stats.processos.updated++;
      } else {
        await db.run(
          `INSERT INTO processos 
            (numero_processo, titulo, descricao, autor, reu, status, tipo_acao, valor_causa,
             data_distribuicao, data_ultima_movimentacao, vara, comarca, advogado_autor,
             advogado_reu, observacoes, cliente_id, criado_em, atualizado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            processo.numero_processo, processo.titulo, processo.descricao, processo.autor,
            processo.reu, processo.status, processo.tipo_acao, processo.valor_causa,
            processo.data_distribuicao, processo.data_ultima_movimentacao, processo.vara,
            processo.comarca, processo.advogado_autor, processo.advogado_reu,
            processo.observacoes, processo.cliente_id, processo.criado_em, processo.atualizado_em
          ]
        );
        stats.processos.created++;
      }
    }
    
    // Restaurar movimentações
    for (const movimentacao of movimentacoes) {
      // Movimentações não têm campo único além do ID, então sempre inserimos novas
      const processoExists = await db.get('SELECT id FROM processos WHERE id = ?', [movimentacao.processo_id]);
      
      if (processoExists) {
        await db.run(
          `INSERT INTO movimentacoes (processo_id, tipo, descricao, data_movimentacao, criado_em)
          VALUES (?, ?, ?, ?, ?)`,
          [
            movimentacao.processo_id, movimentacao.tipo, movimentacao.descricao,
            movimentacao.data_movimentacao, movimentacao.criado_em
          ]
        );
        stats.movimentacoes.created++;
      }
    }
    
    // Restaurar relações usuário-permissões
    for (const up of usuario_permissoes) {
      const usuarioExists = await db.get('SELECT id FROM usuarios WHERE id = ?', [up.usuario_id]);
      const permissaoExists = await db.get('SELECT id FROM permissoes WHERE id = ?', [up.permissao_id]);
      
      if (usuarioExists && permissaoExists) {
        const existing = await db.get(
          'SELECT * FROM usuario_permissoes WHERE usuario_id = ? AND permissao_id = ?',
          [up.usuario_id, up.permissao_id]
        );
        
        if (existing) {
          await db.run(
            `UPDATE usuario_permissoes SET concedido = ? WHERE usuario_id = ? AND permissao_id = ?`,
            [up.concedido, up.usuario_id, up.permissao_id]
          );
          stats.usuario_permissoes.updated++;
        } else {
          await db.run(
            `INSERT INTO usuario_permissoes (usuario_id, permissao_id, concedido) VALUES (?, ?, ?)`,
            [up.usuario_id, up.permissao_id, up.concedido]
          );
          stats.usuario_permissoes.created++;
        }
      }
    }
    
    await db.close();
    
    // Registrar auditoria
    await auditLog(req, 'backup_restore', {
      tela: 'backup',
      status: 200,
      stats
    });
    
    return res.json({
      success: true,
      message: 'Backup restaurado com sucesso',
      stats
    });
    
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    try {
      await db.close();
    } catch (e) {}
    
    await auditLog(req, 'backup_restore_erro', {
      tela: 'backup',
      status: 500,
      erro: error.message
    });
    
    return res.status(500).json({
      success: false,
      message: 'Erro ao restaurar backup: ' + error.message
    });
  }
}

// Resetar sistema (apagar todos os dados e reinicializar)
async function reset(req, res) {
  const db = new Database();
  
  try {
    await db.connect();
    
    // Deletar todos os dados em ordem para respeitar foreign keys
    await db.run('DELETE FROM movimentacoes');
    await db.run('DELETE FROM processos');
    await db.run('DELETE FROM clientes');
    await db.run('DELETE FROM usuario_permissoes');
    await db.run('DELETE FROM auditoria');
    await db.run('DELETE FROM usuarios WHERE id != 1'); // Keep admin for now
    await db.run('DELETE FROM usuarios WHERE id = 1'); // Delete admin last
    
    // Agora reinicializar o banco com dados padrão
    const bcrypt = require('bcryptjs');
    const senhaHash = await bcrypt.hash('admin123', 10);
    
    // Criar usuário admin padrão
    await db.run(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, forcar_troca_senha) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Admin', 'admin@local', senhaHash, 'admin', 1, 0]
    );
    
    // Obter ID do novo admin
    const admin = await db.get('SELECT id FROM usuarios WHERE email = ?', ['admin@local']);
    
    // Atribuir todas as permissões ao admin
    const permissoes = await db.all('SELECT id FROM permissoes');
    for (const permissao of permissoes) {
      await db.run(
        'INSERT INTO usuario_permissoes (usuario_id, permissao_id) VALUES (?, ?)',
        [admin.id, permissao.id]
      );
    }
    
    await db.close();
    
    // Registrar auditoria do reset
    await auditLog(req, 'system_reset', {
      tela: 'configuracoes',
      status: 200,
      detalhes: 'Sistema resetado completamente'
    });
    
    // Destruir sessão atual
    req.session.destroy();
    
    res.json({
      success: true,
      message: 'Sistema resetado com sucesso. Novo admin criado: admin@local / admin123'
    });
  } catch (error) {
    console.error('Erro ao resetar sistema:', error);
    await db.close();
    
    res.status(500).json({
      success: false,
      message: 'Erro ao resetar sistema'
    });
  }
}

module.exports = {
  backup,
  restore,
  reset
};
