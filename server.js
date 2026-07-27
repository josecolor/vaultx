// ============================================
// VAULTX - Backend principal (MXL Architecture)
// Archivo monolítico - sin require() de módulos propios
// ============================================

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONEXIÓN A POSTGRES (Railway)
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect()
  .then(client => {
    console.log('[VaultX] Conectado a Postgres correctamente.');
    client.release();
  })
  .catch(err => {
    console.error('[VaultX] Error conectando a Postgres:', err.message);
  });

// ============================================
// SEGURIDAD - HELMET (headers, CSP, anti-clickjacking)
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// ============================================
// RATE LIMITING - Protección anti-bots
// ============================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta más tarde.' }
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Límite de intentos alcanzado. Espera 15 minutos.' }
});

app.use(generalLimiter);

// ============================================
// SESIONES SEGURAS (persistidas en Postgres)
// ============================================
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'vaultx-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax'
  }
}));

// ============================================
// PARSERS
// ============================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ============================================
// SUBIDA DE ARCHIVOS SEGURA (multer)
// Documentos sensibles: validación estricta de MIME y tamaño
// ============================================
const storage = multer.memoryStorage(); // nunca a disco sin cifrar
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido.'), false);
    }
  }
});

// ============================================
// ARCHIVOS ESTÁTICOS (frontend)
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// RUTAS BASE
// ============================================

// Health check (para Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'VaultX', timestamp: new Date().toISOString() });
});

// Ruta principal - sirve la vitrina
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint de ejemplo: obtener la pieza del día (para sync cromática)
app.get('/api/piece-of-the-day', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, imagen, color_dominante_hex, fecha_drop
       FROM pieces
       WHERE estado = 'activa'
       ORDER BY fecha_drop DESC
       LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error('[VaultX] Error en /api/piece-of-the-day:', err.message);
    res.status(500).json({ error: 'Error al obtener la pieza del día.' });
  }
});

// Endpoint de ejemplo: unirse a waitlist (con rate limit estricto)
app.post('/api/waitlist', strictLimiter, async (req, res) => {
  const { contact, piece_id } = req.body;
  if (!contact || !piece_id) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }
  try {
    await pool.query(
      `INSERT INTO waitlist (contact, piece_id, fecha) VALUES ($1, $2, NOW())`,
      [contact, piece_id]
    );
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('[VaultX] Error en /api/waitlist:', err.message);
    res.status(500).json({ error: 'Error al registrar en la lista de espera.' });
  }
});

// ============================================
// MANEJO DE ERRORES GLOBAL
// ============================================
app.use((err, req, res, next) => {
  console.error('[VaultX] Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`[VaultX] Servidor corriendo en el puerto ${PORT}`);
});
