-- Autovaloración de la voz (1-10) por sesión.
-- La sesión 1 es la línea de base y se compara con la sesión 8 / última.
-- Idempotente: puede ejecutarse múltiples veces sin errores.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS voice_self_rating smallint CHECK (voice_self_rating IS NULL OR (voice_self_rating >= 1 AND voice_self_rating <= 10));

COMMENT ON COLUMN sessions.voice_self_rating IS 'Autovaloración de la voz del paciente 1-10 (10 = mi mejor voz). Sesión 1 = línea de base.';
