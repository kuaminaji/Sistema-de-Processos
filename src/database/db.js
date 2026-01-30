const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/processos.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

class Database {
    constructor() {
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erro ao conectar ao banco de dados:', err.message);
            } else {
                console.log('Conectado ao banco de dados SQLite.');
                this.initializeTables();
            }
        });
    }

    // Initialize database tables
    initializeTables() {
        this.db.serialize(() => {
            // Tabela de processos
            this.db.run(`
                CREATE TABLE IF NOT EXISTS processos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    numero_processo VARCHAR(50) UNIQUE NOT NULL,
                    cliente_id INTEGER,
                    titulo VARCHAR(200) NOT NULL,
                    descricao TEXT,
                    autor VARCHAR(150) NOT NULL,
                    reu VARCHAR(150) NOT NULL,
                    status VARCHAR(50) DEFAULT 'Em Andamento',
                    tipo_acao VARCHAR(100),
                    valor_causa DECIMAL(15, 2),
                    data_distribuicao DATE NOT NULL,
                    data_ultima_movimentacao DATETIME,
                    vara VARCHAR(100),
                    comarca VARCHAR(100),
                    advogado_autor VARCHAR(150),
                    advogado_reu VARCHAR(150),
                    observacoes TEXT,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL
                )
            `, (err) => {
                if (err) {
                    console.error('Erro ao criar tabela processos:', err.message);
                } else {
                    console.log('Tabela "processos" verificada/criada com sucesso.');
                }
            });

            // Tabela de movimentações
            this.db.run(`
                CREATE TABLE IF NOT EXISTS movimentacoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    processo_id INTEGER NOT NULL,
                    tipo VARCHAR(100) NOT NULL,
                    descricao TEXT NOT NULL,
                    data_movimentacao DATETIME NOT NULL,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE
                )
            `, (err) => {
                if (err) {
                    console.error('Erro ao criar tabela movimentacoes:', err.message);
                } else {
                    console.log('Tabela "movimentacoes" verificada/criada com sucesso.');
                }
            });

            // Tabela de usuários
            this.db.run(`
                CREATE TABLE IF NOT EXISTS usuarios (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome VARCHAR(150) NOT NULL,
                    email VARCHAR(150) UNIQUE NOT NULL,
                    senha_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'lawyer',
                    ativo BOOLEAN DEFAULT 1,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Erro ao criar tabela usuarios:', err.message);
                } else {
                    console.log('Tabela "usuarios" verificada/criada com sucesso.');
                    this.createDefaultAdmin();
                }
            });

            // Tabela de clientes
            this.db.run(`
                CREATE TABLE IF NOT EXISTS clientes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome VARCHAR(200) NOT NULL,
                    cpf VARCHAR(14) UNIQUE NOT NULL,
                    email VARCHAR(150),
                    telefone VARCHAR(20),
                    celular VARCHAR(20),
                    whatsapp VARCHAR(20),
                    endereco TEXT,
                    cidade VARCHAR(100),
                    estado VARCHAR(2),
                    cep VARCHAR(10),
                    observacoes TEXT,
                    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Erro ao criar tabela clientes:', err.message);
                } else {
                    console.log('Tabela "clientes" verificada/criada com sucesso.');
                }
            });

            // Create indexes for better performance
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_processo_numero ON processos(numero_processo)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_processo_status ON processos(status)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacao_processo ON movimentacoes(processo_id)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_cliente_cpf ON clientes(cpf)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuarios(email)`);
        });
    }

    // Create default admin user
    async createDefaultAdmin() {
        try {
            const bcrypt = require('bcrypt');
            const existingAdmin = await this.get('SELECT id FROM usuarios WHERE email = ?', ['admin@sistema.com']);
            
            if (!existingAdmin) {
                const senhaHash = await bcrypt.hash('admin123', 10);
                await this.run(
                    'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES (?, ?, ?, ?)',
                    ['Administrador', 'admin@sistema.com', senhaHash, 'admin']
                );
                console.log('Usuário administrador padrão criado: admin@sistema.com / admin123');
            }
        } catch (error) {
            console.error('Erro ao criar usuário administrador:', error);
        }
    }

    // Get all records with optional filters
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Get a single record
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Run INSERT, UPDATE, DELETE
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = new Database();
