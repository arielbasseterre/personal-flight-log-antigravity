-- ═══════════════════════════════════════════════════════════════════════════
-- CONSOLIDATED DATABASE SCHEMA — Personal Flight Log
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. CLEANUP (Opcional para recreación completa) ────────────────────────
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();
-- DROP TABLE IF EXISTS public.calendar_tokens CASCADE;
-- DROP TABLE IF EXISTS public.flight_logs CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.airports CASCADE;
-- DROP TABLE IF EXISTS public.pending_registrations CASCADE;
-- DROP TABLE IF EXISTS public.user_remote_sessions CASCADE;
-- DROP TABLE IF EXISTS public.app_config CASCADE;
-- DROP TABLE IF EXISTS public.arms_roster CASCADE;
-- DROP TABLE IF EXISTS public.arms_sessions CASCADE;
-- DROP TABLE IF EXISTS public.bug_reports CASCADE;
-- DROP TABLE IF EXISTS public.push_tokens CASCADE;

-- ─── 2. TABLA: profiles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  legajo TEXT,
  license TEXT,
  dni TEXT,
  initial_folio_number INTEGER DEFAULT 1,
  initial_total_hours NUMERIC DEFAULT 0,
  total_airfield_day_pilot NUMERIC DEFAULT 0,
  total_airfield_day_copilot NUMERIC DEFAULT 0,
  total_airfield_night_pilot NUMERIC DEFAULT 0,
  total_airfield_night_copilot NUMERIC DEFAULT 0,
  total_cross_country_day_pilot NUMERIC DEFAULT 0,
  total_cross_country_day_copilot NUMERIC DEFAULT 0,
  total_cross_country_night_pilot NUMERIC DEFAULT 0,
  total_cross_country_night_copilot NUMERIC DEFAULT 0,
  total_landings INTEGER DEFAULT 0,
  total_instruction_time NUMERIC DEFAULT 0,
  total_multi_engine NUMERIC DEFAULT 0,
  total_jet NUMERIC DEFAULT 0,
  total_turboprop NUMERIC DEFAULT 0,
  total_ag_application NUMERIC DEFAULT 0,
  total_ifr_real_pilot NUMERIC DEFAULT 0,
  total_ifr_real_copilot NUMERIC DEFAULT 0,
  total_ifr_hood NUMERIC DEFAULT 0,
  total_sim_instructor NUMERIC DEFAULT 0,
  total_sim_student NUMERIC DEFAULT 0,
  grand_total_hours NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_synced_flight_at TIMESTAMP WITH TIME ZONE,
  subscription_id TEXT,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  subscription_status TEXT,
  mp_payer_email TEXT,
  role TEXT DEFAULT 'piloto_fb'
);

-- ─── 3. TABLA: airports ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.airports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  iata_code TEXT UNIQUE NOT NULL,
  icao_code TEXT UNIQUE NOT NULL,
  anac_code TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT DEFAULT 'Argentina'
);

