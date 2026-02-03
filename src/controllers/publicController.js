const db = require('../database/db');

class PublicController {
    // Search process by number or client CPF
    async search(req, res) {
        try {
            const { query } = req.params;
            
            if (!query) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Informe um número de processo ou CPF' 
                });
            }

            let processos = [];

            // Try to search by process number first
            const processo = await db.get(
                'SELECT p.*, c.nome as cliente_nome, c.cpf as cliente_cpf FROM processos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.numero_processo = ?',
                [query]
            );

            if (processo) {
                // Get movements for this process
                const movimentacoes = await db.all(
                    'SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data_movimentacao DESC',
                    [processo.id]
                );
                processo.movimentacoes = movimentacoes;
                processos = [processo];
            } else {
                // Search by CPF
                const cpfLimpo = query.replace(/[.-]/g, '');
                
                // Find client by CPF
                const cliente = await db.get(
                    'SELECT id FROM clientes WHERE REPLACE(REPLACE(cpf, ".", ""), "-", "") = ?',
                    [cpfLimpo]
                );

                if (cliente) {
                    // Get all processes for this client
                    processos = await db.all(
                        'SELECT p.*, c.nome as cliente_nome, c.cpf as cliente_cpf FROM processos p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.cliente_id = ? ORDER BY p.data_distribuicao DESC',
                        [cliente.id]
                    );

                    // Get movements for each process
                    for (let i = 0; i < processos.length; i++) {
                        const movimentacoes = await db.all(
                            'SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data_movimentacao DESC',
                            [processos[i].id]
                        );
                        processos[i].movimentacoes = movimentacoes;
                    }
                }
            }

            if (processos.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Nenhum processo encontrado' 
                });
            }

            res.json({
                success: true,
                data: processos
            });
        } catch (error) {
            console.error('Erro ao buscar processos:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erro ao buscar processos' 
            });
        }
    }
}

module.exports = new PublicController();
