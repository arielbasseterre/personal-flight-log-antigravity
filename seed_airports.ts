import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('--- INICIANDO CARGA DE AEROPUERTOS ---');
  
  try {
    const csvPath = path.join(__dirname, 'airports.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error(`No se encontró el archivo airports.csv en ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    if (lines.length <= 1) {
      throw new Error('El archivo airports.csv está vacío o contiene solo encabezados.');
    }

    // Cabecera: iata_code,icao_code,anac_code,name,city
    const airports = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Manejar posibles comas dentro de las comillas en los nombres de aeropuertos
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length < 2) continue;

      const iata = parts[0]?.trim().replace(/^"|"$/g, '');
      const icao = parts[1]?.trim().replace(/^"|"$/g, '');
      const anac = parts[2]?.trim().replace(/^"|"$/g, '');
      const name = parts[3]?.trim().replace(/^"|"$/g, '');

      if (iata && icao) {
        const cleanAnac = anac && anac !== 'N/A' && anac !== '' ? anac.toUpperCase() : null;
        airports.push({
          iata_code: iata.toUpperCase(),
          icao_code: icao.toUpperCase(),
          anac_code: cleanAnac,
          key_code: cleanAnac || iata.toUpperCase(), // Map key_code which is used in schema
          name: name || '',
          country: 'Argentina'
        });
      }
    }

    console.log(`Se encontraron ${airports.length} aeropuertos para procesar en airports.csv.`);

    let successCount = 0;
    let errorCount = 0;

    for (const airport of airports) {
      // Upsert por key_code ya que es la única columna con restricción UNIQUE
      const { error } = await supabase
        .from('airports')
        .upsert(airport, { onConflict: 'key_code' });

      if (error) {
        console.error(`❌ Error al cargar ${airport.key_code} (${airport.name}):`, error.message);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log('\n--- RESUMEN ---');
    console.log(`✅ Cargados con éxito: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log('--------------------------------');

  } catch (err: any) {
    console.error('❌ Error catastrófico en el seeding:', err.message);
  }
}

seed();
