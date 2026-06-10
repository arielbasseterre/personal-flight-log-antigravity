export type Screen = 'home' | 'pilotos' | 'tcp' | 'normas' | 'perfil' | 'changelog' | 'libro' | 'sync' | 'roster';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  license: string;
  dni: string;
  legajo: string;
  // Carry-forward totals
  total_airfield_day_pilot?: number | null;
  total_airfield_day_copilot?: number | null;
  total_airfield_night_pilot?: number | null;
  total_airfield_night_copilot?: number | null;
  total_cross_country_day_pilot?: number | null;
  total_cross_country_day_copilot?: number | null;
  total_cross_country_night_pilot?: number | null;
  total_cross_country_night_copilot?: number | null;
  total_landings?: number | null;
  total_instruction_time?: number | null;
  total_multi_engine?: number | null;
  total_jet?: number | null;
  total_turboprop?: number | null;
  total_ag_application?: number | null;
  total_ifr_real_pilot?: number | null;
  total_ifr_real_copilot?: number | null;
  total_ifr_hood?: number | null;
  total_sim_instructor?: number | null;
  total_sim_student?: number | null;
  initial_folio_number?: number | null;
  initial_total_hours?: number | null;
  grand_total_hours?: number | null;
  last_synced_flight_at?: string | null;
}

export interface FlightLog {
  id: string;
  user_id: string;
  
  // ANAC Payload fields (STRICT FORMAT)
  fechaHoraSalida: string;
  fechaHoraLlegada: string;
  origenID: string;
  origenPersonalizado?: string;
  destinoID: string;
  destinoPersonalizado?: string;
  finalidadID: string;
  clase: string;
  matriculaAvion: string;
  Marca_Modelo?: string;
  potencia: number;
  aterrizajes: number;
  horasDia: string;
  horasNoche: string;
  tipoVueloID: string;
  cargoID: string;
  autoridadCertificanteID: string;
  observaciones: string;
  Discriminaciones?: any[];
  
  // UI Helpers and Form fields (Legacy mapping support)
  year?: number;
  month?: number;
  day?: number;
  registration?: string;
  horasHabilitadas?: number;
  
  // Specific Form Fields
  departure_time_utc?: string;
  arrival_time_utc?: string;
  origin_ad?: string;
  destination_ad?: string;
  flight_purpose?: string;
  aircraft_model?: string;
  power_rating?: number;
  aircraft_class?: string;
  certifier_name?: string;
  certifier_role_id?: string;
  
  // Numeric Discriminations
  airfield_day_pilot?: number;
  airfield_day_copilot?: number;
  airfield_night_pilot?: number;
  airfield_night_copilot?: number;
  cross_country_day_pilot?: number;
  cross_country_day_copilot?: number;
  cross_country_night_pilot?: number;
  cross_country_night_copilot?: number;
  landings?: number;
  
  // Sub-metrics (for charts)
  ifr_real_pilot?: number;
  ifr_real_copilot?: number;
  ifr_hood?: number;
  instruction_time?: number;
  multi_engine?: number;
  jet?: number;
  turboprop?: number;
  ag_application?: number;
  sim_instructor?: number;
  sim_student?: number;

  // Logic helpers
  flight_type?: string;
  folio_number: number;
  is_capota: boolean;
  created_at: string;

  // DB Column Mappings (Lowercase/Underscore)
  ifr_instrument?: number;
  instruccion?: number;
}

export interface CalculationResult {
  tsMax: string;
  vencimiento: string;
  duracionServicio: string;
  descansoMinimo: string;
  proximaDisponibilidad: string;
}

export interface AnacLog {
  vueloTripulanteID: number;
  cargoDesc: string;
  origenDesc: string;
  destinoDesc: string;
  finalidad: string;
  fechaSalida: string; // ISO format "2026-04-29T18:07:00"
  fechaLlegada: string; // ISO format
  clase: string;
  matricula: string;
  marcaModelo: string;
  potencia: number;
  aterrizajes: number;
  horasDia: number;
  horasNoche: number;
  tipoVuelo: string;
  autoridadCertificante: string;
  observaciones: string;
}

