import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  History, 
  BarChart3, 
  FileDown, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  PlaneTakeoff, 
  Save, 
  Trash2, 
  ChevronRight, 
  Info,
  Edit2,
  FileText,
  ArrowLeft,
  User,
  X,
  AlertTriangle,
  CheckCircle2,
  Globe,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { FlightLog, Profile, AnacLog } from '@/src/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { FlightLogPDF } from './FlightLogPDF';
import { AnacAuth } from './AnacAuth';
import { supabase } from '@/src/utils/supabase/client';

interface LibroScreenProps {
  logs: FlightLog[];
  setLogs: React.Dispatch<React.SetStateAction<FlightLog[]>>;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshData: () => Promise<Profile | null>;
  loading: boolean;
}

const LICENSE_TYPES = [
  { sigla: 'PPA', label: 'Piloto Privado de Avión' },
  { sigla: 'PCA', label: 'Piloto Comercial de Avión' },
  { sigla: 'PCIA', label: 'Piloto Comercial de Primera Clase de Avión' },
  { sigla: 'TLA', label: 'Piloto de Transporte de Línea Aérea de Avión' },
  { sigla: 'PPH', label: 'Piloto Privado de Helicóptero' },
  { sigla: 'PCH', label: 'Piloto Comercial de Helicóptero' },
  { sigla: 'TLH', label: 'Piloto de Transporte de Línea Aérea de Helicóptero' },
  { sigla: 'PBP', label: 'Piloto de Planeador' },
  { sigla: 'PUV', label: 'Piloto de Ultraliviano motorizado' },
  { sigla: 'PGL', label: 'Piloto de Globo Libre' },
  { sigla: 'PCD', label: 'Piloto Comercial de Dirigible' },
  { sigla: 'PAC', label: 'Piloto de Avión de Combate' },
  { sigla: 'IV', label: 'Instructor de Vuelo (RAAC 61.163)' },
  { sigla: 'PAA', label: 'Piloto de Aeroaplicador' },
];

const FLIGHT_PURPOSES = [
  { key: "47", value: "ACROBACIA", sigla: "ACR" },
  { key: "46", value: "ADAPTACIÓN", sigla: "ADAP" },
  { key: "61", value: "AEROPLICADOR", sigla: "AER" },
  { key: "62", value: "COMBATE CONTRA INCENDIOS DE BOSQUES Y CAMPOS", sigla: "CI" },
  { key: "63", value: "ENTRENAMIENTO", sigla: "ENT" },
  { key: "64", value: "EXAMEN", sigla: "EXA" },
  { key: "65", value: "VUELO EN FORMACIÓN", sigla: "FOR" },
  { key: "66", value: "FOTOGRAFÍA", sigla: "FOTO" },
  { key: "67", value: "INSTRUCTOR", sigla: "I" },
  { key: "68", value: "INSTRUCCIÓN", sigla: "INST" },
  { key: "69", value: "INSPECTOR", sigla: "IP" },
  { key: "70", value: "LANZAMIENTO DE PARACAIDISTAS", sigla: "LP" },
  { key: "71", value: "VUELO NO REGULAR", sigla: "N" },
  { key: "72", value: "PRUEBA DE AERONAVES", sigla: "PA" },
  { key: "73", value: "READAPTACIÓN", sigla: "READ" },
  { key: "74", value: "REMOLQUE DE PLANEADOR", sigla: "RP" },
  { key: "75", value: "SANITARIO", sigla: "SAN" },
  { key: "76", value: "TRABAJO AÉREO", sigla: "TA" },
  { key: "77", value: "VUELO OFICIAL", sigla: "VO" },
  { key: "78", value: "VUELO PRIVADO", sigla: "VP" },
  { key: "79", value: "LINEA AEREA", sigla: "LA" },
  { key: "80", value: "INSPECTOR (TCP)", sigla: "IP" },
  { key: "81", value: "TRIPULANTE DE CABINA DE PASAJEROS EN INSTRUCCION", sigla: "TCPI" }
];

const FLIGHT_TYPES = [
  { key: "1", value: "LOCAL" },
  { key: "2", value: "TRAVESIA" },
  { key: "3", value: "SIMULADOR" }
];

const CERTIFIER_ROLES = [
  { key: "2", value: "JEFE DE AERODROMO" },
  { key: "3", value: "OFICINA DE PLAN DE VUELO" },
  { key: "4", value: "OFICINA DE ARO/AIS" },
  { key: "5", value: "INSTRUCTOR DE VUELO" },
  { key: "6", value: "JEFE DE INSTRUCTORES" },
  { key: "7", value: "DIRECTOR ESCUELA" },
  { key: "8", value: "PRESIDENTE INST. AERODEPORTIVA" },
  { key: "9", value: "INSPECTORES DE VUELO" },
  { key: "10", value: "INSPECTORES DE LINEA AEREA" },
  { key: "11", value: "DIRECTOR DE AERONAUTICA PROVINCIAL" },
  { key: "12", value: "JEFE DE OPERACIONES" },
  { key: "13", value: "TITULAR EMPRESA" },
  { key: "14", value: "JEFE DE PILOTOS" },
  { key: "15", value: "GTE DE OPERACIONES" },
  { key: "16", value: "JEFE DE FLOTA" },
  { key: "17", value: "JEFE DE LINEA" },
  { key: "18", value: "INSPECTORES RECONOCIDOS" },
  { key: "19", value: "INSTRUCTOR DE SIMULADOR" },
  { key: "1", value: "OTROS" }
];

const IATA_AIRPORTS: Record<string, { iata: string, name: string }> = {
  'SABE': { iata: 'AEP', name: 'Aeroparque Jorge Newbery' },
  'SAEZ': { iata: 'EZE', name: 'Ezeiza Ministro Pistarini' },
  'SACO': { iata: 'COR', name: 'Córdoba / Pajas Blancas' },
  'SAMM': { iata: 'MDZ', name: 'Mendoza / El Plumerillo' },
  'SAZS': { iata: 'BRC', name: 'Bariloche' },
  'SARI': { iata: 'IGR', name: 'Puerto Iguazú' },
  'SASA': { iata: 'SLA', name: 'Salta' },
  'SAZN': { iata: 'NQN', name: 'Neuquén' },
  'SANT': { iata: 'TUC', name: 'Tucumán' },
  'SAWH': { iata: 'USH', name: 'Ushuaia' },
  'SAWC': { iata: 'FTE', name: 'El Calafate' },
  'SASJ': { iata: 'JUJ', name: 'Jujuy' },
  'SAVT': { iata: 'REL', name: 'Trelew' },
  'SAZM': { iata: 'MDQ', name: 'Mar del Plata' },
  'SAZB': { iata: 'BHI', name: 'Bahía Blanca' },
  'SARE': { iata: 'RES', name: 'Resistencia' },
  'SARC': { iata: 'CNQ', name: 'Corrientes' },
  'SARP': { iata: 'PSS', name: 'Posadas' },
  'SARF': { iata: 'FMA', name: 'Formosa' },
  'SANU': { iata: 'UAQ', name: 'San Juan' },
  'SANL': { iata: 'IRJ', name: 'La Rioja' },
  'SANC': { iata: 'CTC', name: 'Catamarca' },
  'SAOU': { iata: 'LUQ', name: 'San Luis' },
  'SASR': { iata: 'SRA', name: 'Santa Rosa' },
  'SAVN': { iata: 'VDM', name: 'Viedma' },
  'SAVE': { iata: 'EQS', name: 'Esquel' },
  'SAWG': { iata: 'RGL', name: 'Río Gallegos' },
  'SAVC': { iata: 'CRV', name: 'Comodoro Rivadavia' },
  'SAWE': { iata: 'RGA', name: 'Río Grande' },
  'SAZY': { iata: 'CPC', name: 'Chapelco / San Martín de los Andes' },
  'SAVY': { iata: 'PMY', name: 'Puerto Madryn' },
  'SAMR': { iata: 'AFA', name: 'San Rafael' },
  'SANE': { iata: 'SDE', name: 'Santiago del Estero' },
  'SANR': { iata: 'RHD', name: 'Termas de Río Hondo' },
  'SAAV': { iata: 'SFN', name: 'Santa Fe' },
  'SAAP': { iata: 'PRA', name: 'Paraná' },
  'SAOR': { iata: 'RLO', name: 'Merlo' },
  'SATR': { iata: 'RCQ', name: 'Reconquista' },
  'SAAR': { iata: 'ROS', name: 'Rosario' },
  'SAVV': { iata: 'VME', name: 'Villa Mercedes' },
  'SAOC': { iata: 'RCU', name: 'Río Cuarto' },
  'SAZQ': { iata: 'GPO', name: 'General Pico' },
  'SAZT': { iata: 'TDL', name: 'Tandil' },
  'SAZH': { iata: 'OLN', name: 'Olavarría' },
  'SAWD': { iata: 'PUD', name: 'Puerto Deseado' },
  'SAWP': { iata: 'PMO', name: 'Perito Moreno' },
  'SULS': { iata: 'PDP', name: 'Punta del Este' },
  'SUMU': { iata: 'MVD', name: 'Montevideo' },
  'SCEL': { iata: 'SCL', name: 'Santiago de Chile' },
  'SBGR': { iata: 'GRU', name: 'San Pablo' },
  'SBGL': { iata: 'GIG', name: 'Río de Janeiro' },
  'KMIA': { iata: 'MIA', name: 'Miami' },
  'LEMD': { iata: 'MAD', name: 'Madrid' },
  'EGLL': { iata: 'LHR', name: 'Londres' },
  'LFPG': { iata: 'CDG', name: 'París' },
  'LEBL': { iata: 'BCN', name: 'Barcelona' },
  'MMMX': { iata: 'MEX', name: 'Ciudad de México' },
  'SKBO': { iata: 'BOG', name: 'Bogotá' },
  'SPJC': { iata: 'LIM', name: 'Lima' },
  'MPTO': { iata: 'PTY', name: 'Panamá' },
  'KJFK': { iata: 'JFK', name: 'Nueva York' },
};

const IATA_LIST = Object.entries(IATA_AIRPORTS).map(([icao, info]) => ({ icao, ...info }));

