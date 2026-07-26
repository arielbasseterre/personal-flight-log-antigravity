import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AlertCircle,
  CheckCircle2,
  Globe,
  RefreshCw,
  LogOut,
  WifiOff,
  CloudOff,
  Clock as ClockIcon
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
  Cell,
  LabelList
} from 'recharts';
import { FlightLog, Profile, AnacLog } from '@/src/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { FlightLogPDF } from './FlightLogPDF';
import { AnacAuth } from './AnacAuth';
import { SIMULATOR_LIST } from './simulatorsData';
import { supabase } from '@/src/utils/supabase/client';
import { getApiUrl } from '@/src/utils/api';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getQueue, addToQueue, removeFromQueue, pendingCount, PendingOp } from '@/src/utils/offlineQueue';
import airportsCsvRaw from '../../airports.csv?raw';

interface LibroScreenProps {
  logs: FlightLog[];
  setLogs: React.Dispatch<React.SetStateAction<FlightLog[]>>;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshData: () => Promise<Profile | null>;
  loading: boolean;
  userId: string;
  onGoToSuscripcion?: () => void;
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


// A wrapper around Input to handle both dot and comma for decimal numbers
const DecimalInput = ({ value, onChange, id, disabled, placeholder, className, onFocus, onBlur, lang, step }: any) => {
  const [localValue, setLocalValue] = React.useState(value !== undefined && value !== null && value !== 0 ? String(value) : '');

  React.useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setLocalValue('');
    } else {
      const currentParsed = parseFloat(localValue.replace(',', '.'));
      if (isNaN(currentParsed) || currentParsed !== value) {
        setLocalValue(String(value));
      }
    }
  }, [value]);

  const handleChange = (e: any) => {
    let val = e.target.value;
    val = val.replace(/,/g, '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    setLocalValue(val);
    
    if (val === '' || val === '.') {
      onChange({ target: { value: '' } });
    } else {
      onChange({ target: { value: val } });
    }
  };

  return (
    <Input 
      id={id}
      type="text" 
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={localValue}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      lang={lang}
      step={step}
    />
  );
};

const parseAirportsCsv = (csvText: string) => {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return [];
  const airports = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length < 2) continue;
    const iata = parts[0]?.trim().replace(/^"|"$/g, '');
    const icao = parts[1]?.trim().replace(/^"|"$/g, '');
    const anac = parts[2]?.trim().replace(/^"|"$/g, '');
    const name = parts[3]?.trim().replace(/^"|"$/g, '');
    const city = parts[4]?.trim().replace(/^"|"$/g, '');
    
    const cleanAnac = anac && anac !== 'N/A' && anac !== '' ? anac.toUpperCase() : null;
    airports.push({
      iata_code: iata?.toUpperCase(),
      icao_code: icao?.toUpperCase(),
      anac_code: cleanAnac,
      key_code: cleanAnac || iata?.toUpperCase(),
      name: name || '',
      city: city || ''
    });
  }
  return airports;
};

const localAirportsList = parseAirportsCsv(airportsCsvRaw);

