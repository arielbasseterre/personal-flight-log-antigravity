-- ═══════════════════════════════════════════════════════════════════════
-- RLS POLICIES — Personal Flight Log
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1. flight_logs: cada usuario solo ve sus propios registros
ALTER TABLE flight_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own_logs ON flight_logs;
DROP POLICY IF EXISTS users_insert_own_logs ON flight_logs;
DROP POLICY IF EXISTS users_update_own_logs ON flight_logs;
DROP POLICY IF EXISTS users_delete_own_logs ON flight_logs;
CREATE POLICY users_select_own_logs ON flight_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY users_insert_own_logs ON flight_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY users_update_own_logs ON flight_logs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY users_delete_own_logs ON flight_logs
  FOR DELETE USING (auth.uid() = user_id);

-- 2. profiles: cada usuario solo ve/edita su propio perfil
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select_own_profile ON profiles;
DROP POLICY IF EXISTS users_update_own_profile ON profiles;
CREATE POLICY users_select_own_profile ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_update_own_profile ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. arms_roster: lectura solo del propio usuario
ALTER TABLE arms_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_read_own_roster ON arms_roster;
CREATE POLICY users_read_own_roster ON arms_roster
  FOR SELECT USING (auth.uid() = user_id);

-- 4. arms_sessions: solo server (service_role) — RLS no afecta, pero por seguridad:
ALTER TABLE arms_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_access ON arms_sessions;
CREATE POLICY service_role_access ON arms_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 5. user_remote_sessions: solo server
ALTER TABLE user_remote_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_access ON user_remote_sessions;
CREATE POLICY service_role_access ON user_remote_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 6. push_tokens: solo server
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_access ON push_tokens;
CREATE POLICY service_role_access ON push_tokens
  FOR ALL USING (auth.uid() = user_id);
