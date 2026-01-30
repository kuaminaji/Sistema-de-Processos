const db = require('../database/db');

class ProcessoController {
    // Get all processes with optional filters
    async listarProcessos(req, res) {
        try {
            const { status, numero, autor, reu } = req.query;
            let sql = 'SELECT * FROM processos WHERE 1=1';
            const params = [];

            if (status) {
                sql += ' AND status = ?';
                params.push(status);
            }
            if (numero) {
                sql += ' AND numero_processo LIKE ?';
                params.push(`%${numero}%`);
            }
            if (autor) {
                sql += ' AND autor LIKE ?';
                params.push(`%${autor}%`);
            }
            if (reu) {
                sql += ' AND reu LIKE ?';
                params.push(`%${reu}%`);
            }

            sql += ' ORDER BY data_ultima_movimentacao DESC, criado_em DESC';

            const processos = await db.all(sql, params);
            res.json({ success: true, data: processos });
        } catch (error) {
            console.error('Erro ao listar processos:', error);
            res.status(500).json({ success: false, error: 'Erro ao listar processos' });
        }
    }

    // Get a single process by ID
    async obterProcesso(req, res) {
        try {
            const { id } = req.params;
            const processo = await db.get('SELECT * FROM processos WHERE id = ?', [id]);
            
            if (!processo) {
                return res.status(404).json({ success: false, error: 'Processo não encontrado' });
            }

            // Get associated movimentacoes
            const movimentacoes = await db.all(
                'SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data_movimentacao DESC',
                [id]
            );

            res.json({ success: true, data: { ...processo, movimentacoes } });
        } catch (error) {
            console.error('Erro ao obter processo:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter processo' });
        }
    }

    // Create a new process
    async criarProcesso(req, res) {
        try {
            const {
                numero_processo,
                titulo,
                descricao,
                autor,
                reu,
                status,
                tipo_acao,
                valor_causa,
                data_distribuicao,
                vara,
                comarca,
                advogado_autor,
                advogado_reu,
                observacoes
            } = req.body;

            const sql = `
                INSERT INTO processos (
                    numero_processo, titulo, descricao, autor, reu, status,
                    tipo_acao, valor_causa, data_distribuicao, vara, comarca,
                    advogado_autor, advogado_reu, observacoes, data_ultima_movimentacao
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            const params = [
                numero_processo,
                titulo,
                descricao,
                autor,
                reu,
                status || 'Em Andamento',
                tipo_acao,
                valor_causa,
                data_distribuicao,
                vara,
                comarca,
                advogado_autor,
                advogado_reu,
                observacoes
            ];

            const result = await db.run(sql, params);

            res.status(201).json({
                success: true,
                message: 'Processo criado com sucesso',
                data: { id: result.id }
            });
        } catch (error) {
            console.error('Erro ao criar processo:', error);
            if (error.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ success: false, error: 'Número de processo já existe' });
            } else {
                res.status(500).json({ success: false, error: 'Erro ao criar processo' });
            }
        }
    }

    // Update a process
    async atualizarProcesso(req, res) {
        try {
            const { id } = req.params;
            const {
                numero_processo,
                titulo,
                descricao,
                autor,
                reu,
                status,
                tipo_acao,
                valor_causa,
                data_distribuicao,
                vara,
                comarca,
                advogado_autor,
                advogado_reu,
                observacoes
            } = req.body;

            // Check if process exists
            const existingProcess = await db.get('SELECT id FROM processos WHERE id = ?', [id]);
            if (!existingProcess) {
                return res.status(404).json({ success: false, error: 'Processo não encontrado' });
            }

            const sql = `
                UPDATE processos SET
                    numero_processo = ?, titulo = ?, descricao = ?, autor = ?, reu = ?,
                    status = ?, tipo_acao = ?, valor_causa = ?, data_distribuicao = ?,
                    vara = ?, comarca = ?, advogado_autor = ?, advogado_reu = ?,
                    observacoes = ?, atualizado_em = CURRENT_TIMESTAMP,
                    data_ultima_movimentacao = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            const params = [
                numero_processo,
                titulo,
                descricao,
                autor,
                reu,
                status,
                tipo_acao,
                valor_causa,
                data_distribuicao,
                vara,
                comarca,
                advogado_autor,
                advogado_reu,
                observacoes,
                id
            ];

            await db.run(sql, params);

            res.json({ success: true, message: 'Processo atualizado com sucesso' });
        } catch (error) {
            console.error('Erro ao atualizar processo:', error);
            if (error.message.includes('UNIQUE constraint failed')) {
                res.status(409).json({ success: false, error: 'Número de processo já existe' });
            } else {
                res.status(500).json({ success: false, error: 'Erro ao atualizar processo' });
            }
        }
    }

    // Delete a process
    async deletarProcesso(req, res) {
        try {
            const { id } = req.params;

            // Check if process exists
            const existingProcess = await db.get('SELECT id FROM processos WHERE id = ?', [id]);
            if (!existingProcess) {
                return res.status(404).json({ success: false, error: 'Processo não encontrado' });
            }

            await db.run('DELETE FROM processos WHERE id = ?', [id]);

            res.json({ success: true, message: 'Processo deletado com sucesso' });
        } catch (error) {
            console.error('Erro ao deletar processo:', error);
            res.status(500).json({ success: false, error: 'Erro ao deletar processo' });
        }
    }

    // Add movimentacao to a process
    async adicionarMovimentacao(req, res) {
        try {
            const { id } = req.params;
            const { tipo, descricao, data_movimentacao } = req.body;

            // Check if process exists
            const processo = await db.get('SELECT id FROM processos WHERE id = ?', [id]);
            if (!processo) {
                return res.status(404).json({ success: false, error: 'Processo não encontrado' });
            }

            const sql = `
                INSERT INTO movimentacoes (processo_id, tipo, descricao, data_movimentacao)
                VALUES (?, ?, ?, ?)
            `;

            await db.run(sql, [id, tipo, descricao, data_movimentacao]);

            // Update process last movement date
            await db.run(
                'UPDATE processos SET data_ultima_movimentacao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
                [data_movimentacao, id]
            );

            res.status(201).json({
                success: true,
                message: 'Movimentação adicionada com sucesso'
            });
        } catch (error) {
            console.error('Erro ao adicionar movimentação:', error);
            res.status(500).json({ success: false, error: 'Erro ao adicionar movimentação' });
        }
    }

    // Get statistics
    async obterEstatisticas(req, res) {
        try {
            const totalProcessos = await db.get('SELECT COUNT(*) as total FROM processos');
            const processosPorStatus = await db.all(
                'SELECT status, COUNT(*) as count FROM processos GROUP BY status'
            );
            const ultimasMovimentacoes = await db.all(`
                SELECT p.numero_processo, p.titulo, m.tipo, m.data_movimentacao
                FROM movimentacoes m
                JOIN processos p ON m.processo_id = p.id
                ORDER BY m.data_movimentacao DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                data: {
                    total: totalProcessos.total,
                    porStatus: processosPorStatus,
                    ultimasMovimentacoes
                }
            });
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
        }
    }
}

module.exports = new ProcessoController();
