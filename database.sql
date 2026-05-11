-- Profiles table to extend auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP TABLE IF EXISTS flight_logs;
DROP TABLE IF EXISTS profiles;
DROP TABLE IF EXISTS airports;

CREATE TABLE profiles (
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
  last_synced_flight_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE airports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  iata_code TEXT UNIQUE NOT NULL,
  icao_code TEXT UNIQUE NOT NULL,
  anac_code TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT DEFAULT 'Argentina'
);

CREATE TABLE flight_logs (
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
  "Marca_Modelo" TEXT,
  "potencia" INTEGER DEFAULT 0,
  "aterrizajes" INTEGER DEFAULT 1,
  "horasDia" TEXT DEFAULT '0',
  "horasNoche" TEXT DEFAULT '0',
  "tipoVueloID" TEXT,
  "cargoID" TEXT,
  "autoridadCertificanteID" TEXT,
  "observaciones" TEXT,
  "Discriminaciones" JSONB DEFAULT '[]',
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
  folio_number INTEGER DEFAULT 1,
  is_capota BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to create profile after signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, legajo, license, dni)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''), 
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'legajo', ''),
    COALESCE(NEW.raw_user_meta_data->>'license', ''),
    COALESCE(NEW.raw_user_meta_data->>'dni', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for airports" ON airports FOR SELECT USING (true);
CREATE POLICY "Users can access their own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access their own flight logs" ON flight_logs FOR ALL USING (auth.uid() = user_id);