export const LibroScreen = ({ logs, setLogs, profile, setProfile, refreshData, loading }: LibroScreenProps) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [dbAirports, setDbAirports] = useState<any[]>([]);

  // Initial state for the form
  const initialFormState: Partial<FlightLog> = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    departure_time_utc: "12:00",
    arrival_time_utc: "14:00",
    origin_ad: "",
    destination_ad: "",
    flight_purpose: "78",
    aircraft_model: "",
    registration: "",
    power_rating: 0,
    aircraft_class: "MULT-T",
    certifier_name: "",
    certifier_role_id: "2",
    airfield_day_pilot: 0,
    airfield_day_copilot: 0,
    airfield_night_pilot: 0,
    airfield_night_copilot: 0,
    cross_country_day_pilot: 0,
    cross_country_day_copilot: 0,
    cross_country_night_pilot: 0,
    cross_country_night_copilot: 0,
    landings: 1,
    multi_engine: 0,
    jet: 0,
    turboprop: 0,
    ag_application: 0,
    ifr_real_pilot: 0,
    ifr_real_copilot: 0,
    is_capota: false,
    folio_number: 1,
    instruction_time: 0,
    ifr_hood: 0,
    sim_instructor: 0,
    sim_student: 0
  };

  const [formData, setFormData] = useState<Partial<FlightLog>>(initialFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [anacToken, setAnacToken] = useState('');
  const [anacSession, setAnacSession] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<{ message: string, type: 'info' | 'success' | 'error' | null, debugInfo?: any }>({ message: '', type: null });
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showDebugDetail, setShowDebugDetail] = useState(false);
  const [anacLogs, setAnacLogs] = useState<AnacLog[]>([]);
  const [pendingLogs, setPendingLogs] = useState<FlightLog[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => {
    fetchAirports();
    if (logs.length === 0 && !profile) {
      refreshData();
    }

    // Escuchador global de login ANAC (por si la prop falla)
    const handleGlobalLogin = (e: any) => {
      console.log("!!! EVENTO GLOBAL RECIBIDO !!!", e.detail);
      const session = e.detail;
      const authCookie = session.cookies.find((c: any) => 
        c.name === 'Auth.ANAC.localhost' ||
        c.name.toLowerCase().includes('auth') || 
        c.name.includes('ANAC') ||
        c.name.includes('Session')
      );

      if (authCookie) {
        setAnacToken(authCookie.value);
        setAnacSession(session);
        setSyncStatus({ message: `Sesión detectada. Verificando vuelos pendientes...`, type: 'info' });
        
        // Llamamos a la comparación, NO a la sincronización automática
        setTimeout(() => {
          setShowSyncDialog(false);
          compareWithAnac(authCookie.value, session);
        }, 1000);
      }
    };

    window.addEventListener('anac-login-success', handleGlobalLogin);
    return () => window.removeEventListener('anac-login-success', handleGlobalLogin);
  }, []);

  const fetchAirports = async () => {
    try {
      // Intentar cargar desde caché interna primero
      const cached = localStorage.getItem('airports_cache');
      if (cached) {
        try {
          setDbAirports(JSON.parse(cached));
        } catch (e) {
          console.error("Error parsing cached airports", e);
        }
      }

      if (!supabase) return;
      
      const { data, error } = await supabase.from('airports').select('*');
      if (error) {
        console.error("Supabase fetch airports error:", error);
      }
      if (!error && data && data.length > 0) {
        setDbAirports(data);
        // Actualizar la base de datos interna local
        localStorage.setItem('airports_cache', JSON.stringify(data));
      } else {
        console.log("No airports found in DB or error. Using local list.", error);
      }
    } catch (err) {
      console.error("Fetch airports error:", err);
    }
  };

  // Update profile whenever the tab changes to 'perfil'
  useEffect(() => {
    if (activeTab === 'perfil') {
      console.log("Tab is perfil, refreshing data...");
      refreshData();
    }
  }, [activeTab]);

