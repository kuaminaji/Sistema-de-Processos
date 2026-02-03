const bcrypt = require('bcrypt');
const db = require('../database/db');

class UserController {
    // List all users
    async list(req, res) {
        try {
            const usuarios = await db.all(
                'SELECT id, nome, email, role, ativo, criado_em FROM usuarios ORDER BY nome'
            );
            
            res.json({ success: true, data: usuarios });
        } catch (error) {
            console.error('Erro ao listar usuários:', error);
            res.status(500).json({ success: false, error: 'Erro ao listar usuários' });
        }
    }

    // Get user by ID
    async get(req, res) {
        try {
            const { id } = req.params;
            
            const usuario = await db.get(
                'SELECT id, nome, email, role, ativo, criado_em FROM usuarios WHERE id = ?',
                [id]
            );
            
            if (!usuario) {
                return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
            }
            
            res.json({ success: true, data: usuario });
        } catch (error) {
            console.error('Erro ao obter usuário:', error);
            res.status(500).json({ success: false, error: 'Erro ao obter usuário' });
        }
    }

    // Create user
    async create(req, res) {
        try {
            const { nome, email, senha, role } = req.body;

            if (!nome || !email || !senha) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Nome, email e senha são obrigatórios' 
                });
            }

            if (senha.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'A senha deve ter pelo menos 6 caracteres' 
                });
            }

            // Check if email already exists
            const existingUser = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
            if (existingUser) {
                return res.status(409).json({ 
                    success: false, 
                    error: 'Email já cadastrado' 
                });
            }

            const senhaHash = await bcrypt.hash(senha, 10);
            
            const result = await db.run(
                'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
                [nome, email, senhaHash, role || 'lawyer']
            );

            res.status(201).json({
                success: true,
                message: 'Usuário criado com sucesso',
                data: { id: result.id }
            });
        } catch (error) {
            console.error('Erro ao criar usuário:', error);
            res.status(500).json({ success: false, error: 'Erro ao criar usuário' });
        }
    }

    // Update user
    async update(req, res) {
        try {
            const { id } = req.params;
            const { nome, email, role, ativo, senha } = req.body;

            const usuario = await db.get('SELECT id FROM usuarios WHERE id = ?', [id]);
            if (!usuario) {
                return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
            }

            let sql = 'UPDATE usuarios SET nome = ?, email = ?, role = ?, ativo = ?, atualizado_em = CURRENT_TIMESTAMP';
            let params = [nome, email, role, ativo !== undefined ? ativo : 1];

            if (senha && senha.length > 0) {
                if (senha.length < 6) {
                    return res.status(400).json({ 
                        success: false, 
                        error: 'A senha deve ter pelo menos 6 caracteres' 
                    });
                }
                const senhaHash = await bcrypt.hash(senha, 10);
                sql += ', senha_hash = ?';
                params.push(senhaHash);
            }

            sql += ' WHERE id = ?';
            params.push(id);

            await db.run(sql, params);

            res.json({ success: true, message: 'Usuário atualizado com sucesso' });
        } catch (error) {
            console.error('Erro ao atualizar usuário:', error);
            res.status(500).json({ success: false, error: 'Erro ao atualizar usuário' });
        }
    }

    // Delete user
    async delete(req, res) {
        try {
            const { id } = req.params;

            // Don't allow deleting yourself
            if (parseInt(id) === req.session.userId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Não é possível excluir seu próprio usuário' 
                });
            }

            const usuario = await db.get('SELECT id FROM usuarios WHERE id = ?', [id]);
            if (!usuario) {
                return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
            }

            await db.run('DELETE FROM usuarios WHERE id = ?', [id]);

            res.json({ success: true, message: 'Usuário excluído com sucesso' });
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            res.status(500).json({ success: false, error: 'Erro ao excluir usuário' });
        }
    }
}

module.exports = new UserController();
