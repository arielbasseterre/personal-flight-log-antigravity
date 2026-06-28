-- Migración: agregar columna role y recuperar perfiles perdidos

-- 1. Agregar columna role si no existe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'piloto_fb';

-- 2. Recuperar perfiles perdidos con todos los campos desde auth.users
INSERT INTO profiles (
  id, email, first_name, last_name, legajo, license, dni, role
)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'first_name', ''),
  COALESCE(raw_user_meta_data->>'last_name', ''),
  COALESCE(raw_user_meta_data->>'legajo', ''),
  COALESCE(raw_user_meta_data->>'license', ''),
  COALESCE(raw_user_meta_data->>'dni', ''),
  'piloto_fb'
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- 3. Asignar roles a usuarios existentes
UPDATE profiles SET role = 'piloto_fb' WHERE email IN (
  'pedromorelli72744@hotmail.com',
  'arielbasseterre@gmail.com'
);
UPDATE profiles SET role = 'tcp_fb' WHERE email = 'arielbasseterre@outlook.com';
