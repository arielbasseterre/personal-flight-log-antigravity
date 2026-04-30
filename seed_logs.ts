
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const userId = 'f44e6125-333f-45a2-8448-2c79d59112d8'; // Based on turn logs

const models = ['Cessna 172', 'Piper Archer', 'Beechcraft Baron', 'Cirrus SR22'];
const registrations = ['LV-X123', 'LV-G456', 'LV-S789', 'LV-H012'];
const airports = ['SADM', 'SADF', 'SACO', 'SAEZ', 'SABP', 'SAAR'];

async function seed() {
  console.log("Generating 20 random flight logs...");
  
  const logs = [];
  const now = new Date();

  for (let i = 0; i < 20; i++) {
    const flightDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const duration = 1 + Math.random() * 3; // 1 to 4 hours
    
    // Randomly distribute time across different categories
    const type = Math.random();
    
    const log = {
      id: crypto.randomUUID(),
      user_id: userId,
      year: flightDate.getFullYear(),
      month: flightDate.getMonth() + 1,
      day: flightDate.getDate(),
      departure_time_utc: "12:00",
      arrival_time_utc: "14:00",
      origin_ad: airports[Math.floor(Math.random() * airports.length)],
      destination_ad: airports[Math.floor(Math.random() * airports.length)],
      flight_purpose: "VP",
      aircraft_model: models[Math.floor(Math.random() * models.length)],
      registration: registrations[Math.floor(Math.random() * registrations.length)],
      power_rating: 160,
      aircraft_class: "MONO-T",
      // Simple logic: either airfield or cross country
      airfield_day_pilot: type > 0.5 ? duration : 0,
      cross_country_day_pilot: type <= 0.5 ? duration : 0,
      landings: 1 + Math.floor(Math.random() * 3),
      instruction_time: 0,
      multi_engine: 0,
      jet: 0,
      turboprop: 0,
      ag_application: 0,
      ifr_real_pilot: Math.random() > 0.7 ? duration * 0.5 : 0,
      ifr_real_copilot: 0,
      is_capota: false,
      folio_number: 1, // Will be overridden by PDF logic anyway based on initials
      created_at: flightDate.toISOString()
    };
    logs.push(log);
  }

  const { error } = await supabase.from('flight_logs').insert(logs);

  if (error) {
    console.error("Error inserting logs:", error);
  } else {
    console.log("Successfully inserted 20 logs.");
  }
}

seed();
