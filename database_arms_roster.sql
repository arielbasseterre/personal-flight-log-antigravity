-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: ARMS Roster Sync — Tablas de roster, sesiones y push tokens
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Tabla principal del roster parseado ────────────────────────────────
-- Almacena el roster mensual completo como JSON (array de ArmsDayEntry[]).
-- La columna roster_hash (SHA-256) se usa para detectar cambios entre syncs.
-- El constraint UNIQUE(user_id, month, year) permite upsert eficiente.
CREATE TABLE IF NOT EXISTS arms_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  roster_json JSONB NOT NULL DEFAULT '[]'::jsonb,    -- Array de ArmsDayEntry[]
  roster_hash TEXT,                                    -- SHA-256 para detectar cambios
  UNIQUE(user_id, month, year)
);

-- Índice para búsquedas rápidas por usuario + período
CREATE INDEX IF NOT EXISTS idx_arms_roster_user_period 
  ON arms_roster(user_id, year, month);

-- ─── 2. Tabla de sesiones ARMS (cookies de Playwright) ─────────────────────
-- Almacena las cookies de sesión del portal ARMS para el cron job automático.
-- Separada de user_remote_sessions (que es exclusiva de ANAC).
CREATE TABLE IF NOT EXISTS arms_sessions (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  session_data JSONB,             -- storageState completo de Playwright
  arms_username TEXT,             -- Usuario/legajo de ARMS (no la contraseña)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 3. Tabla de tokens FCM para notificaciones push ───────────────────────
-- Almacena el token de Firebase Cloud Messaging de cada dispositivo.
-- Usado por el servidor para enviar notificaciones background cuando
-- el cron job detecta un cambio en el roster.
CREATE TABLE IF NOT EXISTS push_tokens (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  fcm_token TEXT NOT NULL,         -- Token FCM del dispositivo Android
  platform TEXT DEFAULT 'android', -- 'android' | 'ios' | 'web'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 4. Row Level Security (RLS) ──────────────────────────────────────────
-- Cada usuario solo puede leer/escribir sus propios registros.
ALTER TABLE arms_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE arms_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso: solo el usuario dueño puede operar sobre sus filas
CREATE POLICY "Users manage own roster" 
  ON arms_roster FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own arms session" 
  ON arms_sessions FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own push tokens" 
  ON push_tokens FOR ALL 
  USING (auth.uid() = user_id);
