// ═══════════════════════════════════════════════════════════════════════════
// Airports CSV Loader + O(1) Lookup — Single Source of Truth
// ═══════════════════════════════════════════════════════════════════════════
// Fuente única: airports.csv (64 aeropuertos ANAC)
// Se carga UNA vez en memoria al primer uso (lazy init).
// Lookup por IATA, ICAO, ANAC, nombre o ciudad → devuelve código IATA canónico.
// ═══════════════════════════════════════════════════════════════════════════

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Airport {
  iata_code: string;
  icao_code: string;
  anac_code: string | null;
  name: string;
  city: string;
}

let AIRPORT_MAP: Map<string, Airport> | null = null;
let AIRPORT_LIST: Airport[] | null = null;

/**
 * Normaliza string para búsqueda: minúsculas, sin acentos, trim.
 */
function normalize(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Parsea el CSV de aeropuertos y construye el Map de lookup.
 * Keys: IATA, ICAO, ANAC, nombre normalizado, ciudad normalizada.
 * Value: objeto Airport completo.
 */
function buildAirportMap(csvText: string): Map<string, Airport> {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return new Map();

  const map = new Map<string, Airport>();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length < 2) continue;

    const iata = parts[0]?.trim().replace(/^"|"$/g, '').toUpperCase();
    const icao = parts[1]?.trim().replace(/^"|"$/g, '').toUpperCase();
    const anac = parts[2]?.trim().replace(/^"|"$/g, '').toUpperCase();
    const name = parts[3]?.trim().replace(/^"|"$/g, '');
    const city = parts[4]?.trim().replace(/^"|"$/g, '');

    const cleanAnac = anac && anac !== 'N/A' && anac !== '' ? anac : null;

    const airport: Airport = {
      iata_code: iata || '',
      icao_code: icao || '',
      anac_code: cleanAnac,
      name: name || '',
      city: city || '',
    };

    // Índice por todos los códigos conocidos
    const keys = [
      iata,
      icao,
      cleanAnac,
      normalize(name),
      normalize(city),
    ].filter(Boolean) as string[];

    for (const key of keys) {
      if (key && !map.has(key)) map.set(key, airport);
    }
  }
  return map;
}

/**
 * Carga el CSV y construye el Map en memoria (solo la primera vez).
 * Llamar al inicio de cualquier operación que necesite resolver aeropuertos.
 */
export async function ensureAirportsLoaded(): Promise<void> {
  if (AIRPORT_MAP) return;

  try {
    const csvPath = path.join(process.cwd(), 'airports.csv');
    const csvText = await fs.readFile(csvPath, 'utf-8');
    AIRPORT_MAP = buildAirportMap(csvText);
    // También guardamos lista para iterar si hace falta
    AIRPORT_LIST = Array.from(new Map(Array.from(AIRPORT_MAP.entries()).reverse()).values());
    console.log(`[AIRPORTS] Cargados ${AIRPORT_MAP.size} índices (${AIRPORT_LIST.length} aeropuertos únicos)`);
  } catch (e: any) {
    console.error('[AIRPORTS] Error cargando airports.csv:', e.message);
    AIRPORT_MAP = new Map();
    AIRPORT_LIST = [];
  }
}

/**
 * Resuelve un código/nombre/ciudad a su código IATA canónico.
 * Ejemplos válidos: "AEP", "SABE", "AER", "aeroparque", "buenos aires"
 * Retorna null si no encuentra coincidencia.
 */
export function resolveAirportCode(value: string): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // 1. Lookup directo en Map (O(1)) — códigos exactos
  const key = raw.toUpperCase();
  if (AIRPORT_MAP?.has(key)) return AIRPORT_MAP.get(key)!.iata_code || key;

  // 2. Lookup por nombre/ciudad normalizado (O(1))
  const norm = normalize(raw);
  if (norm.length >= 3 && AIRPORT_MAP?.has(norm)) {
    return AIRPORT_MAP.get(norm)!.iata_code || null;
  }

  // 3. Búsqueda parcial por nombre/ciudad (fallback O(n) raro)
  if (AIRPORT_LIST) {
    for (const ap of AIRPORT_LIST) {
      const nameN = normalize(ap.name);
      const cityN = normalize(ap.city);
      if (nameN === norm || cityN === norm || nameN.includes(norm) || cityN.includes(norm)) {
        return ap.iata_code;
      }
    }
  }

  return null;
}

/**
 * Devuelve la lista completa de aeropuertos (para UI selectors, etc.)
 */
export function getAllAirports(): Airport[] {
  return AIRPORT_LIST || [];
}

/**
 * Fuerza recarga (útil si se modifica el CSV en caliente — requiere reinicio real en prod)
 */
export function resetAirportsCache(): void {
  AIRPORT_MAP = null;
  AIRPORT_LIST = null;
}