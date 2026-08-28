// ═══════════════════════════════════════════════════════════════════════════
// ANAC Airport Code Mappings — Single Source of Truth
// ═══════════════════════════════════════════════════════════════════════════
// Mapea códigos IATA/ICAO/ANAC locales → códigos que espera ANAC en su API.
// Usado por: server.ts (sync manual/edit), api/sync-anac.ts (serverless sync),
//            arms-scraper.ts (parser roster).
// ═══════════════════════════════════════════════════════════════════════════

export const ANAC_MAPPINGS: Record<string, string> = {
  // Nacionales — IATA/ICAO → ANAC
  "AEP": "AER", "SABE": "AER", // Aeroparque
  "EZE": "EZE", "SAEZ": "EZE", // Ezeiza
  "COR": "CBA", "SACO": "CBA", // Córdoba
  "MDZ": "DOZ", "SAME": "DOZ", // Mendoza
  "BRC": "BAR", "SAZS": "BAR", // Bariloche
  "IGR": "IGU", "SARI": "IGU", // Puerto Iguazú
  "SLA": "SAL", "SASA": "SAL", // Salta
  "NQN": "NEU", "SAZN": "NEU", // Neuquén
  "TUC": "TUC", "SANT": "TUC", // Tucumán
  "USH": "USU", "SAWH": "USU", // Ushuaia
  "FTE": "ECA", "SAWC": "ECA", "CAL": "ECA", // El Calafate
  "JUJ": "JUJ", "SASJ": "JUJ", // Jujuy
  "PSS": "POS", "SARP": "POS", // Posadas
  "CNQ": "CRR", "SARC": "CRR", // Corrientes
  "RES": "SIS", "SARE": "SIS", // Resistencia
  "UAQ": "JUA", "SANU": "JUA", // San Juan
  "LUQ": "UIS", "SAOU": "UIS", // San Luis
  "CTC": "CAT", "SANC": "CAT", // Catamarca
  "IRJ": "LAR", "SANL": "LAR", // La Rioja
  "SFN": "SVO", "SAAV": "SVO", // Santa Fe
  "PRA": "PAR", "SAAP": "PAR", // Paraná
  "ROS": "ROS", "SAAR": "ROS", // Rosario
  "VDM": "VIE", "SAVN": "VIE", // Viedma
  "BHI": "BCA", "SAZB": "BCA", // Bahía Blanca
  "MDQ": "MDP", "SAZM": "MDP", // Mar del Plata
  "REL": "TRE", "SAVT": "TRE", // Trelew
  "PMY": "DRY", "SAVY": "DRY", // Puerto Madryn
  "CRD": "CRV", "CRV": "CRV", "SAVC": "CRV", // Comodoro Rivadavia
  "RGL": "GAL", "SAWG": "GAL", // Río Gallegos
  "RGA": "GRA", "SAWE": "GRA", // Río Grande
  "CPC": "CHP", "SAZY": "CHP", // Chapelco / San Martín de los Andes
  "EQS": "ESQ", "SAVV": "ESQ", // Esquel
  "LGS": "MLG", "SAMM": "MLG", // Malargüe
  "AFA": "SRA", "SAMR": "SRA", // San Rafael
  "RSA": "OSA", "SAWR": "OSA", // Santa Rosa
  "GPO": "GPI", "SAZG": "GPI", // General Pico
  "VME": "RYD", "SAOR": "RYD", // Villa Mercedes
  // Internacionales → OACI (código 4 letras)
  "VVI": "SLVR", "SCL": "SCEL", "MVD": "SUMU", "PDP": "SULS",
  "ASU": "SGAS", "GRU": "SBGR", "GIG": "SBGL", "FLN": "SBFL",
  "SSA": "SBSV", "MCZ": "SBMO", "REC": "SBRF", "FOR": "SBFZ",
  "LIM": "SPJC", "BOG": "SKBO", "UIO": "SEQM", "PTY": "MPTO",
  "CUN": "MMUN", "MEX": "MMMX", "PUJ": "MDPC", "HAV": "MUHA",
  "MIA": "KMIA", "JFK": "KJFK", "MAD": "LEMD", "FCO": "LIRF",
};

/**
 * Convierte un código de aeropuerto (IATA, ICAO, ANAC o nombre) al código que espera ANAC.
 * Si el código no está en el mapping, lo devuelve tal cual (fallback seguro).
 */
export function getAnacCode(code: string): string {
  const c = String(code || "").trim().toUpperCase();
  if (!c) return c;
  return ANAC_MAPPINGS[c] || c;
}