-- ─── 4. TABLA: flight_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flight_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  "fechaHoraSalida" TIMESTAMP WITH TIME ZONE NOT NULL,
  "fechaHoraLlegada" TIMESTAMP WITH TIME ZONE NOT NULL,
  "origenID" TEXT NOT NULL,
  "origenPersonalizado" TEXT DEFAULT '',
  "destinoID" TEXT NOT NULL,
  "destinoPersonalizado" TEXT DEFAULT '',
  "finalidadID" TEXT,
  "clase" TEXT,
  "matriculaAvion" TEXT,
  "potencia" INTEGER DEFAULT 0,
  "aterrizajes" INTEGER DEFAULT 1,
  "horasDia" TEXT DEFAULT '0',
  "horasNoche" TEXT DEFAULT '0',
  "tipoVueloID" TEXT,
  "cargoID" TEXT,
  "autoridadCertificanteID" TEXT,
  "observaciones" TEXT,
  "Discriminaciones" JSONB DEFAULT '[]',
  "folio_number" INTEGER DEFAULT 1,
  "is_capota" BOOLEAN DEFAULT FALSE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "multi_engine" NUMERIC DEFAULT 0,
  "jet" NUMERIC DEFAULT 0,
  "turboprop" NUMERIC DEFAULT 0,
  "ifr_instrument" NUMERIC DEFAULT 0,
  "instruccion" NUMERIC DEFAULT 0,
  "airfield_day_pilot" NUMERIC DEFAULT 0,
  "airfield_day_copilot" NUMERIC DEFAULT 0,
  "airfield_night_pilot" NUMERIC DEFAULT 0,
  "airfield_night_copilot" NUMERIC DEFAULT 0,
  "cross_country_day_pilot" NUMERIC DEFAULT 0,
  "cross_country_day_copilot" NUMERIC DEFAULT 0,
  "cross_country_night_pilot" NUMERIC DEFAULT 0,
  "cross_country_night_copilot" NUMERIC DEFAULT 0,
  "ifr_real_pilot" NUMERIC DEFAULT 0,
  "ifr_real_copilot" NUMERIC DEFAULT 0,
  "ifr_hood" NUMERIC DEFAULT 0,
  "sim_instructor" NUMERIC DEFAULT 0,
  "sim_student" NUMERIC DEFAULT 0,
  "ag_application" NUMERIC DEFAULT 0,
  "Marca_Modelo" TEXT
);

-- ─── 5. TABLA: pending_registrations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  license TEXT,
  dni TEXT,
  legajo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 6. TABLA: user_remote_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_remote_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  session_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 7. TABLA: app_config ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ─── 8. TABLA: arms_roster ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arms_roster (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2099),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  roster_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  roster_hash TEXT,
  UNIQUE(user_id, month, year)
);

-- ─── 9. TABLA: arms_sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arms_sessions (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  session_data JSONB,
  arms_username TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 10. TABLA: bug_reports ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 11. TABLA: push_tokens ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  fcm_token TEXT NOT NULL,
  platform TEXT DEFAULT 'android',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── 12. TABLA: calendar_tokens ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  label TEXT DEFAULT 'Sin nombre'::text,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  user_email TEXT
);

-- ─── 13. ÍNDICES ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_arms_roster_user_id ON public.arms_roster USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_arms_roster_user_period ON public.arms_roster USING btree (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_token ON public.calendar_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user_id ON public.calendar_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_flight_logs_user_id ON public.flight_logs USING btree (user_id);

-- ─── 14. TRIGGER Y FUNCIÓN DE AUTOMATIZACIÓN ──────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, legajo, license, dni, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'legajo', ''),
    COALESCE(NEW.raw_user_meta_data->>'license', ''),
    COALESCE(NEW.raw_user_meta_data->>'dni', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'piloto_fb')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 15. SEGURIDAD: ROW LEVEL SECURITY (RLS) ──────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.airports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arms_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arms_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_remote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- ─── 16. POLÍTICAS RLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can access their own profile" ON public.profiles;
CREATE POLICY "Users can access their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can access their own flight logs" ON public.flight_logs;
CREATE POLICY "Users can access their own flight logs" ON public.flight_logs FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read for airports" ON public.airports;
CREATE POLICY "Public read for airports" ON public.airports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own roster" ON public.arms_roster;
CREATE POLICY "Users manage own roster" ON public.arms_roster FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own arms session" ON public.arms_sessions;
CREATE POLICY "Users manage own arms session" ON public.arms_sessions FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_select_own_tokens" ON public.calendar_tokens;
CREATE POLICY "users_select_own_tokens" ON public.calendar_tokens FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_tokens" ON public.calendar_tokens;
CREATE POLICY "users_insert_own_tokens" ON public.calendar_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_tokens" ON public.calendar_tokens;
CREATE POLICY "users_update_own_tokens" ON public.calendar_tokens FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_tokens" ON public.calendar_tokens;
CREATE POLICY "users_delete_own_tokens" ON public.calendar_tokens FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_role_access" ON public.user_remote_sessions;
CREATE POLICY "service_role_access" ON public.user_remote_sessions FOR ALL USING (auth.uid() = user_id);