export interface AnacPagedResponse {
  totalRows: number;
  dataSource: AnacLog[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ARMS ROSTER TYPES — Portal fbz.arms.aero (Crew Daily Roster)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clasificación del tipo de evento diario del roster.
 * Cada valor mapea directamente a un descriptor que aparece en la tabla de ARMS.
 */
export type ArmsDayEventType =
  | 'FLIGHT_OP'        // OP - (RS) — Vuelo operativo regular
  | 'FLIGHT_DH'        // DH - DH POS — Vuelo de posicionamiento (deadhead)
  | 'OFF'              // Día libre en base (descanso programado)
  | 'STANDBY'          // STB - STBY — Guardia o reserva de servicio
  | 'NDA'              // NDA — No Duty Assigned / Actividad sin servicio
  | 'LAYOVER'          // NDA/Layover — Pernocte fuera de base (destino remoto)
  | 'GTR'              // GTR — Ground Training Recurrent
  | 'UNKNOWN';         // Tipo no reconocido — fallback


/**
 * Miembro de la tripulación asignada a un tramo de vuelo.
 * Extraído de la celda "Crew Complement" de ARMS.
 */
export interface ArmsCrewMember {
  name: string;        // Nombre completo, e.g. "BASSETERRE ARIEL"
  role: 'CPT' | 'FO' | 'CC' | 'PU' | 'OTHER';  // Rol aeronáutico
}

/**
 * Un tramo (leg) individual de vuelo.
 * Un día puede contener múltiples legs (vuelos encadenados).
 */
export interface ArmsFlightLeg {
  flightNumber: string;        // Número de vuelo, e.g. "FO5210"
  origin: string;              // Código del aeropuerto de origen, e.g. "AEP"
  destination: string;         // Código del aeropuerto de destino, e.g. "TUC"
  reportTimeLoc: string;       // Hora de presentación local, e.g. "08:55"
  reportTimeUtc: string;       // Hora de presentación UTC, e.g. "11:55"
  departureTimeLoc: string;    // Hora de salida local (STD), e.g. "10:10"
  departureTimeUtc: string;    // Hora de salida UTC, e.g. "13:10"
  arrivalTimeLoc: string;      // Hora de llegada local (STA), e.g. "17:50"
  arrivalTimeUtc: string;      // Hora de llegada UTC, e.g. "20:50"
  blockTime: string;           // Tiempo bloque HH:MM, e.g. "07:40"
  turnTime?: string;           // Tiempo en tierra hasta el sig. tramo, e.g. "02:20"
  crewComplement: ArmsCrewMember[];  // Tripulación asignada a este leg
  remarks?: string;            // Trg/Remarks column from ARMS
}

/**
 * Entrada de un día completo del roster.
 * Agrupa todos los tramos de vuelo o el evento de tierra para una fecha.
 */
export interface ArmsDayEntry {
  date: string;                // Fecha original de ARMS, e.g. "02-May-2026"
  dateISO: string;             // ISO format para indexar, e.g. "2026-05-02"
  eventType: ArmsDayEventType; // Clasificación del día
  isFlight: boolean;           // true si eventType es FLIGHT_OP o FLIGHT_DH
  legs: ArmsFlightLeg[];       // Array de tramos (vacío si no es vuelo)
  dailyBlockTotal: string;     // Total bloque del día HH:MM, e.g. "07:40"
  layoverAirport?: string;     // Código ICAO si es LAYOVER, e.g. "SPJC"
  layoverDuration?: string;    // Duración del layover, e.g. "1d 4h"
  rawTask: string;             // Task original de ARMS sin parsear
  remarks?: string;            // Trg/Remarks column from ARMS
  startTimeLoc?: string;       // Hora inicio guardia local
  startTimeUtc?: string;       // Hora inicio guardia UTC
  endTimeLoc?: string;         // Hora fin guardia local
  endTimeUtc?: string;         // Hora fin guardia UTC
}

/**
 * Roster completo de un mes, tal como se almacena en Supabase.
 */
export interface ArmsRosterMonth {
  userId: string;              // UUID del usuario autenticado
  month: number;               // Mes (1-12)
  year: number;                // Año (2026, etc.)
  syncedAt: string;            // ISO timestamp de la última sincronización
  entries: ArmsDayEntry[];     // Todas las entradas del mes
}
