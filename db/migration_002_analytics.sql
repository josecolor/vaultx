CREATE TABLE IF NOT EXISTS analytics_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path VARCHAR(255),
    session_id VARCHAR(64),
    ip_hash VARCHAR(64),
    user_agent TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    primera_visita TIMESTAMP DEFAULT NOW(),
    ultima_actividad TIMESTAMP DEFAULT NOW(),
    total_paginas_vistas INT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_analytics_visits_creado ON analytics_visits(creado_en);
