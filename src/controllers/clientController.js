const db = require('../database/db');
const { cpf: cpfValidator } = require('cpf-cnpj-validator');

class ClientController {
    // List all clients
    async list(req, res) {
        try {
            const { search } = req.query;
            let sql = 'SELECT * FROM clientes WHERE 1=1';
            const params = [];

            if (search) {
                sql += ' AND (nome LIKE ? OR cpf LIKE ? OR email LIKE ?)';
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            sql += ' ORDER BY nome';

            const clientes = await db.all(sql, params);
            res.json({ success: true, data: clientes });
        } catch (error) {
            console.error('Erro ao listar clientes:', error);
            res.status(500).json({ success: false, error: 'Erro ao listar clientes' });
        }
    }

    // Get client by ID
    async get(req, res) {
        try {
            const { id } = req.params;
            const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
            
            if (!cliente) {
                return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
            }

            // Get client's processes
            const processos = await db.all(
                'SELECT * FROM processos WHERE cliente_id = ? ORDER BY data_distribuicao DESC',
                [id]
            );

            res.json({ success: true, data: { ...cliente, processos } });
        } catch (error) {
            console.error('Erro ao obter cliente:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter cliente' });
        }
    }

    // Get client by CPF
    async getByCpf(req, res) {
        try {
            const { cpf } = req.params;
            
            // Clean CPF (remove dots and dashes)
            const cpfLimpo = cpf.replace(/[.-]/g, '');
            
            const cliente = await db.get('SELECT * FROM clientes WHERE REPLACE(REPLACE(cpf, ".", ""), "-", "") = ?', [cpfLimpo]);
            
            if (!cliente) {
                return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
            }

            // Get client's processes
            const processos = await db.all(
                'SELECT * FROM processos WHERE cliente_id = ? ORDER BY data_distribuicao DESC',
                [cliente.id]
            );

            res.json({ success: true, data: { ...cliente, processos } });
        } catch (error) {
            console.error('Erro ao obter cliente por CPF:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter cliente' });
        }
    }

    // Create client
    async create(req, res) {
        try {
            const {
                nome, cpf, email, telefone, celular, whatsapp,
                endereco, cidade, estado, cep, observacoes
            } = req.body;

            if (!nome || !cpf) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nome e CPF são obrigatórios' 
                });
            }

            // Validate CPF
            const cpfLimpo = cpf.replace(/[.-]/g, '');
            if (!cpfValidator.isValid(cpfLimpo)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'CPF inválido' 
                });
            }

            // Check if CPF already exists
            const existingClient = await db.get(
                'SELECT id FROM clientes WHERE REPLACE(REPLACE(cpf, ".", ""), "-", "") = ?', 
                [cpfLimpo]
            );
            if (existingClient) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'CPF já cadastrado' 
                });
            }

            // Format CPF
            const cpfFormatado = cpfValidator.format(cpfLimpo);

            const result = await db.run(
                `INSERT INTO clientes (nome, cpf, email, telefone, celular, whatsapp, endereco, cidade, estado, cep, observacoes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [nome, cpfFormatado, email, telefone, celular, whatsapp, endereco, cidade, estado, cep, observacoes]
            );

            res.status(201).json({
                success: true,
                message: 'Cliente cadastrado com sucesso',
                data: { id: result.id }
            });
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            res.status(500).json({ success: false, error: 'Erro ao criar cliente' });
        }
    }

    // Update client
    async update(req, res) {
        try {
            const { id } = req.params;
            const {
                nome, cpf, email, telefone, celular, whatsapp,
                endereco, cidade, estado, cep, observacoes
            } = req.body;

            const cliente = await db.get('SELECT id FROM clientes WHERE id = ?', [id]);
            if (!cliente) {
                return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
            }

            // Validate CPF if provided
            if (cpf) {
                const cpfLimpo = cpf.replace(/[.-]/g, '');
                if (!cpfValidator.isValid(cpfLimpo)) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'CPF inválido' 
                    });
                }
            }

            const cpfFormatado = cpf ? cpfValidator.format(cpf.replace(/[.-]/g, '')) : undefined;

            await db.run(
                `UPDATE clientes SET 
                    nome = ?, cpf = ?, email = ?, telefone = ?, celular = ?, whatsapp = ?,
                    endereco = ?, cidade = ?, estado = ?, cep = ?, observacoes = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [nome, cpfFormatado, email, telefone, celular, whatsapp, endereco, cidade, estado, cep, observacoes, id]
            );

            res.json({ success: true, message: 'Cliente atualizado com sucesso' });
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar cliente' });
        }
    }

    // Delete client
    async delete(req, res) {
        try {
            const { id } = req.params;

            const cliente = await db.get('SELECT id FROM clientes WHERE id = ?', [id]);
            if (!cliente) {
                return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
            }

            // Check if client has processes
            const processos = await db.all('SELECT id FROM processos WHERE cliente_id = ?', [id]);
            if (processos.length > 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Não é possível excluir cliente com processos vinculados' 
                });
            }

            await db.run('DELETE FROM clientes WHERE id = ?', [id]);

            res.json({ success: true, message: 'Cliente excluído com sucesso' });
        } catch (error) {
            console.error('Erro ao excluir cliente:', error);
            res.status(500).json({ success: false, error: 'Erro ao excluir cliente' });
        }
    }

    // Send WhatsApp notification
    async sendWhatsApp(req, res) {
        try {
            const { id } = req.params;
            const { mensagem } = req.body;

            const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
            if (!cliente) {
                return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
            }

            if (!cliente.whatsapp) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Cliente não possui WhatsApp cadastrado' 
                });
            }

            // Format WhatsApp number (remove special characters)
            const whatsappNumber = cliente.whatsapp.replace(/[^\d]/g, '');
            
            // Generate WhatsApp web link
            const whatsappLink = `https://wa.me/55${whatsappNumber}?text=${encodeURIComponent(mensagem)}`;

            res.json({
                success: true,
                message: 'Link do WhatsApp gerado com sucesso',
                whatsappLink
            });
        } catch (error) {
            console.error('Erro ao gerar link do WhatsApp:', error);
            res.status(500).json({ success: false, error: 'Erro ao gerar link do WhatsApp' });
        }
    }
}

module.exports = new ClientController();
