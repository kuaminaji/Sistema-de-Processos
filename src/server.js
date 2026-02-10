require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const csurf = require('csurf');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { Database } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de segurança
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Trust proxy se configurado
if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sessão
// Note: CSRF protection is selectively applied per route
// Auth endpoints use skipCSRFForAPI middleware to allow API requests
// Other endpoints use csrfProtection middleware explicitly
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 horas
  }
}));

// Warn if using default session secret in production
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: Using default SESSION_SECRET in production. Please set SESSION_SECRET environment variable!');
}

// Rate limiting global
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// CSRF protection
const csrfProtection = csurf({ cookie: false });

// Rota para obter token CSRF
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Rotas da API
const authRoutes = require('./routes/auth');
const processosRoutes = require('./routes/processos');
const clientesRoutes = require('./routes/clientes');
const movimentacoesRoutes = require('./routes/movimentacoes');
const usuariosRoutes = require('./routes/usuarios');
const permissoesRoutes = require('./routes/permissoes');
const publicRoutes = require('./routes/public');
const auditoriaRoutes = require('./routes/auditoria');
const backupRoutes = require('./routes/backup');
const exportRoutes = require('./routes/export');

app.use('/api/auth', authRoutes);
app.use('/api/processos', csrfProtection, processosRoutes);
app.use('/api/clientes', csrfProtection, clientesRoutes);
app.use('/api/movimentacoes', csrfProtection, movimentacoesRoutes);
app.use('/api/usuarios', csrfProtection, usuariosRoutes);
app.use('/api/permissoes', csrfProtection, permissoesRoutes);
app.use('/api/public', publicRoutes); // No CSRF for public routes
app.use('/api/auditoria', csrfProtection, auditoriaRoutes);
app.use('/api/backup', csrfProtection, backupRoutes);
app.use('/api/export', csrfProtection, exportRoutes);

// Rota raiz - redireciona para index.html
app.get('/', (req, res) => {
  res.redirect('/index.html');
});

// Handler de erro 404
app.use(notFoundHandler);

// Handler de erro global
app.use(errorHandler);

// Iniciar servidor
async function start() {
  try {
    // Testar conexão com banco
    const db = new Database();
    await db.connect();
    await db.close();
    console.log('✅ Conexão com banco de dados OK');
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📝 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 URL: http://localhost:${PORT}`);
      console.log(`\n📊 Dashboard: http://localhost:${PORT}/admin.html`);
      console.log(`🔍 Consulta Pública: http://localhost:${PORT}/consulta.html`);
      console.log(`\n⚠️  Credenciais padrão:`);
      console.log(`   Email: ${process.env.ADMIN_EMAIL || 'admin@local'}`);
      console.log(`   Senha: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
      console.log(`   (Altere a senha no primeiro login!)\n`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
