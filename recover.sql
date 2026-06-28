-- RECUPERACIÓN COMPLETA desde backup
-- Ejecutar en SQL Editor de Supabase (una sola vez)

-- 1. DROP de tablas vacías que vamos a restaurar
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.flight_logs CASCADE;
DROP TABLE IF EXISTS public.airports CASCADE;
DROP TABLE IF EXISTS public.app_config CASCADE;
DROP TABLE IF EXISTS public.arms_roster CASCADE;
DROP TABLE IF EXISTS public.arms_sessions CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;
DROP TABLE IF EXISTS public.pending_registrations CASCADE;
DROP TABLE IF EXISTS public.push_tokens CASCADE;
DROP TABLE IF EXISTS public.user_remote_sessions CASCADE;

-- 2. Recrear esquemas desde schema.sql
CREATE TABLE IF NOT EXISTS "public"."airports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "iata_code" "text" NOT NULL,
    "icao_code" "text" NOT NULL,
    "anac_code" "text",
    "name" "text" NOT NULL,
    "city" "text",
    "country" "text" DEFAULT 'Argentina'::"text"
);

CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text"
);

CREATE TABLE IF NOT EXISTS "public"."arms_roster" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text",
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."bug_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."pending_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text",
    "password_hash" "text",
    "first_name" "text",
    "last_name" "text",
    "license" "text",
    "dni" "text",
    "legajo" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "legajo" "text",
    "license" "text",
    "dni" "text",
    "initial_folio_number" integer DEFAULT 1,
    "initial_total_hours" numeric DEFAULT 0,
    "total_airfield_day_pilot" numeric DEFAULT 0,
    "total_airfield_day_copilot" numeric DEFAULT 0,
    "total_airfield_night_pilot" numeric DEFAULT 0,
    "total_airfield_night_copilot" numeric DEFAULT 0,
    "total_cross_country_day_pilot" numeric DEFAULT 0,
    "total_cross_country_day_copilot" numeric DEFAULT 0,
    "total_cross_country_night_pilot" numeric DEFAULT 0,
    "total_cross_country_night_copilot" numeric DEFAULT 0,
    "total_landings" integer DEFAULT 0,
    "total_instruction_time" numeric DEFAULT 0,
    "total_multi_engine" numeric DEFAULT 0,
    "total_jet" numeric DEFAULT 0,
    "total_turboprop" numeric DEFAULT 0,
    "total_ag_application" numeric DEFAULT 0,
    "total_ifr_real_pilot" numeric DEFAULT 0,
    "total_ifr_real_copilot" numeric DEFAULT 0,
    "total_ifr_hood" numeric DEFAULT 0,
    "total_sim_instructor" numeric DEFAULT 0,
    "total_sim_student" numeric DEFAULT 0,
    "grand_total_hours" numeric DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_synced_flight_at" timestamp with time zone,
    "subscription_id" "text",
    "subscription_end_date" timestamp with time zone,
    "subscription_status" "text",
    "mp_payer_email" "text"
);

CREATE TABLE IF NOT EXISTS "public"."flight_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fechaHoraSalida" timestamp with time zone NOT NULL,
    "fechaHoraLlegada" timestamp with time zone NOT NULL,
    "origenID" "text" NOT NULL,
    "origenPersonalizado" "text" DEFAULT ''::"text",
    "destinoID" "text" NOT NULL,
    "destinoPersonalizado" "text" DEFAULT ''::"text",
    "finalidadID" "text",
    "clase" "text",
    "matriculaAvion" "text",
    "potencia" integer DEFAULT 0,
    "aterrizajes" integer DEFAULT 1,
    "horasDia" "text" DEFAULT '0'::"text",
    "horasNoche" "text" DEFAULT '0'::"text",
    "tipoVueloID" "text",
    "cargoID" "text",
    "autoridadCertificanteID" "text",
    "observaciones" "text",
    "Discriminaciones" "jsonb" DEFAULT '[]'::"jsonb",
    "folio_number" integer DEFAULT 1,
    "is_capota" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "multi_engine" numeric DEFAULT 0,
    "jet" numeric DEFAULT 0,
    "turboprop" numeric DEFAULT 0,
    "ifr_instrument" numeric DEFAULT 0,
    "instruccion" numeric DEFAULT 0,
    "airfield_day_pilot" numeric DEFAULT 0,
    "airfield_day_copilot" numeric DEFAULT 0,
    "airfield_night_pilot" numeric DEFAULT 0,
    "airfield_night_copilot" numeric DEFAULT 0,
    "cross_country_day_pilot" numeric DEFAULT 0,
    "cross_country_day_copilot" numeric DEFAULT 0,
    "cross_country_night_pilot" numeric DEFAULT 0,
    "cross_country_night_copilot" numeric DEFAULT 0,
    "ifr_real_pilot" numeric DEFAULT 0,
    "ifr_real_copilot" numeric DEFAULT 0,
    "ifr_hood" numeric DEFAULT 0,
    "sim_instructor" numeric DEFAULT 0,
    "sim_student" numeric DEFAULT 0,
    "ag_application" numeric DEFAULT 0,
    "Marca_Modelo" "text"
);

CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "user_id" "uuid" NOT NULL,
    "fcm_token" "text" NOT NULL,
    "platform" "text" DEFAULT 'android'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."user_remote_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

-- 3. Restaurar datos de aeropuertos
INSERT INTO "public"."airports" ("id", "iata_code", "icao_code", "anac_code", "name", "city", "country") VALUES
	('9ab4c2ba-9c0b-4297-afe8-242ac6ac0675', 'AER', 'URSS', '', 'Sochi International Airport', 'Sochi', 'Russia'),
	('1525401b-46f0-4fd2-bc26-30777f8d8931', 'EZE', 'SAEZ', 'EZE', 'Ministro Pistarini', 'Ezeiza', 'Argentina'),
	('c3e56a23-a70a-418e-9e2b-8c3c0a5b1ca7', 'SDE', 'SANE', 'SDE', 'Vicecomodoro Ángel de la Paz Aragonés', 'Santiago del Estero', 'Argentina'),
	('af6da78c-1ffd-4da4-b6e2-84b67f34d4cc', 'JUJ', 'SASJ', 'JUJ', 'Gobernador Horacio Guzmán', 'San Salvador de Jujuy', 'Argentina'),
	('ae860f25-a8ea-44c7-a066-263ae9a8bc98', 'TUC', 'SANT', 'TUC', 'Teniente Benjamín Matienzo', 'San Miguel de Tucumán', 'Argentina'),
	('93cb70a5-5c38-48db-8d6e-3bc620d04b39', 'COR', 'SACO', 'COR', 'Ingeniero Aeronáutico Ambrosio L.V. Taravella', 'Córdoba', 'Argentina'),
	('d14caf2e-d4a9-4bba-a838-f4521b0d696c', 'MDZ', 'SAME', 'MDZ', 'Gobernador Francisco Gabrielli', 'Mendoza', 'Argentina'),
	('c0ed6ab4-6555-45a4-9f9a-5d59064e1e62', 'BRC', 'SAZS', 'BRC', 'San Carlos de Bariloche', 'San Carlos de Bariloche', 'Argentina'),
	('e41e93f6-60b9-499a-ae96-95eac71a06e0', 'IGR', 'SARI', 'IGR', 'Cataratas del Iguazú', 'Puerto Iguazú', 'Argentina'),
	('049c5680-d153-4f95-84fe-b88024929b89', 'JUA', 'SJUV', 'JUA', 'Juazeiro do Norte', 'Juazeiro do Norte', 'Brazil'),
	('103b4bb6-90d9-445f-90e0-e2a015f106f4', 'CBA', 'SAC', 'CBA', 'Ing. Aer. A.L.V. Taravella', 'Córdoba', 'Argentina'),
	('f75aed2c-0692-4cc3-8df3-3147e3dabc69', 'SAL', 'MSLP', 'SAL', 'Monseñor Óscar Arnulfo Romero y Galdámez', 'San Salvador', 'El Salvador'),
	('4692b6b8-4418-4baf-be6c-70070b150cf3', 'IGU', 'SBFI', 'IGU', 'Cataratas', 'Foz do Iguaçu', 'Brazil'),
	('b9a97aa7-b03f-4cd7-a57b-5c8c2414e8f8', 'DOZ', 'YDOZ', 'DOZ', 'Dorothy Creek', 'Dorothy Creek', 'Australia'),
	('da27f9b0-32cf-4e86-a4ea-27a3c3522556', 'PAL', 'SKPL', 'PAL', 'Palanquero', 'Palanquero', 'Colombia'),
	('bca2a802-9b1f-4e8c-840e-8b6e2fe155ab', 'FDO', 'SACO', 'FDO', 'La Boca', 'La Boca', 'Argentina'),
	('31932504-d7f9-4ee7-9bb4-a87073b6dc82', 'BAR', 'SABA', 'BAR', 'La Bengala', 'La Bengala', 'Argentina'),
	('b169e75e-847c-42da-9138-7952cd4c41de', 'ECA', 'KECA', 'ECA', 'Los Charrúas', 'Los Charrúas', 'Argentina');

