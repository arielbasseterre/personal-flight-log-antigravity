export type Screen = 'home' | 'pilotos' | 'tcp' | 'normas' | 'perfil' | 'changelog' | 'libro';

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
