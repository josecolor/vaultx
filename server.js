const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
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
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido.'), false);
    }
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'VaultX', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/piece-of-the-day', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, descripcion, imagen, color_dominante_hex, fecha_drop
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

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : null;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  console.error('[VaultX] ADVERTENCIA: ENCRYPTION_KEY no está configurada o es inválida.');
}

function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decryptBuffer(ciphertextBase64, ivHex, authTagHex) {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(ciphertextBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

async function emailYaRegistrado(email) {
  const result = await pool.query(
    'SELECT id FROM creators WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  return result.rows.length > 0;
}

app.post('/api/creators/apply', strictLimiter, upload.single('documento'), async (req, res) => {
  const { nombre, bio, ciudad, genero_musical, email } = req.body;

  if (!nombre || !email) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
  }

  const emailNormalizado = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailNormalizado)) {
    return res.status(400).json({ error: 'Correo electrónico inválido.' });
  }

  try {
    const yaExiste = await emailYaRegistrado(emailNormalizado);
    if (yaExiste) {
      return res.status(409).json({
        error: 'Este correo ya tiene una postulación registrada. El registro es único por diseñador.'
      });
    }

    let documentosCifrados = null;
    let documentosIv = null;
    let documentosAuthTag = null;
    let documentoNombreOriginal = null;
    let documentoMime = null;

    if (req.file) {
      if (!ENCRYPTION_KEY) {
        return res.status(500).json({ error: 'El sistema de cifrado no está disponible en este momento.' });
      }
      const { ciphertext, iv, authTag } = encryptBuffer(req.file.buffer);
      documentosCifrados = ciphertext;
      documentosIv = iv;
      documentosAuthTag = authTag;
      documentoNombreOriginal = req.file.originalname;
      documentoMime = req.file.mimetype;
    }

    const result = await pool.query(
      `INSERT INTO creators
        (nombre, bio, ciudad, genero_musical, email, estado_membresia,
         documentos_cifrados, documentos_iv, documentos_auth_tag,
         documentos_nombre_original, documentos_mime, verificado)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, $7, $8, $9, $10, false)
       RETURNING id, nombre, email, estado_membresia, creado_en`,
      [
        nombre.trim(),
        bio || null,
        ciudad || null,
        genero_musical || null,
        emailNormalizado,
        documentosCifrados,
        documentosIv,
        documentosAuthTag,
        documentoNombreOriginal,
        documentoMime
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Postulación recibida. Nuestro equipo la revisará pronto.',
      creator: result.rows[0]
    });
  } catch (err) {
    console.error('[VaultX] Error en /api/creators/apply:', err.message);
    res.status(500).json({ error: 'Error al procesar la postulación.' });
  }
});

app.use((err, req, res, next) => {
  console.error('[VaultX] Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.listen(PORT, () => {
  console.log(`[VaultX] Servidor corriendo en el puerto ${PORT}`);
});