const AirportAutocomplete = ({ id, value, onChange, dbAirports, IATA_LIST, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    const lowerNorm = normalizeStr(lower);
    
    let allApts: any[] = localAirportsList;
    if (dbAirports && dbAirports.length > 0) {
      // Merge dbAirports and localAirportsList, giving priority to local list for duplicates
      const localKeys = new Set(localAirportsList.map(a => a.key_code));
      const dbAptsMerged = dbAirports.filter((apt: any) => !localKeys.has(apt.key_code || apt.anac_code || apt.iata_code || apt.icao_code)).map((apt: any) => {
        const codes = [apt.anac_code, apt.iata_code, apt.icao_code].filter(Boolean);
        const uniqueCodes = Array.from(new Set(codes));
        const raw = `${apt.name} ${uniqueCodes.join(' ')}`;
        return {
          code: apt.key_code || apt.anac_code || apt.iata_code || apt.icao_code,
          label: `${apt.name} (${uniqueCodes.join('/')})`,
          searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}`
        }
      });
      allApts = [...localAirportsList.map(apt => {
        const codes = [apt.anac_code, apt.iata_code, apt.icao_code].filter(Boolean);
        const uniqueCodes = Array.from(new Set(codes));
        const raw = `${apt.city} ${apt.name} ${uniqueCodes.join(' ')}`;
        return {
          code: apt.key_code,
          label: `${apt.city ? apt.city + ' - ' : ''}${apt.name} (${uniqueCodes.join('/')})`,
          searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}`
        }
      }), ...dbAptsMerged];
    } else {
      // Fallback if dbAirports is empty, use local list anyway
      allApts = localAirportsList.map(apt => {
        const codes = [apt.anac_code, apt.iata_code, apt.icao_code].filter(Boolean);
        const uniqueCodes = Array.from(new Set(codes));
        const raw = `${apt.city} ${apt.name} ${uniqueCodes.join(' ')}`;
        return {
          code: apt.key_code,
          label: `${apt.city ? apt.city + ' - ' : ''}${apt.name} (${uniqueCodes.join('/')})`,
          searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}`
        }
      });
      if (allApts.length === 0) {
        allApts = IATA_LIST.map((apt: any) => {
          const raw = `${apt.name} ${apt.iata}`;
          return {
            code: apt.iata,
            label: `${apt.name} (${apt.iata})`,
            searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}`
          }
        });
      }
    }

    return allApts.filter((a: any) => a.searchStr.includes(lower) || a.searchStr.includes(lowerNorm)).slice(0, 15);
  }, [search, dbAirports, IATA_LIST]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        id={id}
        placeholder={placeholder}
        maxLength={30}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          onChange(e.target.value.toUpperCase());
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl">
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.map((item: any, idx: number) => (
              <li 
                key={idx}
                className="px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col gap-0.5"
                onClick={() => {
                  setSearch(item.code);
                  onChange(item.code);
                  setIsOpen(false);
                }}
              >
                <div className="font-bold text-xs text-blue-600 dark:text-blue-400">{item.code}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.label}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const LibroScreen = ({ logs, setLogs, profile, setProfile, refreshData, loading, userId, onGoToSuscripcion }: LibroScreenProps) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [dbAirports, setDbAirports] = useState<any[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger';
    isAlert?: boolean;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Helper para mostrar alertas estilizadas
  const showAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' = 'info') => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })),
      type,
      isAlert: true,
      confirmText: 'Entendido'
    });
  };

  // Helper para mostrar confirmaciones estilizadas
  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        onConfirm();
      },
      onCancel: () => setConfirmModal(prev => ({ ...prev, show: false })),
      type,
      isAlert: false,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar'
    });
  };

  // Helper to read from localStorage safely
  const getSavedField = (key: string, defaultVal: string) => {
    try {
      const val = localStorage.getItem(`saved_${key}`);
      return val !== null ? val : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  };

  // Initial state for the form helper
  const getInitialFormState = (): Partial<FlightLog> => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    departure_time_utc: "",
    arrival_time_utc: "",
    origin_ad: "",
    destination_ad: "",
    flight_purpose: getSavedField("flight_purpose", "78"),
    aircraft_model: getSavedField("aircraft_model", ""),
    registration: "",
    power_rating: Number(getSavedField("power_rating", "0")),
    aircraft_class: "MULT-T",
    certifier_name: getSavedField("certifier_name", ""),
    certifier_role_id: getSavedField("certifier_role_id", "2"),
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
    ifr_hood: 0
  });

  const initialFormState = getInitialFormState();

  const [formData, setFormData] = useState<Partial<FlightLog>>(() => {
    try {
      const saved = localStorage.getItem('draft_flight_log_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Si no estamos editando un registro existente, siempre usar la fecha actual
        const isEditing = localStorage.getItem('draft_flight_log_editing_id');
        if (!isEditing) {
          parsed.year = new Date().getFullYear();
          parsed.month = new Date().getMonth() + 1;
          parsed.day = new Date().getDate();
        }
        return parsed;
      }
    } catch (e) {
      console.error("Error reading flight log draft:", e);
    }
    return initialFormState;
  });
  const [editingId, setEditingId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('draft_flight_log_editing_id') || null;
    } catch (e) {
      return null;
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [anacToken, setAnacToken] = useState('');
  const [anacSession, setAnacSession] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<{ message: string, type: 'info' | 'success' | 'error' | null, debugInfo?: any }>({ message: '', type: null });
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showDebugDetail, setShowDebugDetail] = useState(false);
  const [anacLogs, setAnacLogs] = useState<AnacLog[]>([]);
  const [pendingLogs, setPendingLogs] = useState<FlightLog[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // ── Offline Queue States ────────────────────────────────────────────
  const [pendingOps, setPendingOps] = useState<PendingOp[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);

  // Ref para evitar stale closure en event listeners
  const processQueueRef = useRef<() => Promise<void>>(async () => {});
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  // Load pending ops from queue on mount + sync if online
  useEffect(() => {
    setPendingOps(getQueue());
    if (navigator.onLine && getQueue().length > 0) {
      processQueueRef.current();
    }
  }, []);

  // Listeners for online/offline detection + auto-sync (usa ref para evitar stale closure)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueueRef.current();
    };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => { if (navigator.onLine) processQueueRef.current(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('draft_flight_log_form', JSON.stringify(formData));
    } catch (e) {
      console.error("Error writing flight log draft:", e);
    }
  }, [formData]);

  useEffect(() => {
    try {
      if (editingId) {
        localStorage.setItem('draft_flight_log_editing_id', editingId);
      } else {
        localStorage.removeItem('draft_flight_log_editing_id');
      }
    } catch (e) {
      console.error("Error writing flight log editing ID:", e);
    }
  }, [editingId]);

  useEffect(() => {
    try {
      localStorage.setItem('draft_flight_log_active_tab', activeTab);
    } catch (e) {
      console.error("Error writing flight log active tab:", e);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchAirports();
    if (logs.length === 0 && !profile) {
      refreshData();
    }
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

  // Exclusión mutua IFR: limpiar el campo opuesto si se cargan horas en una función
  useEffect(() => {
    const pilotHours =
      Number(formData.airfield_day_pilot || 0) +
      Number(formData.airfield_night_pilot || 0) +
      Number(formData.cross_country_day_pilot || 0) +
      Number(formData.cross_country_night_pilot || 0);
    const copilotHours =
      Number(formData.airfield_day_copilot || 0) +
      Number(formData.airfield_night_copilot || 0) +
      Number(formData.cross_country_day_copilot || 0) +
      Number(formData.cross_country_night_copilot || 0);

    if (pilotHours > 0 && Number(formData.ifr_real_copilot) > 0) {
      setFormData(prev => ({ ...prev, ifr_real_copilot: 0 }));
    }
    if (copilotHours > 0 && Number(formData.ifr_real_pilot) > 0) {
      setFormData(prev => ({ ...prev, ifr_real_pilot: 0 }));
    }
  }, [
    formData.airfield_day_pilot, formData.airfield_night_pilot,
    formData.cross_country_day_pilot, formData.cross_country_night_pilot,
    formData.airfield_day_copilot, formData.airfield_night_copilot,
    formData.cross_country_day_copilot, formData.cross_country_night_copilot,
  ]);

const resolveToAnac = (input: string | undefined, airports: any[]) => {
    if (!input) return '';
    const search = input.trim().toUpperCase();
    
    // Fallback manual prioritario por seguridad
    if (search === "AEP" || search === "SABE") return "AER";
    if (search === "CNQ" || search === "SARC") return "CRR";
    if (search === "BRC" || search === "SAZS") return "BAR";
    if (search === "PSS" || search === "SARP") return "POS";
    
    // Look in dbAirports (Supabase)
    const found = airports.find(a => 
      (a.anac_code && a.anac_code.toUpperCase() === search) || 
      (a.key_code && a.key_code.toUpperCase() === search) || 
      (a.icao_code && a.icao_code.toUpperCase() === search) || 
      (a.iata_code && a.iata_code.toUpperCase() === search)
    );
    
    if (found) return found.anac_code || found.key_code || found.iata_code || search;
    
    // Fallback to local IATA_AIRPORTS (mostly used for initial setup/demo)
    const localFound = Object.entries(IATA_AIRPORTS).find(([icao, info]) => 
      icao.toUpperCase() === search || info.iata.toUpperCase() === search
    );
    
    if (localFound) {
      const icao = localFound[0] as string;
      const iata = localFound[1].iata;
      if (iata === "AEP") return "AER";
      if (iata === "CNQ") return "CRR";
      if (iata === "BRC") return "BAR";
      if (iata === "PSS") return "POS";
      if (!icao.startsWith("SA")) return icao;
      return iata;
    }

    return search;
  };

  const fetchAnacLogs = async (tokenOverride?: string, sessionOverride?: any) => {
    const tokenToUse = tokenOverride || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) return [];
    try {
      const response = await fetch(getApiUrl('/api/get-anac-logs'), {
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
    const remoteLogs = await fetchAnacLogs(tokenToUse, sessionToUse);
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

    setPendingLogs(missing);
    setIsComparing(false);
    if (missing.length === 0) {
      setSyncStatus({ message: 'Todos tus vuelos ya están en el portal de ANAC.', type: 'success' });
      
      // Si todo está sincronizado, actualizamos la fecha de última sincronización al último vuelo local
      if (logs.length > 0 && profile?.id) {
        const latestFlight = logs.reduce((prev, current) => {
          const d1 = new Date(prev.fechaHoraSalida).getTime();
          const d2 = new Date(current.fechaHoraSalida).getTime();
          return d2 > d1 ? current : prev;
        });
        
        try {
          await supabase
            .from('profiles')
            .update({ last_synced_flight_at: latestFlight.fechaHoraSalida })
            .eq('id', profile.id);
            
          refreshData();
        } catch (err) {
          console.error("Error silencioso actualizando última sincronización:", err);
        }
      }
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
    const mappedLogsToSync = (logsToSyncOverride || logs).map(l => {
      const mapAirportCode = (code: string) => {
        const c = (code || "").trim().toUpperCase();
        if (!c) return c;
        
        // Fallback manual prioritario por seguridad
        if (c === "AEP" || c === "SABE") return "AER";
        if (c === "CNQ" || c === "SARC") return "CRR";
        if (c === "BRC" || c === "SAZS") return "BAR";
        if (c === "PSS" || c === "SARP") return "POS";
        
        // Buscar coincidencia en la base de datos de aeropuertos (por IATA, OACI/ICAO o ANAC/key_code)
        const airport = dbAirports.find(a => 
          (a.iata_code && a.iata_code.toUpperCase() === c) || 
          (a.icao_code && a.icao_code.toUpperCase() === c) || 
          (a.anac_code && a.anac_code.toUpperCase() === c) ||
          (a.key_code && a.key_code.toUpperCase() === c)
        );
        
        // Si encontramos el aeropuerto y tiene un anac_code o key_code definido, lo usamos.
        if (airport) {
          return airport.anac_code || airport.key_code || c;
        }
        
        // Fallback a IATA_AIRPORTS
        const localFound = Object.entries(IATA_AIRPORTS).find(([icao, info]) =>
          icao.toUpperCase() === c || info.iata.toUpperCase() === c
        );
        if (localFound) {
          const icao = localFound[0];
          const iata = localFound[1].iata;
          if (iata === "AEP") return "AER";
          if (iata === "CNQ") return "CRR";
          if (iata === "BRC") return "BAR";
          if (iata === "PSS") return "POS";
          if (!icao.startsWith("SA")) return icao.toUpperCase();
          return iata;
        }
        
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
      const response = await fetch(getApiUrl('/api/sync-anac'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: profile.id, anac_token: tokenToUse, storageState: sessionToUse, logs_to_sync: mappedLogsToSync })
      });
      const data = await response.json();
      if (response.ok) {
        setSyncStatus({ message: 'Sincronización finalizada.', type: 'success' });
        
        // Actualizar fecha de última sincronización en el perfil
        if (mappedLogsToSync.length > 0 && profile?.id) {
          const latestFlight = mappedLogsToSync.reduce((prev, current) => {
            const d1 = new Date(prev.fechaHoraSalida).getTime();
            const d2 = new Date(current.fechaHoraSalida).getTime();
            return d2 > d1 ? current : prev;
          });
          
          await supabase
            .from('profiles')
            .update({ last_synced_flight_at: latestFlight.fechaHoraSalida })
            .eq('id', profile.id);
            
          refreshData();
        }
      }
      else setSyncStatus({ message: `Error: ${data.error}`, type: 'error' });
    } catch (e) {
      setSyncStatus({ message: 'Error de conexión.', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const resetDatabase = async () => {
    if (!supabase || !profile || logs.length === 0) return;

    // 1. Verificar sincronización con ANAC
    const latestLocalFlight = logs.reduce((prev, current) => {
      const d1 = new Date(prev.fechaHoraSalida).getTime();
      const d2 = new Date(current.fechaHoraSalida).getTime();
      return d2 > d1 ? current : prev;
    });

    const performReset = async () => {
      try {
        setIsSavingProfile(true);
        setSyncStatus({ message: 'Procesando totales y restableciendo base de datos...', type: 'info' });

        const newTotals: any = {
          total_airfield_day_pilot: (Number(profile.total_airfield_day_pilot) || 0) + logs.reduce((s, l) => s + (Number(l.airfield_day_pilot) || 0), 0),
          total_airfield_day_copilot: (Number(profile.total_airfield_day_copilot) || 0) + logs.reduce((s, l) => s + (Number(l.airfield_day_copilot) || 0), 0),
          total_airfield_night_pilot: (Number(profile.total_airfield_night_pilot) || 0) + logs.reduce((s, l) => s + (Number(l.airfield_night_pilot) || 0), 0),
          total_airfield_night_copilot: (Number(profile.total_airfield_night_copilot) || 0) + logs.reduce((s, l) => s + (Number(l.airfield_night_copilot) || 0), 0),
          total_cross_country_day_pilot: (Number(profile.total_cross_country_day_pilot) || 0) + logs.reduce((s, l) => s + (Number(l.cross_country_day_pilot) || 0), 0),
          total_cross_country_day_copilot: (Number(profile.total_cross_country_day_copilot) || 0) + logs.reduce((s, l) => s + (Number(l.cross_country_day_copilot) || 0), 0),
          total_cross_country_night_pilot: (Number(profile.total_cross_country_night_pilot) || 0) + logs.reduce((s, l) => s + (Number(l.cross_country_night_pilot) || 0), 0),
          total_cross_country_night_copilot: (Number(profile.total_cross_country_night_copilot) || 0) + logs.reduce((s, l) => s + (Number(l.cross_country_night_copilot) || 0), 0),
          total_landings: (Number(profile.total_landings) || 0) + logs.reduce((s, l) => s + (Number(l.aterrizajes) || 0), 0),
          total_instruction_time: (Number(profile.total_instruction_time) || 0) + logs.reduce((s, l) => s + (Number(l.instruccion) || 0), 0),
          total_multi_engine: (Number(profile.total_multi_engine) || 0) + logs.reduce((s, l) => s + (Number(l.multi_engine) || 0), 0),
          total_jet: (Number(profile.total_jet) || 0) + logs.reduce((s, l) => s + (Number(l.jet) || 0), 0),
          total_turboprop: (Number(profile.total_turboprop) || 0) + logs.reduce((s, l) => s + (Number(l.turboprop) || 0), 0),
          total_ag_application: (Number(profile.total_ag_application) || 0) + logs.reduce((s, l) => s + (Number(l.ag_application) || 0), 0),
          total_ifr_real_pilot: (Number(profile.total_ifr_real_pilot) || 0) + logs.reduce((s, l) => s + (Number(l.ifr_real_pilot) || 0), 0),
          total_ifr_real_copilot: (Number(profile.total_ifr_real_copilot) || 0) + logs.reduce((s, l) => s + (Number(l.ifr_real_copilot) || 0), 0),
          total_ifr_hood: (Number(profile.total_ifr_hood) || 0) + logs.reduce((s, l) => s + (Number(l.ifr_hood) || 0), 0),
          total_sim_instructor: (Number(profile.total_sim_instructor) || 0) + logs.reduce((s, l) => s + (Number(l.sim_instructor) || 0), 0),
          total_sim_student: (Number(profile.total_sim_student) || 0) + logs.reduce((s, l) => s + (Number(l.sim_student) || 0), 0),
          initial_folio_number: (Number(profile.initial_folio_number) || 1) + 1,
        };

        newTotals.grand_total_hours = (Number(profile.initial_total_hours) || 0) + 
          newTotals.total_airfield_day_pilot + newTotals.total_airfield_day_copilot +
          newTotals.total_airfield_night_pilot + newTotals.total_airfield_night_copilot +
          newTotals.total_cross_country_day_pilot + newTotals.total_cross_country_day_copilot +
          newTotals.total_cross_country_night_pilot + newTotals.total_cross_country_night_copilot +
          newTotals.total_instruction_time + newTotals.total_sim_instructor + newTotals.total_sim_student;

        const { error: updateError } = await supabase
          .from('profiles')
          .update(newTotals)
          .eq('id', profile.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('flight_logs')
          .delete()
          .eq('user_id', profile.id);

        if (deleteError) throw deleteError;

        setSyncStatus({ message: '¡Base de datos restablecida con éxito!', type: 'success' });
        await refreshData();
        setLogs([]);
      } catch (err: any) {
        console.error("Reset error:", err);
        setSyncStatus({ message: 'Error: ' + err.message, type: 'error' });
      } finally {
        setIsSavingProfile(false);
      }
    };

    const confirmFinal = () => {
      askConfirm(
        "Confirmación Final",
        "Se borrarán todos los registros locales y se sumarán a los totales de su perfil. Recuerde descargar sus hojas del libro en PDF antes de continuar, ya que una vez restablecida la base de datos ya no será posible. ¿Desea continuar?",
        performReset,
        'danger'
      );
    };

    if (profile.last_synced_flight_at) {
      const lastSync = new Date(profile.last_synced_flight_at).getTime();
      const lastLocal = new Date(latestLocalFlight.fechaHoraSalida).getTime();
      
      if (lastLocal > lastSync) {
        askConfirm(
          "Vuelos sin Sincronizar",
          "Hay registros más nuevos en tu historial que aún no han sido sincronizados con ANAC. ¿Deseas continuar con el restablecimiento de todos modos?",
          confirmFinal,
          'warning'
        );
        return;
      }
    } else {
      askConfirm(
        "Sincronización Pendiente",
        "No se encontró registro de sincronización previa con ANAC o tus registros actuales son más nuevos. ¿Deseas continuar con el restablecimiento?",
        confirmFinal,
        'warning'
      );
      return;
    }

    confirmFinal();
  };

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  OFFLINE QUEUE: Procesa operaciones pendientes                  ║
  // ╚══════════════════════════════════════════════════════════════════╝
  const processQueue = async () => {
    if (!supabase || isSyncingQueue) return;
    setIsSyncingQueue(true);

    const queue = getQueue();
    if (queue.length === 0) { setIsSyncingQueue(false); return; }

    const insertedIds: string[] = [];

    for (const op of queue) {
      if (op.type === 'insert') {
        try {
          const { data: existing } = await supabase
            .from('flight_logs')
            .select('id')
            .eq('user_id', op.data.user_id)
            .eq('fechaHoraSalida', op.data.fechaHoraSalida)
            .eq('fechaHoraLlegada', op.data.fechaHoraLlegada)
            .eq('origenID', op.data.origenID)
            .eq('destinoID', op.data.destinoID)
            .maybeSingle();

          if (existing) {
            removeFromQueue(op.localId);
            insertedIds.push(op.localId);
            continue;
          }

          const { error } = await supabase.from('flight_logs').insert([op.data]);
          if (error) {
            op.retryCount++;
            if (op.retryCount >= 5) {
              console.error('[OFFLINE_QUEUE] Abandoning insert after 5 retries:', op.localId);
              removeFromQueue(op.localId);
            }
            continue;
          }

          removeFromQueue(op.localId);
          insertedIds.push(op.localId);
        } catch (err) {
          console.error('[OFFLINE_QUEUE] Error syncing insert:', err);
          op.retryCount++;
          if (op.retryCount >= 5) removeFromQueue(op.localId);
        }
      } else if (op.type === 'update') {
        try {
          const { error } = await supabase.from('flight_logs').update(op.data).eq('id', op.logId);
          if (error) {
            op.retryCount++;
            if (op.retryCount >= 5) {
              console.error('[OFFLINE_QUEUE] Abandoning update after 5 retries:', op.logId);
              removeFromQueue(op.logId);
            }
            continue;
          }
          removeFromQueue(op.logId);
        } catch (err) {
          console.error('[OFFLINE_QUEUE] Error syncing update:', err);
          op.retryCount++;
          if (op.retryCount >= 5) removeFromQueue(op.logId);
        }
      } else if (op.type === 'delete') {
        try {
          const { error } = await supabase.from('flight_logs').delete().eq('id', op.remoteId);
          if (error) {
            op.retryCount++;
            if (op.retryCount >= 5) {
              console.error('[OFFLINE_QUEUE] Abandoning delete after 5 retries:', op.remoteId);
              removeFromQueue(op.remoteId);
            }
            continue;
          }
          removeFromQueue(op.remoteId);
        } catch (err) {
          console.error('[OFFLINE_QUEUE] Error syncing delete:', err);
          op.retryCount++;
          if (op.retryCount >= 5) removeFromQueue(op.remoteId);
        }
      }
    }

    setPendingOps(getQueue());
    await refreshData();
    setIsSyncingQueue(false);
  };

  processQueueRef.current = processQueue;
  refreshDataRef.current = refreshData;

  const saveLog = async () => {
    if (!supabase) return;

    const performSave = async () => {
      // 1. Validaciones básicas
      if (!formData.year || !formData.month || !formData.day) {
        showAlert("Campos Incompletos", "Por favor ingrese una fecha válida.", 'warning');
        return;
      }

      const isSim = formData.tipoVueloID === '3';

      if (!isSim && (!formData.origin_ad || !formData.destination_ad)) {
        showAlert("Ruta Incompleta", "Por favor ingrese aeródromo de origen y destino.", 'warning');
        return;
      }

      if (!isSim && !formData.registration) {
        showAlert("Campo Obligatorio", "Por favor ingrese la matrícula de la aeronave.", 'warning');
        return;
      }

      if (!isSim && !formData.aircraft_model) {
        showAlert("Campo Obligatorio", "Por favor ingrese la marca/modelo de la aeronave.", 'warning');
        return;
      }

      if (!formData.departure_time_utc || formData.departure_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de salida válido (HH:MM).", 'warning');
        return;
      }
      if (!formData.arrival_time_utc || formData.arrival_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de llegada válido (HH:MM).", 'warning');
        return;
      }

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

      if (!isSim && currentSum > (totalRef + 0.01)) {
        showAlert("Error de Tiempos", `La discriminación de horas (${currentSum.toFixed(1)} hs) excede el total del vuelo (${totalRef.toFixed(1)} hs).`, 'danger');
        return;
      }

      // 2. Cálculos de metadatos (Tipo de Vuelo, Cargo, etc.)
      let flight_type_id = "2"; // Travesia
      
      if (isSim) {
        flight_type_id = "3"; // Simulador
      } else {
        const resolvedOriginCheck = resolveToAnac(formData.origin_ad, dbAirports);
        const resolvedDestCheck = resolveToAnac(formData.destination_ad, dbAirports);
        if (resolvedOriginCheck && resolvedDestCheck && resolvedOriginCheck === resolvedDestCheck) {
          flight_type_id = "1"; // Local
        }
      }

      let determined_cargo_id = "1"; // Piloto
      if (isSim) {
        determined_cargo_id = formData.cargoID || "6";
      } else {
        const hasPilotHours = (
          Number(formData.airfield_day_pilot || 0) > 0 ||
          Number(formData.airfield_night_pilot || 0) > 0 ||
          Number(formData.cross_country_day_pilot || 0) > 0 ||
          Number(formData.cross_country_night_pilot || 0) > 0 ||
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
        if (hasCopilotHours && !hasPilotHours) determined_cargo_id = "2";
      }

      // 3. Preparación de datos y Timestamps
      const buildISO = (y: number, mon: number, d: number, timeStr: string, isNextDay: boolean = false) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(Date.UTC(y, mon - 1, d, h || 0, m || 0));
        if (isNextDay) date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString();
      };

      if (!userId) {
        showAlert("Sesión Expirada", "Por favor inicie sesión nuevamente.", 'danger');
        return;
      }

      const resolvedOrigin = isSim ? (formData.registration ? "SIM" : "") : resolveToAnac(formData.origin_ad, dbAirports);
      const resolvedDest = isSim ? (formData.registration ? "SIM" : "") : resolveToAnac(formData.destination_ad, dbAirports);
      const crossesMidnight = (formData.arrival_time_utc || "") < (formData.departure_time_utc || "");

      const checkSalida = buildISO(formData.year!, formData.month!, formData.day!, formData.departure_time_utc!);
      const checkLlegada = buildISO(formData.year!, formData.month!, formData.day!, formData.arrival_time_utc!, crossesMidnight);

      // 4. Verificación de Duplicados/Superposiciones
      const checkSalidaMs = new Date(checkSalida).getTime();
      const checkLlegadaMs = new Date(checkLlegada).getTime();
      const conflictingLog = logs.find(log => {
        if (editingId && log.id === editingId) return false;
        const logSalidaMs = new Date(log.fechaHoraSalida).getTime();
        const logLlegadaMs = new Date(log.fechaHoraLlegada).getTime();
        const isDuplicate = logSalidaMs === checkSalidaMs && logLlegadaMs === checkLlegadaMs && 
                            log.origenID === resolvedOrigin && log.destinoID === resolvedDest;
        const isOverlapping = checkSalidaMs < logLlegadaMs && checkLlegadaMs > logSalidaMs;
        return isDuplicate || isOverlapping;
      });

      if (conflictingLog) {
        showAlert("Vuelo Superpuesto", "Este horario se superpone con otro vuelo ya registrado.", 'danger');
        return;
      }

      const duration = isSim ? parseFloat(totalRef.toFixed(1)) : 0;

      // 5. Mapeo final y Guardado
      const logToSave: any = {
        user_id: userId,
        fechaHoraSalida: checkSalida,
        fechaHoraLlegada: checkLlegada,
        origenID: resolvedOrigin,
        destinoID: resolvedDest,
        finalidadID: formData.flight_purpose || '78',
        clase: formData.aircraft_class || (isSim ? 'D' : 'MULT-T'),
        matriculaAvion: isSim ? (formData.registration || '') : (formData.registration || '').toUpperCase(),
        Marca_Modelo: formData.aircraft_model || '',
        potencia: isSim ? 0 : Number(formData.power_rating || 0),
        aterrizajes: isSim ? 0 : Number(formData.landings || 1),
        horasDia: isSim ? '0' : (Number(formData.airfield_day_pilot || 0) + Number(formData.airfield_day_copilot || 0) + Number(formData.cross_country_day_pilot || 0) + Number(formData.cross_country_day_copilot || 0)).toString(),
        horasNoche: isSim ? '0' : (Number(formData.airfield_night_pilot || 0) + Number(formData.airfield_night_copilot || 0) + Number(formData.cross_country_night_pilot || 0) + Number(formData.cross_country_night_copilot || 0)).toString(),
        tipoVueloID: flight_type_id,
        cargoID: determined_cargo_id,
        autoridadCertificanteID: formData.certifier_role_id || '2',
        observaciones: formData.certifier_name || '',
        ifr_instrument: isSim ? 0 : Number(formData.ifr_real_pilot || 0) + Number(formData.ifr_real_copilot || 0) + Number(formData.ifr_hood || 0),
        instruccion: isSim ? 0 : Number(formData.instruction_time || 0),
        multi_engine: isSim ? 0 : Number(formData.multi_engine || 0),
        jet: isSim ? 0 : Number(formData.jet || 0),
        turboprop: isSim ? 0 : Number(formData.turboprop || 0),
        ag_application: isSim ? 0 : Number(formData.ag_application || 0),
        folio_number: Number(formData.folio_number || 1),
        airfield_day_pilot: isSim ? 0 : Number(formData.airfield_day_pilot || 0),
        airfield_day_copilot: isSim ? 0 : Number(formData.airfield_day_copilot || 0),
        airfield_night_pilot: isSim ? 0 : Number(formData.airfield_night_pilot || 0),
        airfield_night_copilot: isSim ? 0 : Number(formData.airfield_night_copilot || 0),
        cross_country_day_pilot: isSim ? 0 : Number(formData.cross_country_day_pilot || 0),
        cross_country_day_copilot: isSim ? 0 : Number(formData.cross_country_day_copilot || 0),
        cross_country_night_pilot: isSim ? 0 : Number(formData.cross_country_night_pilot || 0),
        cross_country_night_copilot: isSim ? 0 : Number(formData.cross_country_night_copilot || 0),
        ifr_real_pilot: isSim ? 0 : Number(formData.ifr_real_pilot || 0),
        ifr_real_copilot: isSim ? 0 : Number(formData.ifr_real_copilot || 0),
        ifr_hood: isSim ? 0 : Number(formData.ifr_hood || 0),
        sim_instructor: isSim && determined_cargo_id === '3' ? duration : 0,
        sim_student: isSim && determined_cargo_id === '6' ? duration : 0
      };

      setIsSavingProfile(true);

      // ── OFFLINE: guardar en cola local ────────────────────────────────
      if (!navigator.onLine) {
        if (editingId) {
          addToQueue({ type: 'update', logId: editingId, data: logToSave, createdAt: new Date().toISOString(), retryCount: 0 });
          // Actualizar local state con datos editados
          setLogs(prev => prev.map(l => l.id === editingId ? { ...l, ...logToSave, id: editingId } : l));
        } else {
          const localId = crypto.randomUUID();
          addToQueue({ type: 'insert', localId, data: logToSave, createdAt: new Date().toISOString(), retryCount: 0 });
          // Agregar entry optimista al state
          const optimisticEntry: any = { ...logToSave, id: localId, _pending: true };
          setLogs(prev => [optimisticEntry, ...prev]);
        }

        setPendingOps(getQueue());
        localStorage.setItem('saved_flight_purpose', formData.flight_purpose || '78');
        localStorage.setItem('saved_aircraft_model', formData.aircraft_model || '');
        localStorage.setItem('saved_power_rating', String(formData.power_rating || '0'));
        localStorage.setItem('saved_certifier_name', formData.certifier_name || '');
        localStorage.setItem('saved_certifier_role_id', formData.certifier_role_id || '2');
        setFormData(getInitialFormState());
        setEditingId(null);
        setActiveTab('dashboard');
        showAlert("Guardado Local", "El vuelo se guardó localmente y se sincronizará automáticamente cuando tengas conexión.", 'info');
        setIsSavingProfile(false);
        return;
      }

      // ── ONLINE: guardar directo en Supabase ────────────────────────────
      try {
        let updatedLogs: FlightLog[];
        if (editingId) {
          const { error } = await supabase.from('flight_logs').update(logToSave).eq('id', editingId);
          if (error) throw error;
          updatedLogs = logs.map(l => l.id === editingId ? { ...l, ...logToSave } : l);
        } else {
          const { data: insertedData, error } = await supabase.from('flight_logs').insert([logToSave]).select();
          if (error) throw error;
          const newLog = (insertedData?.[0] || logToSave) as FlightLog;
          updatedLogs = [newLog, ...logs];
        }
        setLogs(updatedLogs);
        await syncProfileTotal(updatedLogs);

        localStorage.setItem('saved_flight_purpose', formData.flight_purpose || '78');
        localStorage.setItem('saved_aircraft_model', formData.aircraft_model || '');
        localStorage.setItem('saved_power_rating', String(formData.power_rating || '0'));
        localStorage.setItem('saved_certifier_name', formData.certifier_name || '');
        localStorage.setItem('saved_certifier_role_id', formData.certifier_role_id || '2');

        setFormData(getInitialFormState());
        setEditingId(null);
        setActiveTab('dashboard');
        setSyncStatus({ message: 'Vuelo guardado correctamente.', type: 'success' });
      } catch (err: any) {
        setSyncStatus({ message: 'Error: ' + err.message, type: 'error' });
      } finally {
        setIsSavingProfile(false);
      }
    };

    // Verificación de límites
    if (!editingId && logs.length >= 150) {
      showAlert("Límite Alcanzado", "Llegaste a 150 registros. Por favor restablece tu base de datos.", 'danger');
      return;
    }

    if (!editingId && logs.length >= 120) {
      askConfirm(
        "Límite de Capacidad",
        `Aviso: Estás próximo a alcanzar el límite de 150 registros (tienes ${logs.length}). Al llegar a 150 no podrás guardar más vuelos hasta restablecer la base de datos. ¿Deseas continuar?`,
        performSave,
        'warning'
      );
      return;
    }

    performSave();
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

      const { error } = await supabase
        .from('profiles')
        .upsert(dataToUpsert, { onConflict: 'id' });
      
      if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
      }
      
      // Refresh after saving
      await refreshData();
      showAlert("Perfil Actualizado", "Los cambios en tu perfil han sido guardados correctamente.", 'info');
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showAlert("Error al Actualizar", error.message || 'Ocurrió un problema al guardar los cambios.', 'danger');
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

  const deleteLog = async (log: FlightLog) => {
    const fecha = new Date(log.fechaHoraSalida).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const hora = new Date(log.fechaHoraSalida).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit'
    });
    const route = `${log.origenID} → ${log.destinoID}`;
    
    askConfirm(
      'Eliminar registro',
      `Fecha: ${fecha} ${hora}\nRuta: ${route}\nMatrícula: ${log.matriculaAvion}\n\n⚠️ Si el vuelo ya fue sincronizado con ANAC, deberás eliminar manualmente el registro en el portal de ANAC, ya que la app no elimina datos de ANAC.\n\n¿Estás seguro? Esta acción no se puede deshacer.`,
      async () => {
        if (!supabase) return;
        
        if (!navigator.onLine) {
          addToQueue({ type: 'delete', remoteId: log.id, createdAt: new Date().toISOString(), retryCount: 0 });
          const updatedLogs = logs.filter(l => l.id !== log.id);
          setLogs(updatedLogs);
          setPendingOps(getQueue());
          return;
        }
        
        try {
          const { error } = await supabase
            .from('flight_logs')
            .delete()
            .eq('id', log.id);
            
          if (error) throw error;
          const updatedLogs = logs.filter(l => l.id !== log.id);
          setLogs(updatedLogs);
          await syncProfileTotal(updatedLogs);
        } catch (error) {
          console.error("Error deleting log:", error);
        }
      },
      'danger'
    );
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
    showAlert(
      "Precaución ANAC",
      "Si modificás los datos de un vuelo que ya fue sincronizado con ANAC, se recomienda eliminar el registro original en el portal de ANAC antes de volver a sincronizar, para evitar vuelos duplicados.",
      'info'
    );
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
    localStorage.removeItem('arms_saved_username');
    localStorage.removeItem('arms_saved_password');
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
        const dateA = new Date(a.fechaHoraSalida).getTime();
        const dateB = new Date(b.fechaHoraSalida).getTime();
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
        sim_student: profile?.total_sim_student || 0,
        grand_total_hours: 0
      };

      initialTotals.grand_total_hours = (
        initialTotals.airfield_day_pilot +
        initialTotals.airfield_day_copilot +
        initialTotals.airfield_night_pilot +
        initialTotals.airfield_night_copilot +
        initialTotals.cross_country_day_pilot +
        initialTotals.cross_country_day_copilot +
        initialTotals.cross_country_night_pilot +
        initialTotals.cross_country_night_copilot
      );

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

            t.landings += Number(log.aterrizajes || 0);
            t.grand_total_hours += (hDia + hNoche);
            t.multi_engine += Number((log as any).multi_engine || (log.clase?.includes('MULT') ? (hDia + hNoche) : 0));
            t.jet += Number((log as any).jet || 0);
            t.turboprop += Number((log as any).turboprop || 0);
            t.ag_application += Number((log as any).ag_application || 0);
            t.ifr_real_pilot += Number((log as any).ifr_real_pilot || 0);
            t.ifr_real_copilot += Number((log as any).ifr_real_copilot || 0);
            t.ifr_hood += Number((log as any).ifr_hood || 0);
            t.sim_instructor += Number((log as any).sim_instructor || 0);
            t.sim_student += Number((log as any).sim_student || 0);
            t.instruction_time += Number((log as any).instruction_time || (log as any).instruccion || 0);
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
          ant.sim_instructor.toFixed(1), ant.sim_student.toFixed(1), `${ant.grand_total_hours.toFixed(1)}    Total horas de vuelo de la pagina anterior`
        ]);
        sheet.mergeCells(antRow.number, 1, antRow.number, 6);
        sheet.mergeCells(antRow.number, 7, antRow.number, 10);
        antRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = { top: thickBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
          if (colNumber === 30) {
            cell.font = { size: 6.5, name: 'Arial' };
            cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false, shrinkToFit: true };
            cell.border = { top: thickBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
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

          const isCargo1 = log.cargoID === "1";
          const finalidadLabel = FLIGHT_PURPOSES.find(f => f.key === log.finalidadID)?.sigla || log.finalidadID;

          const isSim = log.tipoVueloID === '3';
          const desdeHasta = isSim ? (log.Marca_Modelo?.split('--')[1]?.trim() || 'SIM') : `${log.origenID} - ${log.destinoID}`;

          const lRow = sheet.addRow([
            depDate.getUTCDate(), depDate.getUTCMonth() + 1, formatTime(log.fechaHoraSalida), desdeHasta, formatTime(log.fechaHoraLlegada),
            finalidadLabel, isSim ? "" : (log.Marca_Modelo || ""), isSim ? "" : log.matriculaAvion, isSim ? "" : (log.potencia || ""), isSim ? "" : (log.clase || ""),
            isLocal && isCargo1 && hDia > 0 ? hDia : "", 
            isLocal && !isCargo1 && hDia > 0 ? hDia : "", 
            isLocal && isCargo1 && hNoche > 0 ? hNoche : "", 
            isLocal && !isCargo1 && hNoche > 0 ? hNoche : "",
            !isLocal && isCargo1 && hDia > 0 ? hDia : "", 
            !isLocal && !isCargo1 && hDia > 0 ? hDia : "", 
            !isLocal && isCargo1 && hNoche > 0 ? hNoche : "", 
            !isLocal && !isCargo1 && hNoche > 0 ? hNoche : "",
            log.aterrizajes || "", 
            (log as any).instruction_time ? Number((log as any).instruction_time).toFixed(1) : "", 
            (log as any).multi_engine ? Number((log as any).multi_engine).toFixed(1) : "", 
            (log as any).jet ? Number((log as any).jet).toFixed(1) : "", 
            (log as any).turboprop ? Number((log as any).turboprop).toFixed(1) : "", 
            (log as any).ag_application ? Number((log as any).ag_application).toFixed(1) : "",
            (log as any).ifr_real_pilot ? Number((log as any).ifr_real_pilot).toFixed(1) : "", 
            (log as any).ifr_real_copilot ? Number((log as any).ifr_real_copilot).toFixed(1) : "", 
            (log as any).ifr_hood ? Number((log as any).ifr_hood).toFixed(1) : "",
            (log as any).sim_instructor ? Number((log as any).sim_instructor).toFixed(1) : "", 
            (log as any).sim_student ? Number((log as any).sim_student).toFixed(1) : "", 
            ""
          ]);
          lRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (colNumber === 1) cell.border.left = thickBorder;
            if (colNumber === 30) cell.border.right = thickBorder;
            cell.alignment = { ...centerMiddle, wrapText: false };
            cell.font = { size: 7.5, name: 'Arial' };
            if (colNumber === 30 && idx === 0) {
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
          sig.sim_instructor.toFixed(1), sig.sim_student.toFixed(1), `${sig.grand_total_hours.toFixed(1)}    Total horas de vuelo de la pagina siguiente`
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
      const endFolio = startFolio + Math.max(0, pages.length - 1);
      const folioRangeLabel = pages.length > 1 ? `Folios_${startFolio}_al_${endFolio}` : `Folio_${startFolio}`;
      const fileName = `Libro_Vuelo_${profile?.last_name || 'Piloto'}_${folioRangeLabel}.xlsx`;
      
      const isMobile = Capacitor.isNativePlatform();
      if (isMobile) {
        try {
          const base64Data = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
          );
          
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          await Share.share({
            title: 'Compartir Libro de Vuelo Excel',
            text: 'Aquí está tu libro de vuelo en formato Excel',
            url: savedFile.uri,
            dialogTitle: 'Compartir Libro de Vuelo'
          });
        } catch (shareErr) {
          console.error("Error al compartir Excel en móvil:", shareErr);
          alert("Error al intentar compartir el archivo");
        }
      } else {
        const excelBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(excelBlob, fileName);
      }
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Error al generar el archivo Excel");
    }
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const exportToPDFWeb = async (folioRangeLabel: string) => {
    if (logs.length === 0) return;
    setIsGeneratingPDF(true);
    try {
      const doc = <FlightLogPDF logs={logs} profile={profile || undefined} />;
      const pdfBlob = await pdf(doc).toBlob();
      const fileName = `Libro_Vuelo_${profile?.last_name || 'Piloto'}_${folioRangeLabel}.pdf`;
      saveAs(pdfBlob, fileName);
    } catch (err) {
      console.error("PDF Web export error:", err);
      showAlert("Error", "Error al generar el archivo PDF", "danger");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const exportToPDFMobile = async (folioRangeLabel: string) => {
    try {
      const doc = <FlightLogPDF logs={logs} profile={profile || undefined} />;
      const pdfBlob = await pdf(doc).toBlob();
      
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const fileName = `Libro_Vuelo_${profile?.last_name || 'Piloto'}_${folioRangeLabel}.pdf`;
          
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache
          });
          
          await Share.share({
            title: 'Compartir Libro de Vuelo PDF',
            text: 'Aquí tienes tu Libro de Vuelo foliado oficial en formato PDF',
            url: savedFile.uri,
            dialogTitle: 'Compartir Libro de Vuelo'
          });
        } catch (shareErr) {
          console.error("Error al compartir PDF en móvil:", shareErr);
          alert("Error al intentar compartir el archivo");
        }
      };
    } catch (err) {
      console.error("PDF Mobile export error:", err);
      alert("Error al generar el archivo PDF");
    }
  };



  // Stats calculation (matching the PDF logic exactly, including copilot fields)
  const totalDayHoursLogs = logs.reduce((acc, log) => {
    const newVal = parseFloat(log.horasDia || '0');
    // If new value is 0 or missing, check old fields for backward compatibility (including copilot)
    const oldVal = (Number((log as any).airfield_day_pilot) || 0) + 
                   (Number((log as any).airfield_day_copilot) || 0) + 
                   (Number((log as any).cross_country_day_pilot) || 0) + 
                   (Number((log as any).cross_country_day_copilot) || 0);
    return acc + (newVal > 0 ? newVal : oldVal);
  }, 0);

  const totalNightHoursLogs = logs.reduce((acc, log) => {
    const newVal = parseFloat(log.horasNoche || '0');
    // If new value is 0 or missing, check old fields for backward compatibility (including copilot)
    const oldVal = (Number((log as any).airfield_night_pilot) || 0) + 
                   (Number((log as any).airfield_night_copilot) || 0) + 
                   (Number((log as any).cross_country_night_pilot) || 0) + 
                   (Number((log as any).cross_country_night_copilot) || 0);
    return acc + (newVal > 0 ? newVal : oldVal);
  }, 0);
  
  const initialDayHours = (profile?.total_airfield_day_pilot || 0) + 
                          (profile?.total_airfield_day_copilot || 0) + 
                          (profile?.total_cross_country_day_pilot || 0) + 
                          (profile?.total_cross_country_day_copilot || 0);
                          
  const initialNightHours = (profile?.total_airfield_night_pilot || 0) + 
                            (profile?.total_airfield_night_copilot || 0) + 
                            (profile?.total_cross_country_night_pilot || 0) + 
                            (profile?.total_cross_country_night_copilot || 0);
  
  const totalDayHoursVal = totalDayHoursLogs + initialDayHours;
  const totalNightHoursVal = totalNightHoursLogs + initialNightHours;
  const totalDayHours = totalDayHoursVal.toFixed(1);
  const totalNightHours = totalNightHoursVal.toFixed(1);
  
  const grandTotalCalculated = (totalDayHoursVal + totalNightHoursVal).toFixed(1);

  const totalIfrHours = logs.reduce((acc, log) => acc + (Number(log.Discriminaciones?.find(d => d.tipoDiscriminacionID === 15)?.hora || 0)), 0);

  // Detailed hour breakdowns for dashboard (logs only, no profile carry-forward)
  const detailStats = {
    pilotDay:     logs.reduce((acc, log) => acc + (Number(log.airfield_day_pilot || 0) + Number(log.cross_country_day_pilot || 0)), 0),
    copilotDay:   logs.reduce((acc, log) => acc + (Number(log.airfield_day_copilot || 0) + Number(log.cross_country_day_copilot || 0)), 0),
    pilotNight:   logs.reduce((acc, log) => acc + (Number(log.airfield_night_pilot || 0) + Number(log.cross_country_night_pilot || 0)), 0),
    copilotNight: logs.reduce((acc, log) => acc + (Number(log.airfield_night_copilot || 0) + Number(log.cross_country_night_copilot || 0)), 0),
    multiEngine:  logs.reduce((acc, log) => acc + Number(log.multi_engine || 0), 0),
    jet:          logs.reduce((acc, log) => acc + Number(log.jet || 0), 0),
    ifrPilot:     logs.reduce((acc, log) => acc + Number(log.ifr_real_pilot || 0), 0),
    ifrCopilot:   logs.reduce((acc, log) => acc + Number(log.ifr_real_copilot || 0), 0),
  };

  const chartData = React.useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const data = [];
    
    for (let i = 2; i >= 0; i--) {
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
        const oldVal = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_day_copilot) || 0) + (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_day_copilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);
      const night = monthLogs.reduce((acc, log) => {
        const newVal = parseFloat(log.horasNoche || '0');
        const oldVal = (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).airfield_night_copilot) || 0) + (Number((log as any).cross_country_night_pilot) || 0) + (Number((log as any).cross_country_night_copilot) || 0);
        return acc + (newVal > 0 ? newVal : oldVal);
      }, 0);
      
      data.push({
        name: months[d.getMonth()],
        diurna: day,
        nocturna: night,
        total: day + night
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
      let valueToSet = totalRef;
      
      // Para campos IFR, restar 0.2 (12 minutos) por defecto
      if (['ifr_real_pilot', 'ifr_real_copilot', 'ifr_hood'].includes(field as string)) {
        // Exclusión mutua: no autocompletar copiloto si hay horas de piloto, ni piloto si hay horas de copiloto
        const pilotHours =
          Number(formData.airfield_day_pilot || 0) + Number(formData.airfield_night_pilot || 0) +
          Number(formData.cross_country_day_pilot || 0) + Number(formData.cross_country_night_pilot || 0);
        const copilotHours =
          Number(formData.airfield_day_copilot || 0) + Number(formData.airfield_night_copilot || 0) +
          Number(formData.cross_country_day_copilot || 0) + Number(formData.cross_country_night_copilot || 0);
        if (field === 'ifr_real_copilot' && pilotHours > 0) return;
        if (field === 'ifr_real_pilot' && copilotHours > 0) return;
        valueToSet = Math.max(0, parseFloat((totalRef - 0.2).toFixed(1)));
      }
      
      setFormData(prev => ({ ...prev, [field]: valueToSet }));
    }
  };

  const isItineraryComplete = formData.tipoVueloID === '3'
    ? !!(formData.departure_time_utc && formData.arrival_time_utc)
    : !!(formData.origin_ad && formData.destination_ad);

  // Exclusión mutua IFR en tiempo real
  const hasPilotFlightHours =
    Number(formData.airfield_day_pilot || 0) > 0 ||
    Number(formData.airfield_night_pilot || 0) > 0 ||
    Number(formData.cross_country_day_pilot || 0) > 0 ||
    Number(formData.cross_country_night_pilot || 0) > 0;

  const hasCopilotFlightHours =
    Number(formData.airfield_day_copilot || 0) > 0 ||
    Number(formData.airfield_night_copilot || 0) > 0 ||
    Number(formData.cross_country_day_copilot || 0) > 0 ||
    Number(formData.cross_country_night_copilot || 0) > 0;

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

        {/* ── Offline Queue Badge ───────────────────────────────────── */}
        {pendingOps.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
            <div className="flex items-center gap-2">
              {isOnline ? <CloudOff size={16} className="text-amber-600 dark:text-amber-400" /> : <WifiOff size={16} className="text-amber-600 dark:text-amber-400" />}
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {pendingOps.length} {pendingOps.length === 1 ? 'cambio pendiente' : 'cambios pendientes'} {isOnline ? '' : '— Sin conexión'}
              </span>
            </div>
            {isOnline && (
              <button
                onClick={processQueue}
                disabled={isSyncingQueue}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
              >
                {isSyncingQueue ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
            )}
          </div>
        )}

        {!isOnline && pendingOps.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl">
            <WifiOff size={14} className="text-slate-400" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Sin conexión a internet</span>
          </div>
        )}

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
              <Card className="text-white border-none shadow-lg" style={{ background: 'linear-gradient(to bottom right, #334155, #0f172a)' }}>
                <CardContent className="pt-6 flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="text-sm font-medium opacity-80 uppercase tracking-wider">HORAS TOTALES</div>
                    <div className="text-[10px] opacity-60">(INICIAL MAS VUELOS CARGADOS)</div>
                    <div className="text-4xl font-black flex items-baseline gap-1 pt-1">
                      {grandTotalCalculated} <span className="text-sm font-bold uppercase">hs</span>
                    </div>
                  </div>
                  <BarChart3 size={40} className="opacity-20" />
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="text-white border-none shadow-lg" style={{ background: 'linear-gradient(to bottom right, #3b82f6, #1d4ed8)' }}>
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

            {/* Detailed Stats Expandable Section */}
            <Card className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <button
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                onClick={() => setShowDetailedStats(prev => !prev)}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-blue-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">Detalle por Categoría</span>
                </div>
                <ChevronRight
                  size={16}
                  className={`text-slate-400 transition-transform duration-300 ${showDetailedStats ? 'rotate-90' : ''}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {showDetailedStats && (
                  <motion.div
                    key="detail-stats"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-3">
                      {/* Day/Night split */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2">Horas Diurnas / Nocturnas</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Piloto Diurno',    value: detailStats.pilotDay,    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
                            { label: 'Copiloto Diurno',  value: detailStats.copilotDay,  color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
                            { label: 'Piloto Nocturno',  value: detailStats.pilotNight,  color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' },
                            { label: 'Copiloto Nocturno',value: detailStats.copilotNight,'color': 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400' },
                          ].map(item => (
                            <div key={item.label} className={`rounded-lg px-3 py-2 flex items-center justify-between ${item.color}`}>
                              <span className="text-[10px] font-semibold uppercase leading-tight">{item.label}</span>
                              <span className="text-sm font-black ml-2 whitespace-nowrap">{item.value.toFixed(1)}<span className="text-[9px] font-normal ml-0.5">h</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Multimotor / Reactor */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-2">Multimotor / Reactor</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Multimotor', value: detailStats.multiEngine, color: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' },
                            { label: 'Reactor / Jet', value: detailStats.jet,       color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400' },
                          ].map(item => (
                            <div key={item.label} className={`rounded-lg px-3 py-2 flex items-center justify-between ${item.color}`}>
                              <span className="text-[10px] font-semibold uppercase leading-tight">{item.label}</span>
                              <span className="text-sm font-black ml-2 whitespace-nowrap">{item.value.toFixed(1)}<span className="text-[9px] font-normal ml-0.5">h</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Instrumental IFR */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2">Instrumental (IFR Real)</div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: 'Instrumental Piloto',   value: detailStats.ifrPilot,   color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:emerald-300' },
                            { label: 'Instrumental Copiloto', value: detailStats.ifrCopilot,  color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:emerald-400' },
                          ].map(item => (
                            <div key={item.label} className={`rounded-lg px-3 py-2 flex items-center justify-between ${item.color}`}>
                              <span className="text-[10px] font-semibold uppercase leading-tight">{item.label}</span>
                              <span className="text-sm font-black ml-2 whitespace-nowrap">{item.value.toFixed(1)}<span className="text-[9px] font-normal ml-0.5">h</span></span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
                <CardDescription>Horas de vuelo por mes</CardDescription>
              </CardHeader>
              <CardContent className="h-[200px] pt-0">
                <ResponsiveContainer width="100%" height={200}>
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
                    <Bar dataKey="nocturna" stackId="hours" fill="#da631e" radius={[4, 4, 0, 0]} minPointSize={0.1}>
                      <LabelList 
                        dataKey="total" 
                        position="top" 
                        fill="#64748b" 
                        fontSize={11} 
                        fontWeight="bold"
                        formatter={(value: number) => value > 0 ? `${value.toFixed(1)} h` : ''} 
                      />
                    </Bar>
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
                  {formData.tipoVueloID !== '3' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="origen">Origen (ANAC/IATA/OACI)</Label>
                      <AirportAutocomplete
                        id="origen"
                        placeholder="Ej: AER o Ciudad"
                        value={formData.origin_ad || ''}
                        onChange={(val: string) => setFormData({...formData, origin_ad: val})}
                        dbAirports={dbAirports}
                        IATA_LIST={IATA_LIST}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destino">Destino (ANAC/IATA/OACI)</Label>
                      <AirportAutocomplete
                        id="destino"
                        placeholder="Ej: EZE o Ciudad"
                        value={formData.destination_ad || ''}
                        onChange={(val: string) => setFormData({...formData, destination_ad: val})}
                        dbAirports={dbAirports}
                        IATA_LIST={IATA_LIST}
                      />
                    </div>
                  </div>
                  )}
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

                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <input
                    type="checkbox"
                    id="is_simulator_checkbox"
                    className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.tipoVueloID === '3'}
                    onChange={e => {
                      const isSim = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        tipoVueloID: isSim ? '3' : '2',
                        aircraft_class: isSim ? 'D' : 'MULT-T',
                        registration: isSim ? '' : prev.registration,
                        aircraft_model: isSim ? '' : prev.aircraft_model,
                        power_rating: isSim ? 0 : prev.power_rating,
                        cargoID: isSim ? '6' : '1'
                      }));
                    }}
                  />
                  <Label htmlFor="is_simulator_checkbox" className="text-sm font-bold cursor-pointer">
                    Adiestrador Terrestre / Simulador
                  </Label>
                </div>

                <Separator />

                {/* Aeronave Section */}
                {/* Aeronave/Simulador Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <PlaneTakeoff size={14} /> {formData.tipoVueloID === '3' ? 'ADIESTRADOR TERRESTRE / SIMULADOR' : 'AERONAVE'}
                  </h4>

                  {formData.tipoVueloID === '3' ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="simulator_select">Simulador</Label>
                        <select
                          id="simulator_select"
                          className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
                          value={formData.registration || ''}
                          onChange={e => {
                            const selectedKey = e.target.value;
                            const selectedName = SIMULATOR_LIST.find(s => s.key === selectedKey)?.value || '';
                            setFormData(prev => ({
                              ...prev,
                              registration: selectedKey,
                              aircraft_model: selectedName
                            }));
                          }}
                        >
                          <option value="">Seleccione un simulador...</option>
                          {SIMULATOR_LIST.map(sim => (
                            <option key={sim.key} value={sim.key}>{sim.value}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="sim_cargo">Cargo en vuelo</Label>
                          <select
                            id="sim_cargo"
                            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
                            value={formData.cargoID || '6'}
                            onChange={e => setFormData({...formData, cargoID: e.target.value})}
                          >
                            <option value="6">Piloto en instrucción</option>
                            <option value="3">Instructor</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="class">Clase</Label>
                          <select
                            id="class"
                            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm"
                            value={formData.aircraft_class || 'D'}
                            onChange={e => setFormData({...formData, aircraft_class: e.target.value})}
                          >
                            <option value="A">Clase A</option>
                            <option value="B">Clase B</option>
                            <option value="C">Clase C</option>
                            <option value="D">Clase D</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}

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
                {formData.tipoVueloID !== '3' ? (
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                              <DecimalInput 
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
                          <Label className={`text-[10px] ${hasCopilotFlightHours ? 'opacity-40' : ''}`}>
                            Real (Piloto){hasCopilotFlightHours ? ' 🚫' : ''}
                          </Label>
                          <DecimalInput 
                            id="ifr_real_pilot"
                            type="number" 
                            step="0.1" 
                            lang="en" 
                            disabled={!isItineraryComplete || hasCopilotFlightHours}
                            value={formData.ifr_real_pilot ?? ''} 
                            onChange={e => setFormData({...formData, ifr_real_pilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                            onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('ifr_real_pilot'); }}
                            onBlur={handleNumericBlur}
                            placeholder={hasCopilotFlightHours ? 'N/A (Copiloto)' : '0'}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className={`text-[10px] ${hasPilotFlightHours ? 'opacity-40' : ''}`}>
                            Real (Copiloto){hasPilotFlightHours ? ' 🚫' : ''}
                          </Label>
                          <DecimalInput 
                            id="ifr_real_copilot"
                            type="number" 
                            step="0.1" 
                            lang="en" 
                            disabled={!isItineraryComplete || hasPilotFlightHours}
                            value={formData.ifr_real_copilot ?? ''} 
                            onChange={e => setFormData({...formData, ifr_real_copilot: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                            onFocus={(e) => { handleNumericFocus(e); autocompleteDiscrimination('ifr_real_copilot'); }}
                            onBlur={handleNumericBlur}
                            placeholder={hasPilotFlightHours ? 'N/A (Piloto)' : '0'}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Capota</Label>
                          <DecimalInput 
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
                          <DecimalInput 
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
                          <DecimalInput 
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
                          <DecimalInput 
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
                          <DecimalInput 
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
                          <DecimalInput 
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
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl space-y-2 mb-2">
                    <h5 className="text-sm font-bold text-blue-800 dark:text-blue-200">Cálculo Automático de Horas</h5>
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      Al tratarse de un adiestrador terrestre / simulador, las horas se calculan de forma automática a partir del itinerario (Salida y Llegada) y se asignan directamente al cargo correspondiente en el libro y en el reporte PDF.
                    </p>
                  </div>
                )}

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
                  const isMobile = Capacitor.isNativePlatform();
                  
                  if (isMobile) {
                    return (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" 
                        disabled={logs.length === 0}
                        onClick={() => exportToPDFMobile(folioRangeLabel)}
                      >
                        <FileDown size={14} /> Generar Folio PDF
                      </Button>
                    );
                  }
                  
                  return (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" 
                      disabled={isGeneratingPDF || logs.length === 0}
                      onClick={() => exportToPDFWeb(folioRangeLabel)}
                    >
                      <FileDown size={14} /> {isGeneratingPDF ? 'Generando...' : 'Generar Folio PDF'}
                    </Button>
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
                    {logs.map((log) => {
                      const isPending = (log as any)._pending === true;
                      return (
                      <TableRow key={log.id} className={isPending ? 'opacity-60' : ''}>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-1.5">
                            {isPending && <ClockIcon size={12} className="text-amber-500 shrink-0" title="Pendiente de sincronización" />}
                            {(() => {
                              const dStr = log.fechaHoraSalida || (log as any).created_at;
                              if (dStr) {
                                const d = new Date(dStr);
                                return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(-2)}`;
                              }
                              const y = (log as any).year;
                              return `${(log as any).day || '--'}/${(log as any).month || '--'}/${y ? y.toString().slice(-2) : '--'}`;
                            })()}
                          </div>
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
                            <span className="text-[10px] font-mono text-emerald-600 dark:emerald-400">
                              {log.fechaHoraLlegada ? log.fechaHoraLlegada.slice(11, 16) : ((log as any).arrival_time_utc?.slice(0,5) || '--:--')}
                            </span>
                            <span className="text-[10px] opacity-60 uppercase ml-1">
                              {log.matriculaAvion || (log as any).registration || 'S/M'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(() => {
                            if (log.tipoVueloID === '3') {
                              const simHours = Number((log as any).sim_instructor || 0) + Number((log as any).sim_student || 0);
                              return (simHours > 0 ? simHours.toFixed(1) : '0.0');
                            }
                            const nH = (parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0'));
                            const oH = (Number((log as any).airfield_day_pilot) || 0) + (Number((log as any).airfield_day_copilot) || 0) + (Number((log as any).airfield_night_pilot) || 0) + (Number((log as any).airfield_night_copilot) || 0) + (Number((log as any).cross_country_day_pilot) || 0) + (Number((log as any).cross_country_day_copilot) || 0) + (Number((log as any).cross_country_night_pilot) || 0) + (Number((log as any).cross_country_night_copilot) || 0);
                            return (nH > 0 ? nH : oH).toFixed(1);
                          })()}h
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => startEditing(log)}>
                              <Edit2 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteLog(log)}>
                              <X size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            {/* Botón Restablecer al final del historial */}
            <div className="pt-6 pb-2 flex justify-center">
              <Button 
                type="button"
                variant="ghost" 
                size="sm" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 gap-2 h-10 px-4 font-bold transition-all duration-200"
                onClick={resetDatabase}
                disabled={logs.length === 0}
              >
                <RefreshCw size={16} className={isSavingProfile ? "animate-spin" : ""} /> 
                Restablecer registros
              </Button>
            </div>
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
                {profile?.subscription_end_date && (
                  <button
                    onClick={onGoToSuscripcion}
                    className="w-full mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 py-2 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors"
                  >
                    Ver suscripción →
                  </button>
                )}
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
                    
                    // Pasar los datos DIRECTAMENTE para evitar el retraso del estado de React
                    setTimeout(() => {
                      setShowSyncDialog(false);
                      compareWithAnac(authCookie.value, session);
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
      {/* Modal de Confirmación Estilizado */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !confirmModal.isAlert && confirmModal.onCancel?.()}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  confirmModal.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' :
                  confirmModal.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' :
                  'bg-blue-50 dark:bg-blue-900/20 text-blue-500'
                }`}>
                  {confirmModal.type === 'danger' ? <AlertTriangle size={32} /> :
                   confirmModal.type === 'warning' ? <AlertCircle size={32} /> :
                   <Info size={32} />}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                {!confirmModal.isAlert && (
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl h-12 font-semibold"
                    onClick={() => confirmModal.onCancel?.()}
                  >
                    {confirmModal.cancelText || 'Cancelar'}
                  </Button>
                )}
                <Button 
                  className={`flex-1 rounded-xl h-12 font-bold text-white shadow-lg ${
                    confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                    confirmModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                    'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                  onClick={confirmModal.onConfirm}
                >
                  {confirmModal.confirmText || 'Aceptar'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
