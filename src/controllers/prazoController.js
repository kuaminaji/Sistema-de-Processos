const db = require('../database/db');

class PrazoController {
    // Listar todos os prazos ou por processo
    async list(req, res) {
        try {
            const { processo_id } = req.query;
            let sql = `
                SELECT p.*, pr.numero_processo, pr.titulo as processo_titulo
                FROM prazos p
                LEFT JOIN processos pr ON p.processo_id = pr.id
            `;
            const params = [];

            if (processo_id) {
                sql += ' WHERE p.processo_id = ?';
                params.push(processo_id);
            }

            sql += ' ORDER BY p.data_limite ASC';

            const prazos = await db.all(sql, params);
            
            // Calcular dias restantes e status
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            const prazosComStatus = prazos.map(prazo => {
                const dataLimite = new Date(prazo.data_limite);
                dataLimite.setHours(0, 0, 0, 0);
                const diffTime = dataLimite - hoje;
                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                let statusPrazo = 'normal';
                if (prazo.concluido) {
                    statusPrazo = 'concluido';
                } else if (diasRestantes < 0) {
                    statusPrazo = 'vencido';
                } else if (diasRestantes <= prazo.dias_antecedencia) {
                    statusPrazo = 'urgente';
                }
                
                return {
                    ...prazo,
                    dias_restantes: diasRestantes,
                    status_prazo: statusPrazo
                };
            });

            res.json({ success: true, data: prazosComStatus });
        } catch (error) {
            console.error('Erro ao listar prazos:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obter prazo por ID
    async getById(req, res) {
        try {
            const { id } = req.params;
            const prazo = await db.get('SELECT * FROM prazos WHERE id = ?', [id]);
            
            if (!prazo) {
                return res.status(404).json({ success: false, error: 'Prazo não encontrado' });
            }

            res.json({ success: true, data: prazo });
        } catch (error) {
            console.error('Erro ao obter prazo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Criar novo prazo
    async create(req, res) {
        try {
            const { processo_id, descricao, tipo, data_limite, dias_antecedencia, observacoes } = req.body;
            const criado_por = req.session.userId;

            if (!processo_id || !descricao || !tipo || !data_limite) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Campos obrigatórios: processo_id, descricao, tipo, data_limite' 
                });
            }

            const result = await db.run(
                `INSERT INTO prazos (processo_id, descricao, tipo, data_limite, dias_antecedencia, observacoes, criado_por)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [processo_id, descricao, tipo, data_limite, dias_antecedencia || 3, observacoes, criado_por]
            );

            // Atualizar processo com flag de prazo urgente se necessário
            await this.updateProcessoPrazo(processo_id);

            res.status(201).json({ 
                success: true, 
                data: { id: result.lastID },
                message: 'Prazo criado com sucesso' 
            });
        } catch (error) {
            console.error('Erro ao criar prazo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Atualizar prazo
    async update(req, res) {
        try {
            const { id } = req.params;
            const { descricao, tipo, data_limite, dias_antecedencia, concluido, observacoes } = req.body;

            const prazo = await db.get('SELECT * FROM prazos WHERE id = ?', [id]);
            if (!prazo) {
                return res.status(404).json({ success: false, error: 'Prazo não encontrado' });
            }

            await db.run(
                `UPDATE prazos SET descricao = ?, tipo = ?, data_limite = ?, dias_antecedencia = ?, 
                 concluido = ?, observacoes = ? WHERE id = ?`,
                [descricao || prazo.descricao, tipo || prazo.tipo, data_limite || prazo.data_limite,
                 dias_antecedencia !== undefined ? dias_antecedencia : prazo.dias_antecedencia,
                 concluido !== undefined ? concluido : prazo.concluido, observacoes || prazo.observacoes, id]
            );

            // Atualizar processo
            await this.updateProcessoPrazo(prazo.processo_id);

            res.json({ success: true, message: 'Prazo atualizado com sucesso' });
        } catch (error) {
            console.error('Erro ao atualizar prazo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Deletar prazo
    async delete(req, res) {
        try {
            const { id } = req.params;
            const prazo = await db.get('SELECT processo_id FROM prazos WHERE id = ?', [id]);
            
            if (!prazo) {
                return res.status(404).json({ success: false, error: 'Prazo não encontrado' });
            }

            await db.run('DELETE FROM prazos WHERE id = ?', [id]);
            
            // Atualizar processo
            await this.updateProcessoPrazo(prazo.processo_id);

            res.json({ success: true, message: 'Prazo deletado com sucesso' });
        } catch (error) {
            console.error('Erro ao deletar prazo:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Obter prazos urgentes (dashboard)
    async getUrgentes(req, res) {
        try {
            const sql = `
                SELECT p.*, pr.numero_processo, pr.titulo as processo_titulo
                FROM prazos p
                LEFT JOIN processos pr ON p.processo_id = pr.id
                WHERE p.concluido = 0 AND p.data_limite >= date('now')
                ORDER BY p.data_limite ASC
                LIMIT 10
            `;

            const prazos = await db.all(sql);
            
            // Calcular dias restantes
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            const prazosUrgentes = prazos.map(prazo => {
                const dataLimite = new Date(prazo.data_limite);
                dataLimite.setHours(0, 0, 0, 0);
                const diffTime = dataLimite - hoje;
                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return {
                    ...prazo,
                    dias_restantes: diasRestantes,
                    status_prazo: diasRestantes <= prazo.dias_antecedencia ? 'urgente' : 'normal'
                };
            }).filter(p => p.dias_restantes <= 7); // Próximos 7 dias

            res.json({ success: true, data: prazosUrgentes });
        } catch (error) {
            console.error('Erro ao obter prazos urgentes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // Atualizar campos de prazo no processo
    async updateProcessoPrazo(processo_id) {
        try {
            const proximoPrazo = await db.get(
                `SELECT data_limite, dias_antecedencia 
                 FROM prazos 
                 WHERE processo_id = ? AND concluido = 0 AND data_limite >= date('now')
                 ORDER BY data_limite ASC 
                 LIMIT 1`,
                [processo_id]
            );

            if (proximoPrazo) {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const dataLimite = new Date(proximoPrazo.data_limite);
                dataLimite.setHours(0, 0, 0, 0);
                const diffTime = dataLimite - hoje;
                const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const temPrazoUrgente = diasRestantes <= proximoPrazo.dias_antecedencia ? 1 : 0;

                await db.run(
                    `UPDATE processos SET proximo_prazo = ?, dias_ate_prazo = ?, tem_prazo_urgente = ? 
                     WHERE id = ?`,
                    [proximoPrazo.data_limite, diasRestantes, temPrazoUrgente, processo_id]
                );
            } else {
                await db.run(
                    `UPDATE processos SET proximo_prazo = NULL, dias_ate_prazo = NULL, tem_prazo_urgente = 0 
                     WHERE id = ?`,
                    [processo_id]
                );
            }
        } catch (error) {
            console.error('Erro ao atualizar prazo do processo:', error);
        }
    }
}

module.exports = new PrazoController();
