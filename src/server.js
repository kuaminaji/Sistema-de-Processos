require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const cors = require('cors');
const csurf = require('csurf');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { Database, migrateSchema, bootstrapAdmin } = require('./database/init');
const { getUploadBaseDir, getBrandingBaseDir } = require('./utils/storagePaths');

const app = express();
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

const appReady = (async () => {
  const db = new Database();
  await db.connect();
  await migrateSchema(db);
  await bootstrapAdmin(db);
  await db.close();
})();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'data:'],
      frameSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(getUploadBaseDir()));
app.use('/branding', express.static(getBrandingBaseDir()));
app.use(async (req, res, next) => {
  try {
    await appReady;
    next();
  } catch (error) {
    next(error);
  }
});

const csrfProtection = csurf({ cookie: false });

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    message: 'Muitas requisicoes. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => (
    req.path === '/api/csrf-token' ||
    req.path.startsWith('/css') ||
    req.path.startsWith('/js') ||
    req.path.startsWith('/images') ||
    req.path.startsWith('/uploads')
  )
});

app.use(limiter);

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
app.use('/api/public', publicRoutes);
app.use('/api/auditoria', csrfProtection, auditoriaRoutes);
app.use('/api/backup', csrfProtection, backupRoutes);
app.use('/api/export', csrfProtection, exportRoutes);

app.get('/', (req, res) => {
  res.redirect('/index.html');
});

app.use(notFoundHandler);
app.use(errorHandler);

async function start(options = {}) {
  const port = typeof options.port === 'number' ?options.port : DEFAULT_PORT;
  const host = options.host || '127.0.0.1';
  const exitOnError = options.exitOnError !== false;

  try {
    await appReady;

    const server = await new Promise((resolve, reject) => {
      const instance = app.listen(port, host, () => resolve(instance));
      instance.once('error', reject);
    });

    const address = server.address();
    const resolvedPort = typeof address === 'object' && address ?address.port : port;
    console.log(`Servidor iniciado em http://${host}:${resolvedPort}`);
    return server;
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    if (exitOnError) {
      process.exit(1);
    }
    throw error;
  }
}

if (require.main === module) {
  start();
}

module.exports = {
  app,
  start,
  appReady
};
