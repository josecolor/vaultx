-- ============================================
-- MIGRACIÓN: soporte completo para cifrado AES-256-GCM
-- ============================================
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS documentos_auth_tag VARCHAR(32),
  ADD COLUMN IF NOT EXISTS documentos_nombre_original VARCHAR(255),
  ADD COLUMN IF NOT EXISTS documentos_mime VARCHAR(50);