-- 4. Restaurar perfiles (con role = piloto_fb por defecto)
INSERT INTO "public"."profiles" ("id", "first_name", "last_name", "email", "legajo", "license", "dni", "initial_folio_number", "initial_total_hours", "total_airfield_day_pilot", "total_airfield_day_copilot", "total_airfield_night_pilot", "total_airfield_night_copilot", "total_cross_country_day_pilot", "total_cross_country_day_copilot", "total_cross_country_night_pilot", "total_cross_country_night_copilot", "total_landings", "total_instruction_time", "total_multi_engine", "total_jet", "total_turboprop", "total_ag_application", "total_ifr_real_pilot", "total_ifr_real_copilot", "total_ifr_hood", "total_sim_instructor", "total_sim_student", "grand_total_hours", "updated_at", "last_synced_flight_at", "subscription_id", "subscription_end_date", "subscription_status", "mp_payer_email") VALUES
	('a09304c8-3e78-4572-96de-e6dca4594b48', 'Vale', 'Doda', 'valeriabasseterre@hotmail.com', '1', 'A', '1', 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '2026-06-15 01:53:09.068816+00', NULL, 'c454cc3ff3714ab49c28f395fe5dd50f', '2026-07-06 18:44:40.369+00', 'trial', NULL),
	('2cc699b7-38e2-4499-89a2-e2c9f1b63129', 'Ariel', 'Basseterre', 'arielbasseterre@gmail.com', '82468', 'TLA', '29327413', 47, 1833.4, 2.8, 0, 0, 0, 543.3, 678, 194.4, 414.9, 980, 0, 1830.6, 1735.1, 78.8, 0, 569.9, 993.5, 0, 0, 126, 1887.7, '2026-05-01 22:56:43.4418+00', '2026-06-06 18:30:00+00', '3c2e939800034f81a92769936ce23d15', '2028-07-06 17:26:11+00', 'authorized', 'valeriabasseterre@hotmail.com'),
	('d72b2ab2-13fc-4953-81f9-db6303189e95', 'Pedro', 'Morelli', 'pedromorelli72744@hotmail.com', '72744', 'TLA', '32699706', 1, 6166.6, 1972.9, 0, 253.7, 0, 2150.4, 703.7, 640, 445.9, 8879, 2062.7, 3538.1, 2330.3, 1128, 0, 1561.6, 1024.4, 54.9, 0, 200, 6166.6, '2026-05-04 20:37:42.036217+00', NULL, NULL, NULL, NULL, NULL),
	('22fa1ea3-9740-454f-aef8-526dcbb935f6', 'Jorge', 'Gomez', 'gomez@oasis.com', '123456', 'TLA', '2788566', 3, 11, 1, 1, 1, 0, 5, 1, 1, 1, 7, 0, 5, 5, 1, 0, 4.6, 0, 0, 0, 0, 13, '2026-05-04 00:13:42.214684+00', '2026-05-13 12:00:00+00', NULL, NULL, NULL, NULL),
	('3c5d1dec-b442-4bf1-b47a-7c9c26641b01', 'Jorge', 'Perrz', 'arielbasseterre@outlook.com', '123488', 'TLA', '233388', 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '2026-06-16 18:44:40.287744+00', NULL, NULL, '2026-07-16 18:44:40.369+00', 'trial', NULL);

-- 5. Agregar columna role y asignar roles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'piloto_fb';

UPDATE profiles SET role = 'piloto_fb' WHERE email IN (
  'pedromorelli72744@hotmail.com',
  'arielbasseterre@gmail.com',
  'gomez@oasis.com',
  'valeriabasseterre@hotmail.com'
);
UPDATE profiles SET role = 'tcp_fb' WHERE email = 'arielbasseterre@outlook.com';

