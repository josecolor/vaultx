-- ============================================
-- VAULTX - Esquema de base de datos (Postgres)
-- ============================================

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- TABLA: creators (diseñadores/marcas)
-- ============================================
CREATE TABLE IF NOT EXISTS creators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    bio TEXT,
    ciudad VARCHAR(100),
    genero_musical VARCHAR(100),
    email VARCHAR(150) UNIQUE,
    estado_membresia VARCHAR(20) DEFAULT 'pendiente', -- pendiente | activa | vencida
    documentos_cifrados TEXT, -- blob cifrado AES-256 (pasaporte/cédula/patente)
    documentos_iv VARCHAR(32), -- vector de inicialización usado en el cifrado
    verificado BOOLEAN DEFAULT FALSE,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: pieces (piezas de colección)
-- ============================================
CREATE TABLE IF NOT EXISTS pieces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES creators(id) ON DELETE CASCADE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(255),
    color_dominante_hex VARCHAR(7), -- ej: #1a1a1a, usado para sync cromática IA
    precio NUMERIC(10,2),
    fecha_drop TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'borrador', -- borrador | activa | agotada | archivada
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: drops (cuentas regresivas de lanzamiento)
-- ============================================
CREATE TABLE IF NOT EXISTS drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piece_id UUID REFERENCES pieces(id) ON DELETE CASCADE,
    countdown_start TIMESTAMP NOT NULL,
    countdown_end TIMESTAMP NOT NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLA: waitlist (lista de espera / early access)
-- ============================================
CREATE TABLE IF NOT EXISTS waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact VARCHAR(150) NOT NULL, -- email o whatsapp
    piece_id UUID REFERENCES pieces(id) ON DELETE CASCADE,
    fecha TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ÍNDICES para consultas frecuentes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pieces_estado ON pieces(estado);
CREATE INDEX IF NOT EXISTS idx_pieces_fecha_drop ON pieces(fecha_drop DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_piece ON waitlist(piece_id);
CREATE INDEX IF NOT EXISTS idx_creators_estado ON creators(estado_membresia);