const resolveToAnac = (input: string | undefined, airports: any[]) => {
    if (!input) return '';
    const search = input.trim().toUpperCase();
    
    // Look in dbAirports (Supabase)
    const found = airports.find(a => 
      (a.anac_code && a.anac_code.toUpperCase() === search) || 
      (a.icao_code && a.icao_code.toUpperCase() === search) || 
      (a.iata_code && a.iata_code.toUpperCase() === search)
    );
    
    if (found) return found.anac_code || found.iata_code || search;
    
    // Fallback to local IATA_AIRPORTS (mostly used for initial setup/demo)
    const localFound = Object.entries(IATA_AIRPORTS).find(([icao, info]) => 
      icao.toUpperCase() === search || info.iata.toUpperCase() === search
    );
    
    if (localFound) return localFound[1].iata;

    return search;
  };

  const fetchAnacLogs = async (tokenOverride?: string, sessionOverride?: any) => {
    const tokenToUse = tokenOverride || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) return [];
    try {
      const response = await fetch('/api/get-anac-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anac_token: tokenToUse, storageState: sessionToUse, rowsPerPage: 100 })
      });
      if (response.ok) {
        const data = await response.json();
        return data.dataSource as AnacLog[];
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error("Error from server fetching ANAC logs:", errData.detail || errData.error || response.statusText);
      }
      return [];
    } catch (err) {
      console.error("Error fetching ANAC logs:", err);
      return [];
    }
  };

  const compareWithAnac = async (tokenOverride?: any, sessionOverride?: any) => {
    // Si se llama desde un onClick de React, tokenOverride será un objeto Event, no un string.
    const actualToken = typeof tokenOverride === 'string' ? tokenOverride : undefined;
    
    const tokenToUse = actualToken || anacToken;
    const sessionToUse = sessionOverride || anacSession;

    if (!tokenToUse && !sessionToUse) {
      setSyncStatus({ message: 'Primero inicia sesión en ANAC para comparar', type: 'error' });
      setShowSyncDialog(true);
      return;
    }
    setIsComparing(true);
    setSyncStatus({ message: 'Obteniendo registros de ANAC...', type: 'info' });
    const remoteLogs = await fetchAnacLogs(tokenOverride, sessionOverride);
    setAnacLogs(remoteLogs);
    if (remoteLogs.length === 0) {
      setSyncStatus({ message: 'No se pudieron obtener registros de ANAC o la lista está vacía.', type: 'error' });
      setIsComparing(false);
      return;
    }

    const missing = logs.filter(localLog => {
      try {
        const localStart = new Date(localLog.fechaHoraSalida).toISOString().substring(0, 16);
        const localEnd = new Date(localLog.fechaHoraLlegada).toISOString().substring(0, 16);
        const localMat = (localLog.matriculaAvion || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

        const exists = remoteLogs.some(remoteLog => {
          const remoteStart = (remoteLog.fechaSalida || "").substring(0, 16);
          const remoteEnd = (remoteLog.fechaLlegada || "").substring(0, 16);
          const remoteMat = (remoteLog.matricula || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
          
          const matchTime = localStart === remoteStart && localEnd === remoteEnd;
          const matchMat = localMat === remoteMat || !localMat || !remoteMat;
          
          if (matchTime && !matchMat) {
            console.log(`⏱️ Coincidencia de TIEMPO pero distinta MATRÍCULA: Local(${localMat}) vs ANAC(${remoteMat})`);
          }

          return matchTime && matchMat;
        });

        if (!exists) {
          console.log(`📌 Vuelo PENDIENTE detectado: ${localLog.origenID}->${localLog.destinoID} (${localStart}) [Mat: ${localMat}]`);
        }

        return !exists;
      } catch (e) {
        console.error("Error comparando log:", localLog, e);
        return true;
      }
    });

    console.log(`📊 Resumen: ${logs.length} locales vs ${remoteLogs.length} en ANAC. Pendientes: ${missing.length}`);

    setPendingLogs(missing);
    setIsComparing(false);
    if (missing.length === 0) {
      setSyncStatus({ message: 'Todos tus vuelos ya están en el portal de ANAC.', type: 'success' });
    } else {
      setSyncStatus({ message: `Se encontraron ${missing.length} vuelos pendientes de sincronizar.`, type: 'info' });
    }
    setShowPendingModal(true);
  };

  const handleSyncANAC = async (tokenOverride?: string, sessionOverride?: any, logsToSyncOverride?: FlightLog[]) => {
    if (!supabase || !profile) return;
    const tokenToUse = tokenOverride || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) {
      setSyncStatus({ message: 'Por favor, inicia sesión', type: 'error' });
      return;
    }
    setIsSyncing(true);
    
    // Mapeo inteligente de aeropuertos usando la base de datos local
    console.log("[DEBUG_MAPPER] dbAirports cargados en memoria:", dbAirports.length);
    const mappedLogsToSync = (logsToSyncOverride || logs).map(l => {
      const mapAirportCode = (code: string) => {
        const c = (code || "").trim().toUpperCase();
        if (!c) return c;
        
        // Buscar coincidencia en la base de datos de aeropuertos (por IATA, OACI o Local)
        const airport = dbAirports.find(a => 
          (a.iata_code && a.iata_code.toUpperCase() === c) || 
          (a.oaci_code && a.oaci_code.toUpperCase() === c) || 
          (a.local_code && a.local_code.toUpperCase() === c) ||
          (a.key_code && a.key_code.toUpperCase() === c) ||
          (a.code && a.code.toUpperCase() === c) // fallback for generic 'code' column
        );
        
        console.log(`[DEBUG_MAPPER] Mapeando '${c}' -> Encontrado en DB:`, !!airport, airport ? `(key_code: ${airport.key_code})` : '');

        // Si encontramos el aeropuerto y tiene un key_code definido, lo usamos.
        if (airport && airport.key_code) {
          return airport.key_code;
        }
        
        // Fallback genérico por seguridad (mantiene el parche anterior)
        if (c === "AEP" || c === "SABE") return "AER";
        return c;
      };

      return {
        ...l,
        potencia: Number(l.potencia || 0),
        origenID: mapAirportCode(l.origenID || (l as any).origin_ad),
        destinoID: mapAirportCode(l.destinoID || (l as any).destination_ad)
      };
    });

    try {
      const response = await fetch('/api/sync-anac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, anac_token: tokenToUse, storageState: sessionToUse, logs_to_sync: mappedLogsToSync })
      });
      const data = await response.json();
      if (response.ok) setSyncStatus({ message: 'Sincronización finalizada.', type: 'success' });
      else setSyncStatus({ message: `Error: ${data.error}`, type: 'error' });
    } catch (e) {
      setSyncStatus({ message: 'Error de conexión.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const saveLog = async () => {
    if (!supabase) return;

    // Validation: Cumulative times cannot exceed Block Duration
    const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
    const currentSum = (
      Number(formData.airfield_day_pilot || 0) +
      Number(formData.airfield_day_copilot || 0) +
      Number(formData.airfield_night_pilot || 0) +
      Number(formData.airfield_night_copilot || 0) +
      Number(formData.cross_country_day_pilot || 0) +
      Number(formData.cross_country_day_copilot || 0) +
      Number(formData.cross_country_night_pilot || 0) +
      Number(formData.cross_country_night_copilot || 0)
    );

    if (currentSum > (totalRef + 0.01)) {
      alert(`La discriminación de horas (${currentSum.toFixed(1)} hs) excede el total del vuelo (${totalRef.toFixed(1)} hs). Por favor corrija los datos.`);
      return;
    }

    // Calculate Flight Type (Local vs Travesia vs Simulador)
    let flight_type_id = "2"; // Default for Travesia
    const hasSimHours = Number(formData.sim_instructor || 0) > 0 || Number(formData.sim_student || 0) > 0;
    
    if (hasSimHours) {
      flight_type_id = "3"; // Simulador
    } else {
      const resolvedOriginCheck = resolveToAnac(formData.origin_ad, dbAirports);
      const resolvedDestCheck = resolveToAnac(formData.destination_ad, dbAirports);
      if (resolvedOriginCheck && resolvedDestCheck && resolvedOriginCheck === resolvedDestCheck) {
        flight_type_id = "1"; // Local
      }
    }

    // Calculate Cargo (Pilot vs Copilot)
    let determined_cargo_id = "1"; // Default to Pilot
    const hasPilotHours = (
      Number(formData.airfield_day_pilot || 0) > 0 ||
      Number(formData.airfield_night_pilot || 0) > 0 ||
      Number(formData.cross_country_day_pilot || 0) > 0 ||
      Number(formData.cross_country_night_pilot || 0) > 0 ||
      Number(formData.sim_instructor || 0) > 0 ||
      Number(formData.ifr_real_pilot || 0) > 0 ||
      Number(formData.ifr_hood || 0) > 0
    );
    const hasCopilotHours = (
      Number(formData.airfield_day_copilot || 0) > 0 ||
      Number(formData.airfield_night_copilot || 0) > 0 ||
      Number(formData.cross_country_day_copilot || 0) > 0 ||
      Number(formData.cross_country_night_copilot || 0) > 0 ||
      Number(formData.ifr_real_copilot || 0) > 0
    );

    if (hasCopilotHours && !hasPilotHours) {
      determined_cargo_id = "2"; // Copilot
    } else {
      determined_cargo_id = "1"; // Pilot (Default)
    }

    // Build ISO timestamps (using GMT/UTC for consistency)
    const buildISO = (y: number, mon: number, d: number, timeStr: string, isNextDay: boolean = false) => {
      const [h, m] = timeStr.split(':').map(Number);
      const date = new Date(Date.UTC(y, mon - 1, d, h || 0, m || 0));
      if (isNextDay) {
        date.setUTCDate(date.getUTCDate() + 1);
      }
      return date.toISOString();
    };

    const user_id = (await supabase.auth.getUser()).data.user?.id;
    if (!user_id) {
      alert("No se encontró sesión de usuario.");
      return;
    }

    // Map current formData to the STRICT payload format
    const resolvedOrigin = resolveToAnac(formData.origin_ad, dbAirports);
    const resolvedDest = resolveToAnac(formData.destination_ad, dbAirports);

    const crossesMidnight = (formData.arrival_time_utc || "") < (formData.departure_time_utc || "");

    const finalData: any = {
      user_id: user_id,
      fechaHoraSalida: buildISO(formData.year!, formData.month!, formData.day!, formData.departure_time_utc!),
      fechaHoraLlegada: buildISO(formData.year!, formData.month!, formData.day!, formData.arrival_time_utc!, crossesMidnight),
      origenID: resolvedOrigin,
      destinoID: resolvedDest,
      finalidadID: formData.flight_purpose || '',
      clase: formData.aircraft_class || '',
      matriculaAvion: formData.registration || '',
      Marca_Modelo: formData.aircraft_model || '',
      potencia: Number(formData.power_rating || 0),
      aterrizajes: Number(formData.landings || 0),
      horasDia: (
        Number(formData.airfield_day_pilot || 0) + 
        Number(formData.airfield_day_copilot || 0) + 
        Number(formData.cross_country_day_pilot || 0) + 
        Number(formData.cross_country_day_copilot || 0)
      ).toString(),
      horasNoche: (
        Number(formData.airfield_night_pilot || 0) + 
        Number(formData.airfield_night_copilot || 0) + 
        Number(formData.cross_country_night_pilot || 0) + 
        Number(formData.cross_country_night_copilot || 0)
      ).toString(),
      tipoVueloID: flight_type_id,
      cargoID: determined_cargo_id,
      autoridadCertificanteID: formData.certifier_role_id || '2',
      observaciones: formData.certifier_name || '',
      Discriminaciones: [],
      multi_engine: Number(formData.multi_engine || 0),
      jet: Number(formData.jet || 0),
      turboprop: Number(formData.turboprop || 0),
      ifr_instrument: Number(formData.ifr_real_pilot || 0) + Number(formData.ifr_real_copilot || 0) + Number(formData.ifr_hood || 0),
      instruccion: Number(formData.instruction_time || 0),
      airfield_day_pilot: Number(formData.airfield_day_pilot || 0),
      airfield_day_copilot: Number(formData.airfield_day_copilot || 0),
      airfield_night_pilot: Number(formData.airfield_night_pilot || 0),
      airfield_night_copilot: Number(formData.airfield_night_copilot || 0),
      cross_country_day_pilot: Number(formData.cross_country_day_pilot || 0),
      cross_country_day_copilot: Number(formData.cross_country_day_copilot || 0),
      cross_country_night_pilot: Number(formData.cross_country_night_pilot || 0),
      cross_country_night_copilot: Number(formData.cross_country_night_copilot || 0),
      ifr_real_pilot: Number(formData.ifr_real_pilot || 0),
      ifr_real_copilot: Number(formData.ifr_real_copilot || 0),
      ifr_hood: Number(formData.ifr_hood || 0),
      sim_instructor: Number(formData.sim_instructor || 0),
      sim_student: Number(formData.sim_student || 0),
      ag_application: Number(formData.ag_application || 0),
      folio_number: formData.folio_number || 1,
      is_capota: formData.is_capota || false,
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('flight_logs')
          .update(finalData)
          .eq('id', editingId);
        
        if (error) throw error;
        alert("Registro actualizado correctamente");
      } else {
        const { error } = await supabase
          .from('flight_logs')
          .insert([finalData]);
        
        if (error) throw error;
      }
      
      setFormData({
        ...initialFormState,
        aircraft_model: formData.aircraft_model,
        power_rating: formData.power_rating,
        aircraft_class: formData.aircraft_class,
        certifier_name: formData.certifier_name,
        flight_purpose: formData.flight_purpose,
      });
      setEditingId(null);
      await refreshData();
      setActiveTab('history');
    } catch (error: any) {
      console.error("Error saving log:", error);
      alert("Error al guardar el registro: " + (error.message || error));
    }
  };

  const updateProfile = async () => {
    if (!supabase || !profile) return;
    setIsSavingProfile(true);
    try {
      // Get fresh user ID to be 100% sure we are saving to the right ID
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) throw new Error("No hay sesión de usuario activa");

      const { ...toSave } = profile;
      
      // Calculate grand total hours before saving (Initial totals + Logged hours)
      const logsSum = logs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0');
        const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_day_copilot) || 0) +
          (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).airfield_night_copilot) || 0) +
          (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_day_copilot) || 0) +
          (Number((log as any).cross_country_night_pilot) || 0) + (Number((log as any).cross_country_night_copilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);

      const initialTotal = (
        Number(profile.total_airfield_day_pilot || 0) +
        Number(profile.total_airfield_day_copilot || 0) +
        Number(profile.total_airfield_night_pilot || 0) +
        Number(profile.total_airfield_night_copilot || 0) +
        Number(profile.total_cross_country_day_pilot || 0) +
        Number(profile.total_cross_country_day_copilot || 0) +
        Number(profile.total_cross_country_night_pilot || 0) +
        Number(profile.total_cross_country_night_copilot || 0)
      );

      const grandTotal = initialTotal + logsSum;

      const dataToUpsert = {
        ...toSave,
        id: authUser.id, // Primary key
        initial_total_hours: parseFloat(initialTotal.toFixed(1)),
        grand_total_hours: parseFloat(grandTotal.toFixed(1))
      };

      console.log("Upserting profile data to profiles:", dataToUpsert);

      const { error } = await supabase
        .from('profiles')
        .upsert(dataToUpsert, { onConflict: 'id' });
      
      if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
      }
      
      // Refresh after saving
      console.log("Profile saved, refreshing data...");
      await refreshData();
      alert("Perfil actualizado correctamente");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert(`Error al actualizar el perfil: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const syncProfileTotal = async (currentLogs: FlightLog[]) => {
    if (!supabase || !profile) return;
    try {
      const logsSum = currentLogs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0');
        const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_day_copilot) || 0) +
          (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).airfield_night_copilot) || 0) +
          (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_day_copilot) || 0) +
          (Number((log as any).cross_country_night_pilot) || 0) + (Number((log as any).cross_country_night_copilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);

      const initialTotal = (
        Number(profile.total_airfield_day_pilot || 0) +
        Number(profile.total_airfield_day_copilot || 0) +
        Number(profile.total_airfield_night_pilot || 0) +
        Number(profile.total_airfield_night_copilot || 0) +
        Number(profile.total_cross_country_day_pilot || 0) +
        Number(profile.total_cross_country_day_copilot || 0) +
        Number(profile.total_cross_country_night_pilot || 0) +
        Number(profile.total_cross_country_night_copilot || 0)
      );

      const grandTotal = initialTotal + logsSum;

      await supabase
        .from('profiles')
        .update({ 
          initial_total_hours: parseFloat(initialTotal.toFixed(1)),
          grand_total_hours: parseFloat(grandTotal.toFixed(1)) 
        })
        .eq('id', profile.id);
      
      // Update local profile state as well to avoid extra refresh
      setProfile(prev => prev ? { 
        ...prev, 
        initial_total_hours: parseFloat(initialTotal.toFixed(1)),
        grand_total_hours: parseFloat(grandTotal.toFixed(1)) 
      } : null);
    } catch (error) {
      console.error("Error syncing profile total:", error);
    }
  };

  const handleProfileFieldChange = (field: keyof Profile, value: any) => {
    setProfile(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
      
      // Recalculate totals locally for immediate feedback
      const logsSum = logs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0');
        const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_day_copilot) || 0) +
          (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).airfield_night_copilot) || 0) +
          (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_day_copilot) || 0) +
          (Number((log as any).cross_country_night_pilot) || 0) + (Number((log as any).cross_country_night_copilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);

      const initialTotal = 
        Number(updated.total_airfield_day_pilot || 0) + Number(updated.total_airfield_day_copilot || 0) +
        Number(updated.total_airfield_night_pilot || 0) + Number(updated.total_airfield_night_copilot || 0) +
        Number(updated.total_cross_country_day_pilot || 0) + Number(updated.total_cross_country_day_copilot || 0) +
        Number(updated.total_cross_country_night_pilot || 0) + Number(updated.total_cross_country_night_copilot || 0);

      return { 
        ...updated, 
        initial_total_hours: parseFloat(initialTotal.toFixed(1)),
        grand_total_hours: parseFloat((logsSum + initialTotal).toFixed(1)) 
      };
    });
  };

  const calculateDecimalDuration = (dep: string | undefined, arr: string | undefined) => {
    if (!dep || !arr) return null;
    
    try {
      const [depH, depM] = dep.split(':').map(Number);
      const [arrH, arrM] = arr.split(':').map(Number);
      
      let totalMinutes = (arrH * 60 + arrM) - (depH * 60 + depM);
      
      // Handle midnight crossing
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      let decimalMinutes = 0;
      if (minutes >= 3 && minutes <= 8) decimalMinutes = 0.1;
      else if (minutes >= 9 && minutes <= 14) decimalMinutes = 0.2;
      else if (minutes >= 15 && minutes <= 20) decimalMinutes = 0.3;
      else if (minutes >= 21 && minutes <= 26) decimalMinutes = 0.4;
      else if (minutes >= 27 && minutes <= 33) decimalMinutes = 0.5;
      else if (minutes >= 34 && minutes <= 39) decimalMinutes = 0.6;
      else if (minutes >= 40 && minutes <= 45) decimalMinutes = 0.7;
      else if (minutes >= 46 && minutes <= 51) decimalMinutes = 0.8;
      else if (minutes >= 52 && minutes <= 57) decimalMinutes = 0.9;
      else if (minutes >= 58 && minutes <= 60) decimalMinutes = 1.0;
      
      return (hours + decimalMinutes).toFixed(1);
    } catch (e) {
      return null;
    }
  };

  const deleteLog = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('flight_logs')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      const updatedLogs = logs.filter(l => l.id !== id);
      setLogs(updatedLogs);
      await syncProfileTotal(updatedLogs);
    } catch (error) {
      console.error("Error deleting log:", error);
    }
  };

  const startEditing = (log: FlightLog) => {
    const depDate = new Date(log.fechaHoraSalida);
    setFormData({ 
      ...log,
      year: depDate.getUTCFullYear(),
      month: depDate.getUTCMonth() + 1,
      day: depDate.getUTCDate(),
      departure_time_utc: log.fechaHoraSalida.slice(11, 16),
      arrival_time_utc: log.fechaHoraLlegada.slice(11, 16),
      origin_ad: log.origenID,
      destination_ad: log.destinoID,
      flight_purpose: log.finalidadID,
      registration: log.matriculaAvion,
      aircraft_model: log.Marca_Modelo || '',
      power_rating: log.potencia,
      aircraft_class: log.clase,
      landings: log.aterrizajes,
      airfield_day_pilot: Number(log.airfield_day_pilot || 0),
      airfield_day_copilot: Number(log.airfield_day_copilot || 0),
      airfield_night_pilot: Number(log.airfield_night_pilot || 0),
      airfield_night_copilot: Number(log.airfield_night_copilot || 0),
      cross_country_day_pilot: Number(log.cross_country_day_pilot || 0),
      cross_country_day_copilot: Number(log.cross_country_day_copilot || 0),
      cross_country_night_pilot: Number(log.cross_country_night_pilot || 0),
      cross_country_night_copilot: Number(log.cross_country_night_copilot || 0),
      ifr_real_pilot: Number(log.ifr_real_pilot || 0),
      ifr_real_copilot: Number(log.ifr_real_copilot || 0),
      ifr_hood: Number(log.ifr_hood || 0),
      instruction_time: Number(log.instruccion || 0),
      sim_instructor: Number(log.sim_instructor || 0),
      sim_student: Number(log.sim_student || 0),
      multi_engine: Number(log.multi_engine || 0),
      jet: Number(log.jet || 0),
      turboprop: Number(log.turboprop || 0),
      ag_application: Number(log.ag_application || 0),
      is_capota: log.is_capota || false,
      folio_number: log.folio_number || 1,
      certifier_name: log.observaciones,
      certifier_role_id: log.autoridadCertificanteID
    });
    setEditingId(log.id);
    setActiveTab('registrar');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(initialFormState);
  };

  const generateSampleData = async () => {
    if (!supabase) return;
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const sampleLog: Partial<FlightLog> = {
      id: crypto.randomUUID(),
      user_id: user.id,
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
      departure_time_utc: "10:00",
      arrival_time_utc: "12:30",
      origin_ad: "SABE",
      destination_ad: "SAEZ",
      flight_purpose: "VP",
      aircraft_model: "Boeing 737-800",
      registration: "LV-HKW",
      power_rating: 3000,
      aircraft_class: "MULT-T",
      airfield_day_pilot: 0.2,
      airfield_night_pilot: 0.1,
      cross_country_day_pilot: 2.2,
      cross_country_night_pilot: 0,
      jet: 2.5,
      ifr_real_pilot: 0.5,
      landings: 1,
      flight_type: "TRAVESIA",
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('flight_logs').insert([sampleLog]);
      if (error) throw error;
      setLogs([sampleLog as FlightLog, ...logs]);
      alert("Registro de ejemplo generado con éxito");
    } catch (error) {
      console.error("Error generating sample data:", error);
    }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
  };

  const exportToExcel = async () => {
    if (logs.length === 0) {
      alert("No hay registros para exportar");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      
      const sortedLogs = [...logs].sort((a, b) => {
        const dateA = new Date(a.year, a.month - 1, a.day).getTime();
        const dateB = new Date(b.year, b.month - 1, b.day).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });

      const PAGE_SIZE = 15;
      const pages = [];
      for (let i = 0; i < sortedLogs.length; i += PAGE_SIZE) {
        pages.push(sortedLogs.slice(i, i + PAGE_SIZE));
      }

      const startFolio = profile?.initial_folio_number || 1;

      const initialTotals = {
        airfield_day_pilot: profile?.total_airfield_day_pilot || 0,
        airfield_day_copilot: profile?.total_airfield_day_copilot || 0,
        airfield_night_pilot: profile?.total_airfield_night_pilot || 0,
        airfield_night_copilot: profile?.total_airfield_night_copilot || 0,
        cross_country_day_pilot: profile?.total_cross_country_day_pilot || 0,
        cross_country_day_copilot: profile?.total_cross_country_day_copilot || 0,
        cross_country_night_pilot: profile?.total_cross_country_night_pilot || 0,
        cross_country_night_copilot: profile?.total_cross_country_night_copilot || 0,
        landings: profile?.total_landings || 0,
        instruction_time: profile?.total_instruction_time || 0,
        multi_engine: profile?.total_multi_engine || 0,
        jet: profile?.total_jet || 0,
        turboprop: profile?.total_turboprop || 0,
        ag_application: profile?.total_ag_application || 0,
        ifr_real_pilot: profile?.total_ifr_real_pilot || 0,
        ifr_real_copilot: profile?.total_ifr_real_copilot || 0,
        ifr_hood: profile?.total_ifr_hood || 0,
        sim_instructor: profile?.total_sim_instructor || 0,
        sim_student: profile?.total_sim_student || 0
      };

      const getTotalsUpToPage = (pageIdx: number) => {
        const t = { ...initialTotals };
        for (let p = 0; p < pageIdx; p++) {
          pages[p].forEach(log => {
            const isCargo1 = log.cargoID === "1";
            const hDia = parseFloat(log.horasDia || '0');
            const hNoche = parseFloat(log.horasNoche || '0');
            const isLocal = log.tipoVueloID === "1";
            
            if (isLocal) {
              if (isCargo1) {
                t.airfield_day_pilot += hDia;
                t.airfield_night_pilot += hNoche;
              } else {
                t.airfield_day_copilot += hDia;
                t.airfield_night_copilot += hNoche;
              }
            } else {
              if (isCargo1) {
                t.cross_country_day_pilot += hDia;
                t.cross_country_night_pilot += hNoche;
              } else {
                t.cross_country_day_copilot += hDia;
                t.cross_country_night_copilot += hNoche;
              }
            }

            t.landings += (log.aterrizajes || 0);
            t.multi_engine += log.clase?.includes('MULT') ? (hDia + hNoche) : 0;
            // Additional mappings can be added here
          });
        }
        return t;
      };

      const thinBorder = { style: 'thin' as const };
      const centerMiddle = { vertical: 'middle' as const, horizontal: 'center' as const, shrinkToFit: true, wrapText: false };

      for (let i = 0; i < pages.length; i++) {
        const folioNum = startFolio + i;
        const folioLogs = pages[i];
        const sheet = workbook.addWorksheet(`FOLIO ${folioNum}`)        // Set column widths to match layout with precise pixel requests
        // Pixels to ExcelJS Width approx: (px - 5) / 7
        // G (7): 107px -> 14.57
        // H, I, J (8, 9, 10): 86px -> 11.57
        sheet.columns = [
          { width: 5 }, { width: 5 },     // 1: DIA, 2: MES
          { width: 9 },                   // 3: SALIDA UTC
          { width: 14 },                  // 4: DESDE / HASTA
          { width: 9 },                   // 5: LLEGADA UTC
          { width: 7 },                   // 6: FINALIDAD
          { width: 14.57 },               // 7: MARCA / MODELO (G)
          { width: 11.57 },               // 8: MATRICULA (H)
          { width: 11.57 },               // 9: POTENCIA (I)
          { width: 11.57 },               // 10: CLASE (J)
          { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, 
          { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, 
          { width: 5.5 },                 // 19: ATERR (S)
          { width: 8 },                   // 20: T 
          { width: 8 },                   // 21: U 
          { width: 8 },                   // 22: V 
          { width: 8 },                   // 23: W 
          { width: 8 },                   // 24: X 
          { width: 5.5 }, { width: 5.5 }, { width: 5.5 }, 
          { width: 10 },                  // 28: AB 
          { width: 10 },                  // 29: AC 
          { width: 25 }                   // 30: AD 
        ];

        // Set default row height to 24 pixels (18 points)
        sheet.properties.defaultRowHeight = 18;

        // ADD 3 BLANK ROWS
        sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);

        // ROW 4: Profile Headers
        const profileRow = sheet.getRow(4);
        profileRow.getCell(1).value = `APELLIDO Y NOMBRE: ${profile?.last_name || ''}, ${profile?.first_name || ''}`;
        profileRow.getCell(8).value = "LICENCIA: " + (profile?.license || '');
        profileRow.getCell(11).value = "Nº " + (profile?.dni || '');
        profileRow.getCell(16).value = "LEGAJO Nº " + (profile?.legajo || '');
        profileRow.getCell(24).value = "FOLIO " + folioNum;

        const r4 = 4;
        sheet.mergeCells(r4, 1, r4, 7);
        sheet.mergeCells(r4, 8, r4, 10);
        sheet.mergeCells(r4, 11, r4, 15);
        sheet.mergeCells(r4, 16, r4, 23);
        sheet.mergeCells(r4, 24, r4, 30);
        profileRow.font = { bold: true, size: 9, name: 'Arial' };
        sheet.getCell(r4, 24).alignment = { horizontal: 'right', vertical: 'middle' };

        // ROW 5, 6, 7, 8: Headers definition
        const r5 = sheet.addRow([]).number;
        const r6 = sheet.addRow([]).number;
        const r7 = sheet.addRow([]).number;
        const r8 = sheet.addRow([]).number;

        const getC = (r: number, c: number) => sheet.getCell(r, c);

        // Level 1 titles & full merges
        getC(r5, 1).value = `AÑO\n${folioLogs[0]?.year || 2026}`;
        sheet.mergeCells(r5, 1, r7, 2);
        
        getC(r5, 3).value = "ITINERARIO";
        sheet.mergeCells(r5, 3, r5, 5);

        getC(r5, 6).value = "FINALIDAD DEL VUELO";
        sheet.mergeCells(r5, 6, r8, 6);

        getC(r5, 7).value = "AERONAVES UTILIZADAS";
        sheet.mergeCells(r5, 7, r5, 10);

        getC(r5, 11).value = "TIEMPOS DE VUELO";
        sheet.mergeCells(r5, 11, r5, 18);

        getC(r5, 19).value = "ATERRI\nZAJES";
        sheet.mergeCells(r5, 19, r8, 19);

        getC(r5, 20).value = "DISCRIMINACION DE TIEMPOS DE VUELO";
        sheet.mergeCells(r5, 20, r5, 24);

        getC(r5, 25).value = "VUELO POR INSTRUMENTOS";
        sheet.mergeCells(r5, 25, r5, 27);

        getC(r5, 28).value = "ADIESTRADOR\nTERRESTRE /\nSIMULADOR";
        sheet.mergeCells(r5, 28, r5, 29);

        getC(r5, 30).value = "CERTIFICACIONES";
        sheet.mergeCells(r5, 30, r8, 30);

        // Level 2 Subheaders
        getC(r8, 1).value = "DIA";
        getC(r8, 2).value = "MES";

        getC(r6, 3).value = "HORA\nDE\nSALIDA\nUTC";
        sheet.mergeCells(r6, 3, r8, 3);
        getC(r6, 4).value = "DESDE\nHASTA";
        sheet.mergeCells(r6, 4, r8, 4);
        getC(r6, 5).value = "HORA\nDE\nLLEGADA\nUTC";
        sheet.mergeCells(r6, 5, r8, 5);

        getC(r6, 7).value = "MARCA /\nMODELO";
        sheet.mergeCells(r6, 7, r8, 7);
        getC(r6, 8).value = "MATRICUL\nA";
        sheet.mergeCells(r6, 8, r8, 8);
        getC(r6, 9).value = "POTENC\nIA";
        sheet.mergeCells(r6, 9, r8, 9);
        getC(r6, 10).value = "CLASE";
        sheet.mergeCells(r6, 10, r8, 10);

        getC(r6, 11).value = "SOBRE AERÓDROMO";
        sheet.mergeCells(r6, 11, r6, 14);
        getC(r6, 15).value = "TRAVESIA";
        sheet.mergeCells(r6, 15, r6, 18);

        getC(r6, 20).value = "INSTRUCT\nDE VUELO";
        sheet.mergeCells(r6, 20, r8, 20);
        getC(r6, 21).value = "MULTI\nMOTOR";
        sheet.mergeCells(r6, 21, r8, 21);
        getC(r6, 22).value = "REACTOR";
        sheet.mergeCells(r6, 22, r8, 22);
        getC(r6, 23).value = "TURBO\nHELICE";
        sheet.mergeCells(r6, 23, r8, 23);
        getC(r6, 24).value = "AERO\nAPLICA-\nDOR";
        sheet.mergeCells(r6, 24, r8, 24);

        getC(r6, 25).value = "REAL";
        sheet.mergeCells(r6, 25, r7, 26);
        getC(r6, 27).value = "CAPOTA";
        sheet.mergeCells(r6, 27, r8, 27);

        getC(r6, 28).value = "INSTRUCTOR";
        sheet.mergeCells(r6, 28, r8, 28);
        getC(r6, 29).value = "PILOTO EN\nINSTRUCCIÓN";
        sheet.mergeCells(r6, 29, r8, 29);

        // Level 3 Times Sub-divisions
        getC(r7, 11).value = "DE DIA"; sheet.mergeCells(r7, 11, r7, 12);
        getC(r7, 13).value = "DE NOCHE"; sheet.mergeCells(r7, 13, r7, 14);
        getC(r7, 15).value = "DE DIA"; sheet.mergeCells(r7, 15, r7, 16);
        getC(r7, 17).value = "DE NOCHE"; sheet.mergeCells(r7, 17, r7, 18);

        // Level 4 Roles
        const roleCols = [11, 13, 15, 17];
        roleCols.forEach(c => {
          getC(r8, c).value = "Piloto";
          getC(r8, c + 1).value = "Copiloto";
        });
        getC(r8, 25).value = "PILOTO";
        getC(r8, 26).value = "COPILOTO";

        const thinBorder = { style: 'thin' as const };
        const thickBorder = { style: 'medium' as const };

        for (let r = r5; r <= r8; r++) {
          sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (r === r5) cell.border.top = thickBorder;
            if (r === r8) cell.border.bottom = thickBorder;
            if (colNumber === 1) cell.border.left = thickBorder;
            if (colNumber === 30) cell.border.right = thickBorder;
            
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true, shrinkToFit: true };
            // Ensure labels without explicit line breaks stay in one line
            if (typeof cell.value === 'string' && !cell.value.includes('\n')) {
              cell.alignment.wrapText = false;
            }
            
            cell.font = { bold: true, size: 6.5, name: 'Arial' };
            if (colNumber === 6) {
              cell.alignment.textRotation = 90;
              cell.alignment.wrapText = true;
            }
          });
        }

        // Fix corners for headers
        getC(r5, 1).border = { top: thickBorder, left: thickBorder, bottom: thinBorder, right: thinBorder };
        getC(r5, 30).border = { top: thickBorder, left: thinBorder, bottom: thinBorder, right: thickBorder };
        getC(r8, 1).border = { top: thinBorder, left: thickBorder, bottom: thickBorder, right: thinBorder };
        getC(r8, 30).border = { top: thinBorder, left: thinBorder, bottom: thickBorder, right: thickBorder };

        // Totales Anterior
        const ant = getTotalsUpToPage(i);
        const antRow = sheet.addRow([
          "", "", "", "", "", "", "TOTALES PAGINA ANTERIOR    >", "", "", "", 
          ant.airfield_day_pilot.toFixed(1), ant.airfield_day_copilot.toFixed(1),
          ant.airfield_night_pilot.toFixed(1), ant.airfield_night_copilot.toFixed(1),
          ant.cross_country_day_pilot.toFixed(1), ant.cross_country_day_copilot.toFixed(1),
          ant.cross_country_night_pilot.toFixed(1), ant.cross_country_night_copilot.toFixed(1),
          ant.landings, ant.instruction_time.toFixed(1),
          ant.multi_engine.toFixed(1), ant.jet.toFixed(1), ant.turboprop.toFixed(1), ant.ag_application.toFixed(1),
          ant.ifr_real_pilot.toFixed(1), ant.ifr_real_copilot.toFixed(1), ant.ifr_hood.toFixed(1),
          ant.sim_instructor.toFixed(1), ant.sim_student.toFixed(1), "Total horas de vuelo de la pagina anterior   }"
        ]);
        sheet.mergeCells(antRow.number, 1, antRow.number, 6);
        sheet.mergeCells(antRow.number, 7, antRow.number, 10);
        antRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = { top: thickBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
          if (colNumber === 30) {
            cell.font = { size: 6.5, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false, shrinkToFit: true };
            cell.border = { top: thickBorder, left: thinBorder, bottom: thinBorder, right: thickBorder };
          } else if (colNumber === 7) {
            cell.font = { bold: true, size: 6.5, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false, shrinkToFit: true };
          } else {
            cell.font = { bold: true, size: 6.5, name: 'Arial' };
            cell.alignment = centerMiddle;
          }
          if (colNumber === 1) {
            cell.border = { top: thickBorder, left: thickBorder, bottom: thinBorder, right: thinBorder };
          }
        });

        // Data Rows
        folioLogs.forEach((log, idx) => {
          const depDate = new Date(log.fechaHoraSalida);
          const isLocal = log.tipoVueloID === "1";
          const hDia = parseFloat(log.horasDia || '0');
          const hNoche = parseFloat(log.horasNoche || '0');
          
          const formatTime = (isoStr: string) => {
            if (!isoStr) return "";
            try {
              const d = new Date(isoStr);
              const h = String(d.getUTCHours()).padStart(2, '0');
              const m = String(d.getUTCMinutes()).padStart(2, '0');
              return `${h}:${m}`;
            } catch (e) {
              return isoStr.slice(11, 16);
            }
          };

          const finalidadLabel = FLIGHT_PURPOSES.find(f => f.key === log.finalidadID)?.sigla || log.finalidadID;

          const lRow = sheet.addRow([
            depDate.getUTCDate(), depDate.getUTCMonth() + 1, formatTime(log.fechaHoraSalida), `${log.origenID} - ${log.destinoID}`, formatTime(log.fechaHoraLlegada),
            finalidadLabel, log.Marca_Modelo || "", log.matriculaAvion, log.potencia || "", log.clase || "",
            isLocal ? hDia : "", "", isLocal ? hNoche : "", "",
            !isLocal ? hDia : "", "", !isLocal ? hNoche : "", "",
            log.aterrizajes || "", "", "", "", "", "",
            "", "", "",
            "", "", ""
          ]);
          lRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (colNumber === 1) cell.border.left = thickBorder;
            if (colNumber === 30) cell.border.right = thickBorder;
            cell.alignment = { ...centerMiddle, wrapText: false };
            cell.font = { size: 7.5, name: 'Arial' };
            if (colNumber === 30 && idx === 0) {
              cell.value = "CERTIFICO ACTIVIDAD SEGUN REGISTROS";
              cell.font = { size: 6.5, bold: true, name: 'Arial' };
            }
          });
        });

        // Padding
        for (let k = 0; k < PAGE_SIZE - folioLogs.length; k++) {
          const empty = sheet.addRow(new Array(30).fill(""));
          empty.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (colNumber === 1) cell.border.left = thickBorder;
            if (colNumber === 30) cell.border.right = thickBorder;
          });
        }

        // Totales Siguiente
        const sig = getTotalsUpToPage(i + 1);
        const sigRow = sheet.addRow([
          "", "", "TOTALES A LA PAGINA SIGUIENTE     >", "", "", "", "", "", "", "", 
          sig.airfield_day_pilot.toFixed(1), sig.airfield_day_copilot.toFixed(1),
          sig.airfield_night_pilot.toFixed(1), sig.airfield_night_copilot.toFixed(1),
          sig.cross_country_day_pilot.toFixed(1), sig.cross_country_day_copilot.toFixed(1),
          sig.cross_country_night_pilot.toFixed(1), sig.cross_country_night_copilot.toFixed(1),
          sig.landings, sig.instruction_time.toFixed(1),
          sig.multi_engine.toFixed(1), sig.jet.toFixed(1), sig.turboprop.toFixed(1), sig.ag_application.toFixed(1),
          sig.ifr_real_pilot.toFixed(1), sig.ifr_real_copilot.toFixed(1), sig.ifr_hood.toFixed(1),
          sig.sim_instructor.toFixed(1), sig.sim_student.toFixed(1), "Total horas de vuelo de la pagina siguiente   }"
        ]);
        sheet.mergeCells(sigRow.number, 1, sigRow.number, 2);
        sheet.mergeCells(sigRow.number, 3, sigRow.number, 10);
        sigRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = { top: thinBorder, left: thinBorder, bottom: thickBorder, right: thinBorder };
          if (colNumber === 30) {
            cell.font = { size: 6.5, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false, shrinkToFit: true };
            cell.border.right = thickBorder;
          } else if (colNumber === 3) {
            cell.font = { bold: true, size: 6.5, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false, shrinkToFit: true };
          } else {
            cell.font = { bold: true, size: 6.5, name: 'Arial' };
            cell.alignment = centerMiddle;
          }
          if (colNumber === 1) {
            cell.border.left = thickBorder;
          }
        });

        // Legal Footer
        sheet.addRow([]);
        const footer = sheet.addRow(["HOJA DE LIBRO DE VUELO DE PILOTOS RESOLUCION ANAC 290/2012 del 15/05/2012 - MEDIDAS 35.5 cm X 16.5 cm"]);
        sheet.mergeCells(footer.number, 1, footer.number, 15);
        footer.font = { size: 6.5, name: 'Arial' };
        
        const noteRow = sheet.addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Los totales de estas columnas no deben sumarse a\nlos totales generales ya que estan comprendidos en\nla columna TIEMPOS DE VUELO"]);
        sheet.mergeCells(noteRow.number, 20, noteRow.number, 27);
        noteRow.height = 30;
        noteRow.getCell(20).font = { size: 6, name: 'Arial' };
        noteRow.getCell(20).alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        
        const signRow = sheet.addRow(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "FIRMA DEL TITULAR"]);
        sheet.mergeCells(signRow.number, 26, signRow.number, 29);
        const signCell = signRow.getCell(26);
        signCell.alignment = { horizontal: 'center' };
        signCell.border = { top: { style: 'thin' } };
        signRow.font = { size: 8, name: 'Arial' };
        signRow.height = 25;

        sheet.pageSetup.orientation = 'landscape';
        sheet.pageSetup.paperSize = 5;
        sheet.pageSetup.fitToPage = true;
        sheet.pageSetup.fitToWidth = 1;
        sheet.pageSetup.fitToHeight = 0;
      }

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Libro_Vuelo_${profile?.last_name || 'Piloto'}_Folio_${startFolio}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Error al generar el archivo Excel");
    }
  };



  // Stats calculation
  const totalDayHoursLogs = logs.reduce((acc, log) => {
    const newVal = parseFloat(log.horasDia || '0');
    // If new value is 0 or missing, check old fields for backward compatibility
    const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).cross_country_day_pilot) || 0);
    return acc + (newVal > 0 ? newVal : oldVal);
  }, 0);

  const totalNightHoursLogs = logs.reduce((acc, log) => {
    const newVal = parseFloat(log.horasNoche || '0');
    const oldVal = (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).cross_country_night_pilot) || 0);
    return acc + (newVal > 0 ? newVal : oldVal);
  }, 0);
  
  const initialDayHours = (profile?.total_airfield_day_pilot || 0) + (profile?.total_cross_country_day_pilot || 0);
  const initialNightHours = (profile?.total_airfield_night_pilot || 0) + (profile?.total_cross_country_night_pilot || 0);
  
  const totalDayHours = (totalDayHoursLogs + initialDayHours).toFixed(1);
  const totalNightHours = (totalNightHoursLogs + initialNightHours).toFixed(1);
  const totalIfrHours = logs.reduce((acc, log) => acc + (Number(log.Discriminaciones?.find(d => d.tipoDiscriminacionID === 15)?.hora || 0)), 0);

  const chartData = React.useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const data = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      
      const monthLogs = logs.filter(log => {
        const dateStr = log.fechaHoraSalida || (log as any).created_at;
        if (!dateStr && (log as any).year) {
          // even older format
          return (log as any).month === m && (log as any).year === y;
        }
        const date = new Date(dateStr);
        return (date.getUTCMonth() + 1) === m && date.getUTCFullYear() === y;
      });
      const day = monthLogs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasDia || '0');
        const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).cross_country_day_pilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);
      const night = monthLogs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasNoche || '0');
        const oldVal = (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).cross_country_night_pilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);
      
      data.push({
        name: months[d.getMonth()],
        diurna: day,
        nocturna: night
      });
    }
    return data;
  }, [logs]);

  const onTabChange = (value: string) => {
    setActiveTab(value);
  };

  const handleNumericFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      const field = e.target.id as keyof Partial<FlightLog>;
      setFormData(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNumericBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '') {
      const field = e.target.id as keyof Partial<FlightLog>;
      setFormData(prev => ({ ...prev, [field]: 0 }));
    }
  };

  const autocompleteDiscrimination = (field: keyof FlightLog) => {
    const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
    if (totalRef > 0 && (!formData[field] || formData[field] === 0)) {
      setFormData(prev => ({ ...prev, [field]: totalRef }));
    }
  };

  const isItineraryComplete = !!(formData.origin_ad && formData.destination_ad);

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-slate-50 dark:bg-[#101622] pt-4 px-4 overflow-y-auto">
      {activeTab === 'perfil' && profile && (
        (() => {
          const totalKeys: (keyof Profile)[] = [
            'total_airfield_day_pilot', 'total_airfield_day_copilot',
            'total_airfield_night_pilot', 'total_airfield_night_copilot',
            'total_cross_country_day_pilot', 'total_cross_country_day_copilot',
            'total_cross_country_night_pilot', 'total_cross_country_night_copilot',
            'total_landings', 'total_instruction_time', 'total_multi_engine',
            'total_jet', 'total_turboprop', 'total_ag_application',
            'total_ifr_real_pilot', 'total_ifr_real_copilot', 'total_ifr_hood',
            'total_sim_instructor', 'total_sim_student', 'initial_folio_number'
          ];
          const hasMissing = totalKeys.some(key => {
            const val = (profile as any)[key];
            return val === undefined || val === null || val === '';
          });

          if (!hasMissing) return null;

          return (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mb-4 overflow-hidden"
            >
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-xl flex gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-full h-fit">
                  <AlertTriangle className="text-amber-600 w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">Datos de Inicio Pendientes</h3>
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                    Atención: Tienes campos vacíos en la sección <b>'Horas de Inicio'</b>. 
                    Por favor complete estos campos para que el libro pueda realizar los cálculos de sumatoria acumulada correctamente. 
                    <br/><span className="italic mt-1 block">(Si el valor es 0, debe ingresarlo manualmente).</span>
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })()
      )}

      <div className="max-w-lg mx-auto w-full space-y-4">
        
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4 sticky top-0 z-10 bg-white/50 dark:bg-[#1a2233]/50 backdrop-blur-md">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 text-xs">
              <BarChart3 size={14} /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="registrar" className="flex items-center gap-2 text-xs">
              <Plus size={14} /> Registrar
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 text-xs">
              <History size={14} /> Historial
            </TabsTrigger>
            <TabsTrigger value="perfil" className="flex items-center gap-2 text-xs">
              <User size={14} /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 m-0">
            {/* ANAC Sync Card */}
            <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm">
              <CardContent className="pt-4 px-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sincronización ANAC</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Carga tus vuelos automáticamente al sistema oficial.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 gap-2 h-9 shadow-md"
                      onClick={() => compareWithAnac()}
                      disabled={isComparing || isSyncing}
                    >
                      <RefreshCw size={14} className={isComparing || isSyncing ? "animate-spin" : ""} />
                      Sincronizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-gradient-to-br from-slate-700 to-slate-900 text-white border-none shadow-lg">
                <CardContent className="pt-6 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="text-sm font-medium opacity-80 uppercase tracking-wider">HORAS TOTALES</div>
                    <div className="text-[10px] opacity-60">(INICIAL MAS VUELOS CARGADOS)</div>
                    <div className="text-4xl font-black flex items-baseline gap-1 pt-1">
                      {profile?.grand_total_hours?.toFixed(1) || '0.0'} <span className="text-sm font-bold uppercase">hs</span>
                    </div>
                  </div>
                  <BarChart3 size={40} className="opacity-20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-white border-none shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium opacity-80">Horas Diurnas</div>
                  <div className="text-3xl font-bold flex items-baseline gap-1">
                    {totalDayHours} <span className="text-sm">h</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-[#da631e] text-white border-none shadow-lg">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium opacity-80">Horas Nocturnas</div>
                  <div className="text-3xl font-bold flex items-baseline gap-1">
                    {totalNightHours} <span className="text-sm">h</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
                <CardDescription>Horas de vuelo por mes</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] pt-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                    <YAxis fontSize={12} stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                      formatter={(value: number) => [`${value.toFixed(1)} h`]}
                    />
                    <Bar dataKey="diurna" stackId="hours" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="nocturna" stackId="hours" fill="#da631e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Últimos Registros</h3>
              {logs.slice(0, 3).map((log) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <PlaneTakeoff size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const depISO = log.fechaHoraSalida || '';
                          const arrISO = log.fechaHoraLlegada || '';
                          const date = depISO ? new Date(depISO) : null;
                          
                          return (
                            <>
                              <div className="font-semibold text-sm">
                                {log.origenID || (log as any).origin_ad || '---'} → {log.destinoID || (log as any).destination_ad || '---'}
                              </div>
                              <div className="text-[10px] flex items-center gap-2 mt-1">
                                <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                  {depISO ? depISO.slice(11, 16) : ((log as any).departure_time_utc || '--:--')}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                  {arrISO ? arrISO.slice(11, 16) : ((log as any).arrival_time_utc || '--:--')}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">
                                  {date ? `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}` : ((log as any).day ? `${(log as any).day}/${(log as any).month}/${(log as any).year}` : '--/--/--')} 
                                  • {log.matriculaAvion || (log as any).registration || 'S/M'}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {FLIGHT_PURPOSES.find(f => f.key === log.finalidadID)?.sigla || 
                         FLIGHT_TYPES.find(t => t.key === log.tipoVueloID)?.value || 
                         log.tipoVueloID || 'VUELO'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {logs.length === 0 && !loading && (
                <div className="text-center py-6 space-y-4">
                  <div className="opacity-40">
                    <FileText size={48} className="mx-auto mb-2" />
                    <p className="text-sm">No hay vuelos registrados aún</p>
                  </div>
                  <Button variant="outline" onClick={generateSampleData} className="gap-2 border-dashed">
                    <Plus size={16} /> Generar un Vuelo de Prueba
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="registrar" className="m-0 space-y-4 pb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit2 size={20} className="text-blue-600" />
                  {editingId ? 'Editar Registro de Vuelo' : 'Nuevo Registro de Vuelo'}
                </CardTitle>
                <CardDescription>Formato TLA - ANAC 290/2012</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {editingId && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-2 rounded-lg flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Modo Edición Activo</span>
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 text-[10px] text-blue-600 font-bold uppercase">
                      Cancelar y Nuevo
                    </Button>
                  </div>
                )}
                
                {/* Itinerario Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={14} /> ITINERARIO
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="day">Día</Label>
                      <Input id="day" type="number" value={formData.day} onChange={e => setFormData({...formData, day: parseInt(e.target.value)})}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="month">Mes</Label>
                      <Input id="month" type="number" value={formData.month} onChange={e => setFormData({...formData, month: parseInt(e.target.value)})}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="year">Año</Label>
                      <Input id="year" type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})}/>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="origen">Origen (ANAC/IATA/OACI)</Label>
                      <Input 
                        id="origen" 
                        list="airports-list"
                        placeholder="Ej: AER o SABE" 
                        maxLength={4}
                        value={formData.origin_ad || ''} 
                        onChange={e => setFormData({...formData, origin_ad: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destino">Destino (ANAC/IATA/OACI)</Label>
                      <Input 
                        id="destino" 
                        list="airports-list"
                        placeholder="Ej: EZE o SAEZ" 
                        maxLength={4}
                        value={formData.destination_ad || ''} 
                        onChange={e => setFormData({...formData, destination_ad: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <datalist id="airports-list">
                      {(dbAirports.length > 0 ? 
                        dbAirports.flatMap(apt => {
                          const codes = [apt.anac_code, apt.iata_code, apt.icao_code].filter(Boolean);
                          const uniqueCodes = Array.from(new Set(codes));
                          return uniqueCodes.map(code => ({
                            value: code,
                            label: `${apt.name} (${uniqueCodes.join('/')})`
                          }));
                        }) : 
                        IATA_LIST.map(apt => ({ value: apt.iata, label: apt.name }))
                      )
                      .map((apt: any, idx: number) => (
                        <option key={`${apt.value}-${idx}`} value={apt.value}>{apt.label}</option>
                      ))}
                    </datalist>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="purpose">Finalidad (Siglas ANAC)</Label>
                      <select id="purpose" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm ring-offset-background" value={formData.flight_purpose || ''} onChange={e => setFormData({...formData, flight_purpose: e.target.value})}>
                        {FLIGHT_PURPOSES.map(p => (
                          <option key={p.key} value={p.key}>{p.value}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="dep">Salida (UTC)</Label>
                      <Input 
                        id="dep" 
                        type="text" 
                        inputMode="numeric"
                        placeholder="HH:mm"
                        maxLength={5}
                        className="font-mono text-center tracking-widest bg-slate-900/50"
                        value={(formData.departure_time_utc || '').slice(0, 5)} 
                        onChange={e => {
                          let val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length >= 3) {
                            val = val.slice(0, 2) + ':' + val.slice(2, 4);
                          }
                          setFormData({...formData, departure_time_utc: val.slice(0, 5)});
                        }}
                        onBlur={e => {
                          const parts = e.target.value.split(':');
                          if (parts.length >= 2) {
                            let h = parseInt(parts[0]) || 0;
                            let m = parseInt(parts[1]) || 0;
                            if (h > 23) h = 23;
                            if (m > 59) m = 59;
                            setFormData({...formData, departure_time_utc: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`});
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="arr">Llegada (UTC)</Label>
                      <Input 
                        id="arr" 
                        type="text" 
                        inputMode="numeric"
                        placeholder="HH:mm"
                        maxLength={5}
                        className="font-mono text-center tracking-widest bg-slate-900/50"
                        value={(formData.arrival_time_utc || '').slice(0, 5)} 
                        onChange={e => {
                          let val = e.target.value.replace(/[^0-9]/g, '');
                          if (val.length >= 3) {
                            val = val.slice(0, 2) + ':' + val.slice(2, 4);
                          }
                          setFormData({...formData, arrival_time_utc: val.slice(0, 5)});
                        }}
                        onBlur={e => {
                          const parts = e.target.value.split(':');
                          if (parts.length >= 2) {
                            let h = parseInt(parts[0]) || 0;
                            let m = parseInt(parts[1]) || 0;
                            if (h > 23) h = 23;
                            if (m > 59) m = 59;
                            setFormData({...formData, arrival_time_utc: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`});
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Aeronave Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <PlaneTakeoff size={14} /> AERONAVE
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="model">Marca / Modelo</Label>
                      <Input id="model" placeholder="Boeing 737" value={formData.aircraft_model || ''} onChange={e => setFormData({...formData, aircraft_model: e.target.value})}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg">Matrícula</Label>
                      <Input 
                        id="reg" 
                        list="registrations-list"
                        placeholder="LV-ABC" 
                        value={formData.registration || ''} 
                        onChange={e => setFormData({...formData, registration: e.target.value.toUpperCase()})}
                      />
                      <datalist id="registrations-list">
                        {Array.from(new Set(logs.map(log => log.registration).filter(Boolean))).sort().map(reg => (
                          <option key={reg} value={reg} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="power">Potencia (Manual)</Label>
                        <Input 
                          id="power_rating" 
                          type="number" 
                          lang="en" 
                          placeholder="Ej: 180" 
                          value={formData.power_rating ?? ''} 
                          onChange={e => setFormData({...formData, power_rating: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-2">
                      <Label htmlFor="class">Clase (Sigla ANAC)</Label>
                      <select id="class" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm" value={formData.aircraft_class || ''} onChange={e => setFormData({...formData, aircraft_class: e.target.value})}>
                        <option value="MONT-T">MONT-T (Monomotor Terrestre)</option>
                        <option value="MULT-T">MULT-T (Multimotor Terrestre)</option>
                        <option value="MONT-A">MONT-A (Monomotor Acuático)</option>
                        <option value="MULT-A">MULT-A (Multimotor Acuático)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label htmlFor="certifier">Nombre y Apellido del Certificante</Label>
                    <Input id="certifier" placeholder="Ej: Juan Pérez" value={formData.certifier_name || ''} onChange={e => setFormData({...formData, certifier_name: e.target.value})}/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="certifier_role">Función de la Autoridad</Label>
                    <select id="certifier_role" className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm ring-offset-background" value={formData.certifier_role_id || '2'} onChange={e => setFormData({...formData, certifier_role_id: e.target.value})}>
                      {CERTIFIER_ROLES.map(role => (
                        <option key={role.key} value={role.key}>{role.value}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Separator />

                {/* Discriminacion Tiempos Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock size={14} /> TIEMPOS DE VUELO (Horas Decimales)
                    </div>
                    {formData.departure_time_utc && formData.arrival_time_utc && (
                      <div className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-200 dark:border-blue-800">
                        Total: {calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc)} hs
                      </div>
                    )}
                  </h4>

                  {/* Validation Warning for Times */}
                  {(() => {
                    const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
                    const currentSum = (
                      Number(formData.airfield_day_pilot || 0) +
                      Number(formData.airfield_day_copilot || 0) +
                      Number(formData.airfield_night_pilot || 0) +
                      Number(formData.airfield_night_copilot || 0) +
                      Number(formData.cross_country_day_pilot || 0) +
                      Number(formData.cross_country_day_copilot || 0) +
                      Number(formData.cross_country_night_pilot || 0) +
                      Number(formData.cross_country_night_copilot || 0)
                    );

                    if (currentSum > (totalRef + 0.01)) { // Small epsilon for float comparison
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg flex gap-3"
                        >
                          <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0" />
                          <div className="space-y-1">
                            <h5 className="text-[11px] font-bold text-amber-800 dark:text-amber-200">Exceso en Discriminación de Horas</h5>
                            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
                              Atención: La suma de los tiempos cargados ({currentSum.toFixed(1)} hs) excede el valor total permitido ({totalRef.toFixed(1)} hs) según el itinerario. Por favor verifique los datos.
                            </p>
                          </div>
                        </motion.div>
                      );
                    }
                    return null;
                  })()}
                  
                  {(() => {
                    const resolvedOriginCheck = resolveToAnac(formData.origin_ad, dbAirports);
                    const resolvedDestCheck = resolveToAnac(formData.destination_ad, dbAirports);
                    const isCrossCountry = resolvedOriginCheck && resolvedDestCheck && resolvedOriginCheck !== resolvedDestCheck;
                    return (
                      <div className={`space-y-3 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg transition-all duration-300 ${isCrossCountry ? 'opacity-40 grayscale-[0.5] pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold opacity-70">SOBRE AERÓDROMO</Label>
                          {isCrossCountry && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">Bloqueado por Travesía</span>}
                        </div>
                    <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Día (Piloto)</Label>
                            <Input 
                              id="airfield_day_pilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isCrossCountry || !isItineraryComplete}
                              value={isCrossCountry ? 0 : (formData.airfield_day_pilot ?? '')} 
                              onChange={e => setFormData({...formData, airfield_day_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Día (Copiloto)</Label>
                            <Input 
                              id="airfield_day_copilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isCrossCountry || !isItineraryComplete}
                              value={isCrossCountry ? 0 : (formData.airfield_day_copilot ?? '')} 
                              onChange={e => setFormData({...formData, airfield_day_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Noche (Piloto)</Label>
                            <Input 
                              id="airfield_night_pilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isCrossCountry || !isItineraryComplete}
                              value={isCrossCountry ? 0 : (formData.airfield_night_pilot ?? '')} 
                              onChange={e => setFormData({...formData, airfield_night_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Noche (Copiloto)</Label>
                            <Input 
                              id="airfield_night_copilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isCrossCountry || !isItineraryComplete}
                              value={isCrossCountry ? 0 : (formData.airfield_night_copilot ?? '')} 
                              onChange={e => setFormData({...formData, airfield_night_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const resolvedOriginCheck = resolveToAnac(formData.origin_ad, dbAirports);
                    const resolvedDestCheck = resolveToAnac(formData.destination_ad, dbAirports);
                    const isLocal = resolvedOriginCheck && resolvedDestCheck && resolvedOriginCheck === resolvedDestCheck;
                    return (
                      <div className={`space-y-3 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg transition-all duration-300 ${isLocal ? 'opacity-40 grayscale-[0.5] pointer-events-none' : ''}`}>
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold opacity-70">TRAVESÍA</Label>
                          {isLocal && <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter">Bloqueado por Vuelo Local</span>}
                        </div>
                    <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Día (Piloto)</Label>
                            <Input 
                              id="cross_country_day_pilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isLocal || !isItineraryComplete}
                              value={isLocal ? 0 : (formData.cross_country_day_pilot ?? '')} 
                              onChange={e => setFormData({...formData, cross_country_day_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Día (Copiloto)</Label>
                            <Input 
                              id="cross_country_day_copilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isLocal || !isItineraryComplete}
                              value={isLocal ? 0 : (formData.cross_country_day_copilot ?? '')} 
                              onChange={e => setFormData({...formData, cross_country_day_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Noche (Piloto)</Label>
                            <Input 
                              id="cross_country_night_pilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isLocal || !isItineraryComplete}
                              value={isLocal ? 0 : (formData.cross_country_night_pilot ?? '')} 
                              onChange={e => setFormData({...formData, cross_country_night_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Noche (Copiloto)</Label>
                            <Input 
                              id="cross_country_night_copilot"
                              type="number" 
                              step="0.1" 
                              lang="en" 
                              disabled={!!isLocal || !isItineraryComplete}
                              value={isLocal ? 0 : (formData.cross_country_night_copilot ?? '')} 
                              onChange={e => setFormData({...formData, cross_country_night_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                              onFocus={handleNumericFocus}
                              onBlur={handleNumericBlur}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* IFR Section */}
                  <div className="space-y-3 p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
                    <Label className="text-[10px] font-bold opacity-70">VUELO POR INSTRUMENTOS (Real / Capota)</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Real (Piloto)</Label>
                        <Input 
                          id="ifr_real_pilot"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.ifr_real_pilot ?? ''} 
                          onChange={e => setFormData({...formData, ifr_real_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('ifr_real_pilot'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Real (Copiloto)</Label>
                        <Input 
                          id="ifr_real_copilot"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.ifr_real_copilot ?? ''} 
                          onChange={e => setFormData({...formData, ifr_real_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Capota</Label>
                        <Input 
                          id="ifr_hood"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.ifr_hood ?? ''} 
                          onChange={e => setFormData({...formData, ifr_hood: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Other Discrimination Section */}
                  <div className="space-y-3 p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
                    <Label className="text-[10px] font-bold opacity-70">DISCRIMINACIÓN DE TIEMPOS DE VUELO</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Instructor de Vuelo</Label>
                        <Input 
                          id="instruction_time"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.instruction_time ?? ''} 
                          onChange={e => setFormData({...formData, instruction_time: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('instruction_time'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Aterrizajes (Cant.)</Label>
                        <Input 
                          id="landings"
                          type="number" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.landings ?? ''} 
                          onChange={e => setFormData({...formData, landings: e.target.value === '' ? 0 : parseInt(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Multimotor (Hs)</Label>
                        <Input 
                          id="multi_engine"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.multi_engine ?? ''} 
                          onChange={e => setFormData({...formData, multi_engine: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('multi_engine'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Reactor / Jet (Hs)</Label>
                        <Input 
                          id="jet"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.jet ?? ''} 
                          onChange={e => setFormData({...formData, jet: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('jet'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Turbohélice (Hs)</Label>
                        <Input 
                          id="turboprop"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.turboprop ?? ''} 
                          onChange={e => setFormData({...formData, turboprop: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('turboprop'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Aeroaplicador (Hs)</Label>
                        <Input 
                          id="ag_application"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.ag_application ?? ''} 
                          onChange={e => setFormData({...formData, ag_application: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('ag_application'); }}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Simulator Section */}
                  <div className="space-y-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg">
                    <Label className="text-[10px] font-bold opacity-70">SIMULADOR / ADIESTRADOR</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Instructor hs</Label>
                        <Input 
                          id="sim_instructor"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.sim_instructor ?? ''} 
                          onChange={e => setFormData({...formData, sim_instructor: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Piloto en Inst. hs</Label>
                        <Input 
                          id="sim_student"
                          type="number" 
                          step="0.1" 
                          lang="en" 
                          disabled={!isItineraryComplete}
                          value={formData.sim_student ?? ''} 
                          onChange={e => setFormData({...formData, sim_student: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                          onFocus={handleNumericFocus}
                          onBlur={handleNumericBlur}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-lg rounded-xl shadow-lg shadow-blue-500/20" onClick={saveLog}>
                  <Save size={20} className="mr-2" /> {editingId ? 'Actualizar Cambios' : 'Guardar Vuelo'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="m-0 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">REGISTRO DE VUELOS</h3>
              <div className="flex gap-2">
                {(() => {
                  const numPages = Math.ceil(logs.length / 15);
                  const startFolio = profile?.initial_folio_number || 1;
                  const endFolio = startFolio + Math.max(0, numPages - 1);
                  const folioRangeLabel = numPages > 1 ? `Folios_${startFolio}_al_${endFolio}` : `Folio_${startFolio}`;
                  
                  return (
                    <PDFDownloadLink 
                      document={<FlightLogPDF logs={logs} profile={profile || undefined} />} 
                      fileName={`Libro_Vuelo_${profile?.last_name || 'Piloto'}_${folioRangeLabel}.pdf`}
                    >
                      {({ loading }) => (
                        <Button variant="outline" size="sm" className="h-8 gap-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" disabled={loading || logs.length === 0}>
                          <FileDown size={14} /> {loading ? 'Cargando...' : 'Generar Folio PDF'}
                        </Button>
                      )}
                    </PDFDownloadLink>
                  );
                })()}
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={exportToExcel}>
                  <FileDown size={14} /> EXCEL
                </Button>
              </div>
            </div>
            
            <Card className="overflow-hidden">
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-medium">
                          {(() => {
                            const dStr = log.fechaHoraSalida || (log as any).created_at;
                            if (dStr) {
                              const d = new Date(dStr);
                              return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(-2)}`;
                            }
                            const y = (log as any).year;
                            return `${(log as any).day || '--'}/${(log as any).month || '--'}/${y ? y.toString().slice(-2) : '--'}`;
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold">
                            {log.origenID || (log as any).origin_ad || '---'} → {log.destinoID || (log as any).destination_ad || '---'}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                              {log.fechaHoraSalida ? log.fechaHoraSalida.slice(11, 16) : ((log as any).departure_time_utc?.slice(0,5) || '--:--')}
                            </span>
                            <span className="text-[10px] opacity-30">|</span>
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              {log.fechaHoraLlegada ? log.fechaHoraLlegada.slice(11, 16) : ((log as any).arrival_time_utc?.slice(0,5) || '--:--')}
                            </span>
                            <span className="text-[10px] opacity-60 uppercase ml-1">
                              {log.matriculaAvion || (log as any).registration || 'S/M'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(() => {
                            const nH = (parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0'));
                            const oH = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_night_pilot) || 0);
                            return (nH > 0 ? nH : oH).toFixed(1);
                          })()}h
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => startEditing(log)}>
                              <Edit2 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteLog(log.id)}>
                              <X size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {logs.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <History size={40} className="mx-auto mb-4" />
                    <p>No hay historial registrado</p>
                  </div>
                )}
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="perfil" className="m-0 space-y-4 pb-12 relative">
            {loading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-blue-600 animate-pulse">Sincronizando...</p>
                </div>
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User size={20} className="text-blue-600" />
                    Perfil del Piloto
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] uppercase tracking-wider text-blue-600 font-bold"
                      onClick={async () => {
                        try {
                          const fresh = await refreshData();
                          if (fresh) {
                            const hasData = fresh.license || fresh.legajo || fresh.dni;
                            if (hasData) {
                              alert("Datos sincronizados desde la base de datos.");
                            } else {
                              alert("Se sincronizó con éxito, pero tu registro en la base de datos parece estar vacío.");
                            }
                          } else {
                            alert("No se pudo recuperar tu perfil. Verifica tu conexión.");
                          }
                        } catch (e) {
                          alert("Error al sincronizar.");
                        }
                      }}
                      disabled={loading || isSavingProfile}
                    >
                      {loading ? '...' : 'Sincronizar'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] uppercase tracking-wider text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10"
                      onClick={handleLogout}
                      disabled={loading}
                    >
                      <LogOut size={14} className="mr-1" />
                      Cerrar Sesión
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>Estos datos aparecerán en el encabezado de tus folios PDF</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="prof_email">Email (Autenticación)</Label>
                  <Input 
                    id="prof_email" 
                    value={profile?.email || ''} 
                    disabled 
                    className="bg-slate-50 dark:bg-slate-800 text-slate-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof_nombre">Nombre</Label>
                    <Input 
                      id="prof_nombre" 
                      value={profile?.first_name || ''} 
                      onChange={e => setProfile(prev => prev ? {...prev, first_name: e.target.value} : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prof_apellido">Apellido</Label>
                    <Input 
                      id="prof_apellido" 
                      value={profile?.last_name || ''} 
                      onChange={e => setProfile(prev => prev ? {...prev, last_name: e.target.value} : null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prof_licencia">Tipo de Licencia</Label>
                    <div className="relative">
                      <select 
                        id="prof_licencia"
                        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-1 pr-2 pl-2.5 text-sm transition-colors outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-white"
                        value={profile?.license || ''} 
                        onChange={(e) => setProfile(prev => prev ? {...prev, license: e.target.value} : null)}
                      >
                        <option value="" disabled className="text-slate-400">Seleccionar licencia</option>
                        {LICENSE_TYPES.map(type => (
                          <option key={type.sigla} value={type.sigla} className="bg-white dark:bg-[#1a2233]">
                            {type.sigla} - {type.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        <ChevronRight className="rotate-90 size-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prof_legajo">Legajo Nº</Label>
                    <Input 
                      id="prof_legajo" 
                      value={profile?.legajo || ''} 
                      onChange={e => setProfile(prev => prev ? {...prev, legajo: e.target.value} : null)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prof_dni">DNI / Pasaporte</Label>
                  <Input 
                    id="prof_dni" 
                    value={profile?.dni || ''} 
                    onChange={e => setProfile(prev => prev ? {...prev, dni: e.target.value} : null)}
                  />
                </div>

                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <Clock size={16} /> Horas de Inicio (Totales Anterior)
                  </h4>
                  <p className="text-[11px] text-slate-500 italic">
                    Ingresa tus horas totales acumuladas hasta la fecha para que el libro continúe la sumatoria correctamente.
                  </p>

                  <div className="space-y-4">
                    {/* Airfield Carry-forward */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sobre Aeródromo</div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Día Piloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_airfield_day_pilot ?? ''} onChange={e => handleProfileFieldChange('total_airfield_day_pilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Día Copiloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_airfield_day_copilot ?? ''} onChange={e => handleProfileFieldChange('total_airfield_day_copilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Noche Piloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_airfield_night_pilot ?? ''} onChange={e => handleProfileFieldChange('total_airfield_night_pilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Noche Copiloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_airfield_night_copilot ?? ''} onChange={e => handleProfileFieldChange('total_airfield_night_copilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                    </div>

                    {/* Cross Country Carry-forward */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                      <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Travesía</div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Día Piloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_cross_country_day_pilot ?? ''} onChange={e => handleProfileFieldChange('total_cross_country_day_pilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px]">Día Copiloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_cross_country_day_copilot ?? ''} onChange={e => handleProfileFieldChange('total_cross_country_day_copilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Noche Piloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_cross_country_night_pilot ?? ''} onChange={e => handleProfileFieldChange('total_cross_country_night_pilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Noche Copiloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_cross_country_night_copilot ?? ''} onChange={e => handleProfileFieldChange('total_cross_country_night_copilot', e.target.value === '' ? null : parseFloat(e.target.value))}/>
                      </div>
                    </div>

                    {/* Discrimination Carry-forward */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/30 dark:bg-amber-900/10 rounded-lg border border-amber-100 dark:border-amber-900/20">
                      <div className="col-span-2 text-[10px] font-bold text-amber-600/60 uppercase tracking-wider">Discriminación</div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Instrucción Hs</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_instruction_time ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_instruction_time: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Aterrizajes (Cant.)</Label>
                        <Input type="number" className="h-8 text-xs" value={profile?.total_landings ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_landings: e.target.value === '' ? null : (parseInt(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Multimotor</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_multi_engine ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_multi_engine: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Reactor / Jet</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_jet ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_jet: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Turbo Hélice</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_turboprop ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_turboprop: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Aeroapl.</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_ag_application ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_ag_application: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                    </div>

                    {/* Sim Carry-forward */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="col-span-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulador / Entrenador</div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Instructor</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_sim_instructor ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_sim_instructor: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Alumno</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_sim_student ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_sim_student: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                    </div>

                    {/* IFR Carry-forward */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                      <div className="col-span-3 text-[10px] font-bold text-blue-600/60 uppercase tracking-wider">IFR (Real / Capota)</div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Real Piloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_ifr_real_pilot ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_ifr_real_pilot: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Real Copiloto</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_ifr_real_copilot ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_ifr_real_copilot: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Capota</Label>
                        <Input type="number" step="0.1" className="h-8 text-xs" value={profile?.total_ifr_hood ?? ''} onChange={e => setProfile(prev => prev ? {...prev, total_ifr_hood: e.target.value === '' ? null : (parseFloat(e.target.value) || 0)} : null)}/>
                      </div>
                    </div>

                    {/* Folio Initial Config */}
                    <div className="p-3 bg-slate-900 dark:bg-slate-800 rounded-lg border border-slate-700">
                      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2">Configuración de Folio</div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-white">Próximo Folio Nº a Generar</Label>
                        <Input 
                          type="number" 
                          className="h-8 text-xs bg-slate-800 border-slate-600 text-white" 
                          placeholder="Ej: 1"
                          value={profile?.initial_folio_number ?? ''} 
                          onChange={e => setProfile(prev => prev ? {...prev, initial_folio_number: e.target.value === '' ? null : (parseInt(e.target.value) || 0)} : null)}
                        />
                        <p className="text-[9px] text-slate-400 mt-1">
                          Establece el número con el que se identificará tu primer PDF generado.
                        </p>
                      </div>
                    </div>

                    {/* Cuadros de Totales Informativos (Resumen General) */}
                    <div className="space-y-3 pt-4">
                      {/* Horas de Inicio */}
                      <div className="p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History size={20} className="text-emerald-600" />
                          <div>
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">HORAS DE INICIO</p>
                            <p className="text-[10px] text-emerald-500/70">Suma de los tiempos del ultimo foliado cargado</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-emerald-600">{profile?.initial_total_hours?.toFixed(1) || '0.0'}</span>
                          <span className="text-xs font-bold text-emerald-600 ml-1">hs</span>
                        </div>
                      </div>

                      {/* Total Horas (General) */}
                      <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={20} className="text-blue-600" />
                          <div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">HORAS TOTALES</p>
                            <p className="text-[10px] text-blue-400/70">(Inicial mas vuelos cargados)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-blue-600">{profile?.grand_total_hours?.toFixed(1) || '0.0'}</span>
                          <span className="text-xs font-bold text-blue-600 ml-1">hs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl" 
                  onClick={updateProfile}
                  disabled={isSavingProfile || !profile}
                >
                  {isSavingProfile ? 'Guardando...' : 'Actualizar Perfil'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ANAC Sync Dialog Overlay */}
      <AnimatePresence>
        {showSyncDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a2233] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-1 text-right">
                <button 
                  onClick={() => setShowSyncDialog(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="px-6 pb-8">
                <AnacAuth onAuthSuccess={(session) => {
                  console.log("!!! SESION RECIBIDA !!!", session);
                  console.log("Nombres de cookies encontradas:", session.cookies.map((c: any) => c.name));
                  
                  // Buscamos la cookie de autenticación (Intentamos varias posibilidades)
                  let authCookie = session.cookies.find((c: any) => 
                    c.name === 'Auth.ANAC.localhost' ||
                    c.name.toLowerCase().includes('auth') || 
                    c.name.includes('ANAC')
                  );

                  if (authCookie) {
                    setAnacToken(authCookie.value);
                    setAnacSession(session);
                    setSyncStatus({ message: 'Sesión válida. Buscando vuelos pendientes...', type: 'info' });
                    
                    // En lugar de sincronizar todo, forzamos la comparación
                    setTimeout(() => {
                      setShowSyncDialog(false);
                      compareWithAnac();
                    }, 800);
                  } else {
                    setSyncStatus({ message: 'Error: Credenciales inválidas.', type: 'error' });
                  }
                }} />

                {/* Status messages for sync process (post-login) */}
                {isSyncing && (
                  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col items-center gap-3">
                    <RefreshCw className="text-blue-500 animate-spin" size={24} />
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-widest animate-pulse">Sincronizando vuelos...</p>
                    <p className="text-[10px] text-blue-500 text-center">{syncStatus.message}</p>
                  </div>
                )}

                {syncStatus.type && !isSyncing && (
                  <div className={`mt-4 p-4 rounded-xl border text-xs flex items-start gap-3 ${
                    syncStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 
                    syncStatus.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 
                    'bg-blue-500/10 border-blue-500/20 text-blue-500'
                  }`}>
                    {syncStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    <div className="flex-1">
                      <p className="font-bold">{syncStatus.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pending Sync Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a2233] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {syncStatus.type === 'success' && pendingLogs.length > 0 ? 'Vuelos Sincronizados' : 'Vuelos Pendientes'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {syncStatus.type === 'success' && pendingLogs.length > 0 ? 'Estos vuelos han sido subidos exitosamente al portal de ANAC.' : 'Estos vuelos no se encontraron en el portal de ANAC.'}
                  </p>
                </div>
                <button onClick={() => setShowPendingModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <ScrollArea className="h-[350px] p-4">
                {pendingLogs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500">
                    <CheckCircle2 size={48} className="text-emerald-500" />
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">¡Todo está al día!</p>
                      <p className="text-sm mt-2">No hay nuevos vuelos para cargar. Tus registros locales y el portal de ANAC se encuentran perfectamente sincronizados.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingLogs.map((log) => {
                      const date = new Date(log.fechaHoraSalida);
                      return (
                        <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                          <div>
                            <div className="font-bold text-sm">{log.origenID || (log as any).origin_ad} → {log.destinoID || (log as any).destination_ad}</div>
                            <div className="text-[10px] text-slate-500">
                              {date.getUTCDate()}/{date.getUTCMonth() + 1}/{date.getUTCFullYear()} • {log.matriculaAvion || (log as any).registration}
                            </div>
                          </div>
                          <Badge variant="outline" className={syncStatus.type === 'success' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40"}>
                            {syncStatus.type === 'success' ? 'Sincronizado' : 'Pendiente'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowPendingModal(false)}>
                  Cerrar
                </Button>
                {pendingLogs.length > 0 && syncStatus.type !== 'success' && (
                  <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
                    onClick={() => handleSyncANAC(undefined, undefined, pendingLogs)}
                    disabled={isSyncing}
                  >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? 'Sincronizando...' : `Sincronizar ${pendingLogs.length}`}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