-- 6. Restaurar flight_logs
INSERT INTO "public"."flight_logs" ("id", "user_id", "fechaHoraSalida", "fechaHoraLlegada", "origenID", "origenPersonalizado", "destinoID", "destinoPersonalizado", "finalidadID", "clase", "matriculaAvion", "potencia", "aterrizajes", "horasDia", "horasNoche", "tipoVueloID", "cargoID", "autoridadCertificanteID", "observaciones", "Discriminaciones", "folio_number", "is_capota", "created_at", "multi_engine", "jet", "turboprop", "ifr_instrument", "instruccion", "airfield_day_pilot", "airfield_day_copilot", "airfield_night_pilot", "airfield_night_copilot", "cross_country_day_pilot", "cross_country_day_copilot", "cross_country_night_pilot", "cross_country_night_copilot", "ifr_real_pilot", "ifr_real_copilot", "ifr_hood", "sim_instructor", "sim_student", "ag_application", "Marca_Modelo") VALUES
	('ee1c97bb-db97-4a6f-8eeb-9ba1d4d1bad1', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-23 18:25:00+00', '2026-04-23 20:01:00+00', 'SDE', '', 'AER', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '1.6', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:20:04.977016+00', 1.6, 1.6, 0, 1.4, 0, 0, 0, 0, 0, 1.6, 0, 0, 0, 1.4, 0, 0, 0, 0, 0, 'B738'),
	('39f877ce-6e64-4a5a-bfbc-c56919202c98', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-29 15:20:00+00', '2026-04-29 17:38:00+00', 'AER', '', 'JUA', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '2.3', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:20:45.001528+00', 2.3, 2.3, 0, 2.1, 0, 0, 0, 0, 0, 2.3, 0, 0, 0, 2.1, 0, 0, 0, 0, 0, 'B738'),
	('3e62d239-885b-44d0-812d-b8836136b41d', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-29 18:07:00+00', '2026-04-29 19:59:00+00', 'JUA', '', 'AER', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '1.9', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:21:39.239725+00', 1.9, 1.9, 0, 1.7, 0, 0, 0, 0, 0, 1.9, 0, 0, 0, 1.7, 0, 0, 0, 0, 0, 'B738'),
	('6cd620a8-0925-4e84-af13-23ce7f5571ab', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-02 20:27:00+00', '2026-05-02 22:22:00+00', 'AER', '', 'SDE', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0.9', '1', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 06:49:58.424146+00', 1.9, 1.9, 0, 1.7, 0, 0, 0, 0, 0, 0, 0.9, 0, 1, 0, 1.7, 0, 0, 0, 0, 'B738'),
	('f02c1d22-836f-413f-9bc1-5c9f4b0ab401', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-02 15:10:00+00', '2026-05-02 17:14:00+00', 'AER', '', 'TUC', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '2.1', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 06:55:48.231079+00', 2.1, 2.1, 0, 1.9, 0, 0, 0, 0, 0, 2.1, 0, 0, 0, 1.9, 0, 0, 0, 0, 0, 'B738'),
	('a8707e1e-22ea-4c50-8e0e-5d49b6c3e4ea', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-02 17:46:00+00', '2026-05-02 19:44:00+00', 'TUC', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '2', '0', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 06:47:40.514183+00', 2, 2, 0, 1.8, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1.8, 0, 0, 0, 0, 'B738'),
	('7d2dd6e4-e7d2-4f73-85fe-f12aee85c31b', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-03 22:16:00+00', '2026-04-04 00:30:00+00', 'IGU', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0', '2.2', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 17:57:14.328185+00', 2.2, 2.2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2.2, 0, 2, 0, 0, 0, 0, 0, 'B738'),
	('8447572d-9666-4474-b587-28d57d1ac065', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-08 12:50:00+00', '2026-04-08 14:36:00+00', 'AER', '', 'CBA', '', '79', 'MULT-T', 'LV-KEG', 26000, 1, '1.8', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 17:59:00.846697+00', 1.8, 1.8, 0, 1.6, 0, 0, 0, 0, 0, 1.8, 0, 0, 0, 1.6, 0, 0, 0, 0, 0, 'B738'),
	('e15789bc-99da-4aa5-9f96-5cb533cab9cc', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-08 15:00:00+00', '2026-04-08 16:35:00+00', 'CBA', '', 'EZE', '', '79', 'MULT-T', 'LV-KEG', 26000, 1, '1.6', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:00:04.08842+00', 1.6, 1.6, 0, 1.4, 0, 0, 0, 0, 0, 1.6, 0, 0, 0, 1.4, 0, 0, 0, 0, 0, 'B738'),
	('dac06e40-4961-454a-ab51-fd2f366faadb', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-19 08:50:00+00', '2026-04-19 11:14:00+00', 'EZE', '', 'SAL', '', '79', 'MULT-T', 'LV-KJD', 26000, 1, '1.4', '1', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:01:10.371929+00', 2.4, 2.4, 0, 2.2, 0, 0, 0, 0, 0, 1.4, 0, 1, 0, 2.2, 0, 0, 0, 0, 0, 'B738'),
	('7c00b3c4-fa46-48db-af2b-9612f86ef0aa', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-19 11:42:00+00', '2026-04-19 13:05:00+00', 'SAL', '', 'CBA', '', '79', 'MULT-T', 'LV-KJD', 26000, 1, '1.4', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:02:24.62832+00', 1.4, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 1.4, 0, 0, 0, 1.2, 0, 0, 0, 0, 0, 'B738'),
	('6a21b575-065e-4601-a0b9-e353e000ad91', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-19 13:42:00+00', '2026-04-19 15:02:00+00', 'CBA', '', 'EZE', '', '79', 'MULT-T', 'LV-KJD', 26000, 1, '1.3', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:03:45.649338+00', 1.3, 1.3, 0, 1.1, 0, 0, 0, 0, 0, 1.3, 0, 0, 0, 1.1, 0, 0, 0, 0, 0, 'B738'),
	('9ef55b85-c4dc-4d1e-9e5b-8d24d7bcadd7', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-20 10:40:00+00', '2026-04-20 14:10:00+00', 'AER', '', 'ECA', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '3.5', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:14:11.959502+00', 3.5, 3.5, 0, 3.3, 0, 0, 0, 0, 0, 3.5, 0, 0, 0, 3.3, 0, 0, 0, 0, 0, 'B738'),
	('87fdac06-3a2b-4175-89e9-a3dae31e25d0', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-20 14:40:00+00', '2026-04-20 17:53:00+00', 'ECA', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '3.2', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:15:18.76059+00', 3.2, 3.2, 0, 3, 0, 0, 0, 0, 0, 3.2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 'B738'),
	('8dc72a75-16cc-40b3-b229-679b3ea57be0', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-22 23:05:00+00', '2026-04-23 01:17:00+00', 'AER', '', 'SDE', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '0', '2.2', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:18:26.412873+00', 2.2, 2.2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2.2, 0, 2, 0, 0, 0, 0, 0, 'B738'),
	('20ea2735-57ec-4d92-9308-657a4596c3bc', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-13 00:10:00+00', '2026-05-13 02:28:00+00', 'AER', '', 'SAL', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0', '2.3', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-13 06:25:32.739883+00', 2.3, 2.3, 0, 2.1, 0, 0, 0, 0, 0, 0, 0, 0, 2.3, 0, 2.1, 0, 0, 0, 0, 'B738'),
	('07928e0d-53f1-4180-8c8c-b4d07b1930e2', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-02 22:45:00+00', '2026-05-03 00:30:00+00', 'SDE', '', 'EZE', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0', '1.7', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 19:27:17.197323+00', 1.7, 1.7, 0, 1.5, 0, 0, 0, 0, 0, 0, 0, 0, 1.7, 0, 1.5, 0, 0, 0, 0, 'B738'),
	('63ef581b-91ad-4f60-9707-3bb4e20c913b', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-13 02:58:00+00', '2026-05-13 05:10:00+00', 'SAL', '', 'EZE', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0', '2.2', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-13 06:26:48.682416+00', 2.2, 2.2, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2.2, 0, 2, 0, 0, 0, 0, 'B738'),
	('8d65c82c-6430-4e71-8a42-6a6c6d6d2e11', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-27 10:20:00+00', '2026-05-27 11:45:00+00', 'CBA', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '1.4', '0', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-27 12:47:50.698022+00', 1.4, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 0, 1.4, 0, 0, 0, 1.2, 0, 0, 0, 0, 'B738'),
	('260b7af3-9307-4e00-a9e3-90497ed47289', '22fa1ea3-9740-454f-aef8-526dcbb935f6', '2026-05-13 12:00:00+00', '2026-05-13 14:00:00+00', 'PAL', '', 'FDO', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '2', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-13 15:22:59.674296+00', 2, 2, 0, 1.8, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1.8, 0, 0, 0, 0, 0, 'B738'),
	('41d27045-0e45-47e7-9e6a-9292dd9b5313', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-05-27 05:58:00+00', '2026-05-27 09:53:00+00', 'AER', '', 'CBA', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '0', '3.9', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-05-27 12:46:35.332864+00', 3.9, 3.9, 0, 3.7, 0, 0, 0, 0, 0, 0, 0, 0, 3.9, 0, 3.7, 0, 0, 0, 0, 'B738'),
	('4d36bfa2-38fd-457a-9c70-d8d4d5a12fe8', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-22 18:17:00+00', '2026-04-22 20:07:00+00', 'AER', '', 'EZE', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '1.8', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:16:48.098922+00', 1.8, 1.8, 0, 1.6, 0, 0, 0, 0, 0, 1.8, 0, 0, 0, 1.6, 0, 0, 0, 0, 0, 'B738'),
	('b7d2ef83-d231-49d1-b634-ddbcc6a79ccc', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-04-22 20:30:00+00', '2026-04-22 22:08:00+00', 'EZE', '', 'AER', '', '79', 'MULT-T', 'LV-KCE', 26000, 1, '1.6', '0', '2', '1', '15', 'Matias Miret', '[]', 1, false, '2026-05-03 18:17:40.947064+00', 1.6, 1.6, 0, 1.4, 0, 0, 0, 0, 0, 1.6, 0, 0, 0, 1.4, 0, 0, 0, 0, 0, 'B738'),
	('2036aa3d-b635-4450-bd4b-72887fa3e009', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-06-06 13:01:00+00', '2026-06-06 15:10:00+00', 'EZE', '', 'DOZ', '', '79', 'MULT-T', 'LV-KJD', 26000, 1, '2.2', '0', '2', '2', '15', 'Matías Miret', '[]', 1, false, '2026-06-07 02:40:30.334694+00', 2.2, 2.2, 0, 2, 0, 0, 0, 0, 0, 0, 2.2, 0, 0, 0, 2, 0, 0, 0, 0, 'B738'),
	('fb51eae6-fcdc-4141-a366-20e15af40f3b', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-06-04 11:43:00+00', '2026-06-04 13:52:00+00', 'AER', '', 'TUC', '', '79', 'MULT-T', 'LV-KDQ', 26000, 1, '2.2', '0', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-06-04 21:50:17.134707+00', 2.2, 2.2, 0, 2, 0, 0, 0, 0, 0, 0, 2.2, 0, 0, 0, 2, 0, 0, 0, 0, 'B738'),
	('5aed0224-b176-49b5-8f20-66806200ea7c', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-06-04 14:25:00+00', '2026-06-04 16:17:00+00', 'TUC', '', 'AER', '', '79', 'MULT-T', 'LV-KDQ', 26000, 1, '1.9', '0', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-06-04 21:51:41.518804+00', 1.9, 1.9, 0, 1.7, 0, 0, 0, 0, 0, 0, 1.9, 0, 0, 0, 1.7, 0, 0, 0, 0, 'B738'),
	('aa1edb01-bd0d-4b7f-b656-d8478111adad', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '2026-06-06 18:30:00+00', '2026-06-06 20:15:00+00', 'DOZ', '', 'AER', '', '79', 'MULT-T', 'LV-KJD', 26000, 1, '1.7', '0', '2', '2', '15', 'Matias Miret', '[]', 1, false, '2026-06-07 02:53:25.209663+00', 1.7, 1.7, 0, 1.5, 0, 0, 0, 0, 0, 0, 1.7, 0, 0, 0, 1.5, 0, 0, 0, 0, 'B738'),
	('5302b229-82e2-4dd9-a212-1dfa7e64799a', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-08 11:00:00+00', '2026-06-08 12:48:00+00', 'EZE', '', 'IGU', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '1.8', '0', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-08 12:53:07.702066+00', 1.8, 1.8, 0, 1.6, 0, 0, 0, 0, 0, 1.8, 0, 0, 0, 1.6, 0, 0, 0, 0, 0, 'B738'),
	('7dced9bf-daf5-44df-881a-d8f140b240cf', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-08 13:23:00+00', '2026-06-08 15:31:00+00', 'IGU', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '2.1', '0', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-09 01:28:51.506038+00', 2.1, 2.1, 0, 1.9, 0, 0, 0, 0, 0, 2.1, 0, 0, 0, 1.9, 0, 0, 0, 0, 0, 'B738'),
	('62ab7b36-ad81-487a-84f2-8cccd77280f8', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-08 16:28:00+00', '2026-06-08 18:49:00+00', 'AER', '', 'BAR', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '2.4', '0', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-09 01:30:23.987917+00', 2.4, 2.4, 0, 2.2, 0, 0, 0, 0, 0, 2.4, 0, 0, 0, 2.2, 0, 0, 0, 0, 0, 'B738'),
	('7a77b0f1-80e0-4950-aca8-61f5f1f63ae5', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-08 19:23:00+00', '2026-06-08 21:28:00+00', 'BAR', '', 'AER', '', '79', 'MULT-T', 'LV-KJE', 26000, 1, '2.1', '0', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-09 01:40:21.325796+00', 2.1, 2.1, 0, 1.9, 0, 0, 0, 0, 0, 2.1, 0, 0, 0, 1.9, 0, 0, 0, 0, 0, 'B738'),
	('cab437a6-a8cb-484c-9df6-73db871e6b22', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-15 21:17:00+00', '2026-06-15 22:41:00+00', 'AER', '', 'CBA', '', '79', 'MULT-T', 'LV-KJD', 26009, 1, '0', '1.4', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-15 22:44:49.375909+00', 1.4, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 'B738'),
	('27f4c01e-47f0-4635-a9a5-1ccd1571bf66', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-15 23:11:00+00', '2026-06-16 00:33:00+00', 'CBA', '', 'SAL', '', '79', 'MULT-T', 'LV-KJD', 26009, 1, '0', '1.4', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-16 00:50:07.10492+00', 1.4, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 0, 0, 1.4, 0, 1.2, 0, 0, 0, 0, 0, 'B738'),
	('530a535c-c9ea-47f2-a80a-1ae93fe3a181', 'd72b2ab2-13fc-4953-81f9-db6303189e95', '2026-06-16 01:02:00+00', '2026-06-16 03:06:00+00', 'SAL', '', 'EZE', '', '79', 'MULT-T', 'LV-KJD', 26009, 1, '0', '2.1', '2', '1', '14', 'MIRET, MATIAS', '[]', 1, false, '2026-06-16 03:27:54.746412+00', 2.1, 2.1, 0, 1.9, 0, 0, 0, 0, 0, 0, 0, 2.1, 0, 1.9, 0, 0, 0, 0, 0, 'B738');

-- 7. Restaurar pending_registrations
INSERT INTO "public"."pending_registrations" ("id", "email", "password_hash", "first_name", "last_name", "license", "dni", "legajo", "created_at") VALUES
	('7ef00cdc-3c3d-479b-b266-cc74d927f03c', 'test@test.com', 'test123', '', '', '', '', '', '2026-06-13 06:13:26.859545+00'),
	('a0812f71-ea59-4f1f-b725-ceaf64ff9d09', 'test-amount@mail.com', 'test123', '', '', '', '', '', '2026-06-13 08:18:31.309024+00'),
	('0754c3e8-cae6-491a-87dd-9408403ea240', 'arielbasseterre@outlook.com', '12345678', 'Jose ', 'Velz', 'TLA', '23456123', '99990', '2026-06-14 22:32:14.646735+00');

-- 8. Restaurar user_remote_sessions
INSERT INTO "public"."user_remote_sessions" ("id", "user_id", "session_data", "created_at", "updated_at") VALUES
	('58ebdeb9-82ef-4812-bdba-a0cceec79a83', '22fa1ea3-9740-454f-aef8-526dcbb935f6', '{"cookies": [{"name": ".AspNetCore.Antiforgery.rNzFo6qwfiE", "path": "/", "value": "CfDJ8BjbxCGijalLlqOEizaADZRpLHQ-Y0h1plTaqg6w2KStXMnDgpFB1_UQim8dTbq8ZBhb_Xi0psvTnJnrBoXKhbZZrnL815BAkXtBADoy7kZ1uJdw1z1oPsydavsVDxyfkXiMezgGcg-MHM8NTh281lQ", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": true, "sameSite": "Strict"}, {"name": "idsrv.session", "path": "/", "value": "5ae203ecf538ca69e611202f736ce355", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": false, "sameSite": "Lax"}, {"name": "idsrv", "path": "/", "value": "CfDJ8BjbxCGijalLlqOEizaADZQHGeD8szbKSvXG9BSam3hUQqwhYoIS04Xb-medp5g1KIXARmxjJ1fH5k5skjl99WcXno6xjagaACKSCY3Vf1lE2cRxCwi81CnMFbQ3pxTBO9Zstv7gm1LVSBarnkubfgIm34ylTA3iwj6TB25Q78UCkST0YM8R2VkKsKqrqIZ5zMQPhBIKvIFomoVAWY7Sfgq7WnxN4HNGYNJ4SQ2Ap-JpdLAlcUbyG43UlKsEqGVcOXvgMUUvCB26QPUjb_yvvX97tGIClp2Jj68k-eUy6TMD49uJyo1h9sp7L7HO6ITuamxcDAcWtbS9v18mEeEkE4mmfqN-0cHvhG9vYwnazoSaF5li8CVY6iAHterqtmNtq6KwxCSK3PPoxZxztEr2Um4cOkWGw3nadExJjkiSTD9aI3O9MIG-RV0Zi1UwSoj0ZHDIXKDGOrWhss2E-llpMDOtt5Zxkm5vHCuRKW2fNIM-22cE8Ha2D8PQpWxkJhTfN6EbQQnvcjOHQ3hwpJTBASl2fY-Q52dyQhHmnu9eIENfFRtZewIvjSqm36H9Tuy0Yg", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": true, "sameSite": "Lax"}, {"name": "Auth.ANAC.localhost", "path": "/", "value": "AB97FF00A31DB5562476B773BD6E2DCE966AD869D40F8420EDACF692E187061AE7401FF5733A3D73EF46A1221EBF3AB0AB715BE599C2C15FDC32F528242A88F9B0CF61B4F5181C1C159F2CBC20917B1ED869088A73E3DA2E2EE067660773EF5A5A3BB12B", "domain": "cad.anac.gob.ar", "secure": false, "expires": -1, "httpOnly": true, "sameSite": "Lax"}], "origins": []}', '2026-05-08 03:11:35.709485+00', '2026-05-14 04:24:27.396+00'),
	('e2b972df-7063-41fd-a4fe-ceae8de528ba', '2cc699b7-38e2-4499-89a2-e2c9f1b63129', '{"cookies": [{"name": ".AspNetCore.Antiforgery.rNzFo6qwfiE", "path": "/", "value": "CfDJ8Cz49cE4E3RIsMmVd0cGfOFAlNwAbMtAyj_wuWo8RMFu_nMiN_7SxKU0XHNo4MzwEBS22INUhKMFii7DNv7oDR0NMA7PklRm8ceAIr_MXYj65RuMm_OJVF5qpxfVBEh80Od5W0fwQTpU6zWbxs6GnAA", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": true, "sameSite": "Strict"}, {"name": "idsrv.session", "path": "/", "value": "c8427d19485bb5af3a68cb886e65e4ce", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": false, "sameSite": "Lax"}, {"name": "idsrv", "path": "/", "value": "CfDJ8Cz49cE4E3RIsMmVd0cGfOFeu5RFfOJE0MA4UtUPSQTHUywLZCM5Kw6G7ls59O4_nZjBDH-be4bcrK5dMipulYPS4RkXKHqShJWRDv5724yxXReNisai90jjykBlYmV4Nhp5HwWIVxjHGQ2LLgHUFLVwypDkaA5UY_Ivsjxh3Rrv0PkCC0Fo2ORXtg5izt7lsj0BA7iaH2gZ7YBbRV4NN0u4M3rpbyGVR_i_-6zochqypyL26OG2tnReiulwEBWWDfWUJd9SSgjAmdhGDEWSHC_QaxAx8q-DZ7bpBkvtSpsx03FcBcn7njfNhEaYOPJWoWxDmgth3xo78vM-JzSisTXe_6B35myK0z2i4rOYbC-l4hB8ajkFFv7Dlxj-jOVUZHREF8p4pX8MCYmVDZttRxnORgAMLhce3oB68duJTSMqTz_qhG-YPbhkfm0jNHN9_YJ9iAawRwDgBAs9KzsG3S3bkiSScD3uEbPgL7jPNHcGLgENM31ZEpGthzQ2j5MClUyWZ4xFFyQA_eXpzx9VatNhisFzfmyS3jY9hQ_Vb7v-sQit9JAzFUo1u-IHFp-TKw", "domain": "login.anac.gob.ar", "secure": true, "expires": -1, "httpOnly": true, "sameSite": "Lax"}, {"name": "Auth.ANAC.localhost", "path": "/", "value": "F024168F9A0FE56116F43D37DFE3D16828821B5558A82470665F3A86C64596A763A80C2EA8CE63741CE9401714093F18F1C3DB7B73E650EF5F9AA9137F0EF355EE7EC7230633BDDD2BE071A388CBE466A8EC5E5BDB7705EED116A017F27F0EEBA40E2CAB", "domain": "cad.anac.gob.ar", "secure": false, "expires": -1, "httpOnly": true, "sameSite": "Lax"}], "origins": []}', '2026-05-03 16:29:19.01614+00', '2026-06-12 20:26:35.592+00');

-- 9. Configurar RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read for airports" ON airports;
DROP POLICY IF EXISTS "Users can access their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can access their own flight logs" ON flight_logs;

CREATE POLICY "Public read for airports" ON airports FOR SELECT USING (true);
CREATE POLICY "Users can access their own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access their own flight logs" ON flight_logs FOR ALL USING (auth.uid() = user_id);

-- 10. Restaurar trigger para nuevos registros
CREATE OR REPLACE FUNCTION handle_new_user()
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
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
