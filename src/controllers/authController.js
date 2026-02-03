const bcrypt = require('bcrypt');
const db = require('../database/db');

class AuthController {
    // Login
    async login(req, res) {
        try {
            const { email, senha } = req.body;

            if (!email || !senha) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email e senha são obrigatórios' 
                });
            }

            const usuario = await db.get(
                'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
                [email]
            );

            if (!usuario) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Credenciais inválidas' 
                });
            }

            const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

            if (!senhaValida) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Credenciais inválidas' 
                });
            }

            // Create session
            req.session.userId = usuario.id;
            req.session.userEmail = usuario.email;
            req.session.userName = usuario.nome;
            req.session.userRole = usuario.role;

            res.json({
                success: true,
                message: 'Login realizado com sucesso',
                user: {
                    id: usuario.id,
                    nome: usuario.nome,
                    email: usuario.email,
                    role: usuario.role
                }
            });
        } catch (error) {
            console.error('Erro ao fazer login:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erro ao fazer login' 
            });
        }
    }

    // Logout
    logout(req, res) {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ 
                    success: false, 
                    error: 'Erro ao fazer logout' 
                });
            }
            res.json({ 
                success: true, 
                message: 'Logout realizado com sucesso' 
            });
        });
    }

    // Get current user
    async getCurrentUser(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Não autenticado' 
                });
            }

            const usuario = await db.get(
                'SELECT id, nome, email, role FROM usuarios WHERE id = ?',
                [req.session.userId]
            );

            if (!usuario) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Usuário não encontrado' 
                });
            }

            res.json({
                success: true,
                user: usuario
            });
        } catch (error) {
            console.error('Erro ao obter usuário atual:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erro ao obter usuário' 
            });
        }
    }

    // Change password
    async changePassword(req, res) {
        try {
            const { senhaAtual, novaSenha } = req.body;

            if (!senhaAtual || !novaSenha) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Senha atual e nova senha são obrigatórias' 
                });
            }

            if (novaSenha.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'A nova senha deve ter pelo menos 6 caracteres' 
                });
            }

            const usuario = await db.get(
                'SELECT * FROM usuarios WHERE id = ?',
                [req.session.userId]
            );

            const senhaValida = await bcrypt.compare(senhaAtual, usuario.senha_hash);

            if (!senhaValida) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Senha atual incorreta' 
                });
            }

            const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

            await db.run(
                'UPDATE usuarios SET senha_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
                [novaSenhaHash, req.session.userId]
            );

            res.json({
                success: true,
                message: 'Senha alterada com sucesso'
            });
        } catch (error) {
            console.error('Erro ao alterar senha:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Erro ao alterar senha' 
            });
        }
    }
}

module.exports = new AuthController();
