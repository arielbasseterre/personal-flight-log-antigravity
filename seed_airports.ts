
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!; // Note: anon key might fail if RLS is strict, but for airports table we opened it.
// However, to INSERT we might need service key or a logged in user.
// In this environment, we usually have a service role if configured, otherwise we use the anon key.

const supabase = createClient(supabaseUrl, supabaseKey);

const AIRPORTS = [
  { iata_code: 'AEP', icao_code: 'SABE', name: 'Aeroparque Jorge Newbery', city: 'Buenos Aires' },
  { iata_code: 'EZE', icao_code: 'SAEZ', name: 'Ezeiza Ministro Pistarini', city: 'Buenos Aires' },
  { iata_code: 'COR', icao_code: 'SACO', name: 'Córdoba / Ambrosio Taravella', city: 'Córdoba' },
  { iata_code: 'MDZ', icao_code: 'SAMM', name: 'Mendoza / El Plumerillo', city: 'Mendoza' },
  { iata_code: 'BRC', icao_code: 'SAZS', name: 'Bariloche / Teniente Candelaria', city: 'Bariloche' },
  { iata_code: 'IGR', icao_code: 'SARI', name: 'Puerto Iguazú / Mayor Krause', city: 'Puerto Iguazú' },
  { iata_code: 'SLA', icao_code: 'SASA', name: 'Salta / Martín Miguel de Güemes', city: 'Salta' },
  { iata_code: 'NQN', icao_code: 'SAZN', name: 'Neuquén / Presidente Perón', city: 'Neuquén' },
  { iata_code: 'TUC', icao_code: 'SANT', name: 'Tucumán / Benjamín Matienzo', city: 'Tucumán' },
  { iata_code: 'USH', icao_code: 'SAWH', name: 'Ushuaia / Malvinas Argentinas', city: 'Ushuaia' },
  { iata_code: 'FTE', icao_code: 'SAWC', name: 'El Calafate / Armando Tola', city: 'El Calafate' },
  { iata_code: 'JUJ', icao_code: 'SASJ', name: 'Jujuy / Horacio Guzmán', city: 'Jujuy' },
  { iata_code: 'REL', icao_code: 'SAVT', name: 'Trelew / Almirante Zar', city: 'Trelew' },
  { iata_code: 'MDQ', icao_code: 'SAZM', name: 'Mar del Plata / Astor Piazzolla', city: 'Mar del Plata' },
  { iata_code: 'BHI', icao_code: 'SAZB', name: 'Bahía Blanca / Comandante Espora', city: 'Bahía Blanca' },
  { iata_code: 'RES', icao_code: 'SARE', name: 'Resistencia', city: 'Resistencia' },
  { iata_code: 'CNQ', icao_code: 'SARC', name: 'Corrientes / Piragine Niveyro', city: 'Corrientes' },
  { iata_code: 'PSS', icao_code: 'SARP', name: 'Posadas / General San Martín', city: 'Posadas' },
  { iata_code: 'FMA', icao_code: 'SARF', name: 'Formosa', city: 'Formosa' },
  { iata_code: 'UAQ', icao_code: 'SANU', name: 'San Juan / Domingo F. Sarmiento', city: 'San Juan' },
  { iata_code: 'IRJ', icao_code: 'SANL', name: 'La Rioja / Capitán Almandos Almonacid', city: 'La Rioja' },
  { iata_code: 'CTC', icao_code: 'SANC', name: 'Catamarca / Felipe Varela', city: 'Catamarca' },
  { iata_code: 'LUQ', icao_code: 'SAOU', name: 'San Luis / Brigadier Ojeda', city: 'San Luis' },
  { iata_code: 'SRA', icao_code: 'SASR', name: 'Santa Rosa', city: 'Santa Rosa' },
  { iata_code: 'VDM', icao_code: 'SAVN', name: 'Viedma / Edgardo Castello', city: 'Viedma' },
  { iata_code: 'EQS', icao_code: 'SAVE', name: 'Esquel', city: 'Esquel' },
  { iata_code: 'RGL', icao_code: 'SAWG', name: 'Río Gallegos / Piloto Fernández', city: 'Río Gallegos' },
  { iata_code: 'CRV', icao_code: 'SAVC', name: 'Comodoro Rivadavia / General Mosconi', city: 'Comodoro Rivadavia' },
  { iata_code: 'RGA', icao_code: 'SAWE', name: 'Río Grande / Gobernador Trejo Noel', city: 'Río Grande' },
  { iata_code: 'CPC', icao_code: 'SAZY', name: 'Chapelco / Aviador Campos', city: 'San Martín de los Andes' },
  { iata_code: 'PMY', icao_code: 'SAVY', name: 'Puerto Madryn / El Tehuelche', city: 'Puerto Madryn' },
  { iata_code: 'AFA', icao_code: 'SAMR', name: 'San Rafael', city: 'San Rafael' },
  { iata_code: 'SDE', icao_code: 'SANE', name: 'Santiago del Estero / Ángel Aragonés', city: 'Santiago del Estero' },
  { iata_code: 'RHD', icao_code: 'SANR', name: 'Termas de Río Hondo', city: 'Termas de Río Hondo' },
  { iata_code: 'SFN', icao_code: 'SAAV', name: 'Santa Fe / Sauce Viejo', city: 'Santa Fe' },
  { iata_code: 'PRA', icao_code: 'SAAP', name: 'Paraná / General Urquiza', city: 'Paraná' },
  { iata_code: 'RLO', icao_code: 'SAOR', name: 'Merlo / Valle del Conlara', city: 'Merlo' },
  { iata_code: 'RCQ', icao_code: 'SATR', name: 'Reconquista', city: 'Reconquista' },
  { iata_code: 'ROS', icao_code: 'SAAR', name: 'Rosario / Islas Malvinas', city: 'Rosario' },
  { iata_code: 'VME', icao_code: 'SAVV', name: 'Villa Mercedes', city: 'Villa Mercedes' },
  { iata_code: 'RCU', icao_code: 'SAOC', name: 'Río Cuarto', city: 'Río Cuarto' },
  { iata_code: 'GPO', icao_code: 'SAZQ', name: 'General Pico', city: 'General Pico' },
  { iata_code: 'TDL', icao_code: 'SAZT', name: 'Tandil', city: 'Tandil' },
  { iata_code: 'OLN', icao_code: 'SAZH', name: 'Olavarría', city: 'Olavarría' },
  { iata_code: 'PUD', icao_code: 'SAWD', name: 'Puerto Deseado', city: 'Puerto Deseado' },
  { iata_code: 'PMO', icao_code: 'SAWP', name: 'Perito Moreno', city: 'Perito Moreno' },
  { iata_code: 'PDP', icao_code: 'SULS', name: 'Punta del Este / Laguna del Sauce', city: 'Punta del Este' },
  { iata_code: 'MVD', icao_code: 'SUMU', name: 'Montevideo / Carrasco', city: 'Montevideo' },
  { iata_code: 'SCL', icao_code: 'SCEL', name: 'Santiago de Chile', city: 'Santiago' },
  { iata_code: 'GRU', icao_code: 'SBGR', name: 'San Pablo / Guarulhos', city: 'San Pablo' },
  { iata_code: 'GIG', icao_code: 'SBGL', name: 'Río de Janeiro / Galeão', city: 'Río de Janeiro' },
  { iata_code: 'MIA', icao_code: 'KMIA', name: 'Miami International', city: 'Miami' },
  { iata_code: 'MAD', icao_code: 'LEMD', name: 'Madrid / Barajas', city: 'Madrid' },
  { iata_code: 'LHR', icao_code: 'EGLL', name: 'Londres / Heathrow', city: 'Londres' },
  { iata_code: 'CDG', icao_code: 'LFPG', name: 'París / Charles de Gaulle', city: 'París' },
  { iata_code: 'BCN', icao_code: 'LEBL', name: 'Barcelona / El Prat', city: 'Barcelona' },
  { iata_code: 'MEX', icao_code: 'MMMX', name: 'Ciudad de México', city: 'Ciudad de México' },
  { iata_code: 'BOG', icao_code: 'SKBO', name: 'Bogotá / El Dorado', city: 'Bogotá' },
  { iata_code: 'LIM', icao_code: 'SPJC', name: 'Lima / Jorge Chávez', city: 'Lima' },
  { iata_code: 'PTY', icao_code: 'MPTO', name: 'Panamá / Tocumen', city: 'Panamá' },
  { iata_code: 'JFK', icao_code: 'KJFK', name: 'Nueva York / JFK', city: 'Nueva York' },
];

async function seed() {
  console.log('Seeding airports...');
  for (const airport of AIRPORTS) {
    const { error } = await supabase
      .from('airports')
      .upsert(airport, { onConflict: 'iata_code' });
    if (error) console.error(`Error seeding ${airport.iata_code}:`, error.message);
  }
  console.log('Finished seeding airports.');
}

seed();
