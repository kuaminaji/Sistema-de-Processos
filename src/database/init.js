const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/processos.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
        process.exit(1);
    }
    console.log('Conectado ao banco de dados SQLite.');
});

// Create tables
db.serialize(() => {
    // Tabela de processos
    db.run(`
        CREATE TABLE IF NOT EXISTS processos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_processo VARCHAR(50) UNIQUE NOT NULL,
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
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('Erro ao criar tabela processos:', err.message);
        } else {
            console.log('Tabela "processos" criada ou já existe.');
        }
    });

    // Tabela de movimentações
    db.run(`
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
            console.log('Tabela "movimentacoes" criada ou já existe.');
        }
    });

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_processo_numero ON processos(numero_processo)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_processo_status ON processos(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_movimentacao_processo ON movimentacoes(processo_id)`);

    console.log('Índices criados com sucesso.');
});

db.close((err) => {
    if (err) {
        console.error('Erro ao fechar conexão:', err.message);
    } else {
        console.log('Banco de dados inicializado com sucesso!');
    }
});

module.exports = db;
