import React, { useState, useEffect } from 'react';
import { heroBase64 } from './assets/hero-base64';
import { 
  Plane, 
  PlaneTakeoff,
  Calculator, 
  BookOpen, 
  User,
  Users as UsersIcon,
  LayoutDashboard, 
  ArrowLeft, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Bus, 
  Bed,
  Settings,
  Search,
  Share2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  X,
  Moon,
  Sun,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  timeToMinutes, 
  minutesToTime, 
  addMinutes, 
  diffMinutes, 
  getPilotTSMax, 
  getTcpTSMax 
} from './utils/aviation';
import { Screen, CalculationResult, FlightLog, Profile } from './types';
import { LibroScreen } from './components/LibroScreen';
import { AuthScreen } from './components/AuthScreen';
import { AnacAuth } from './components/AnacAuth';
import { ArmsRosterScreen } from './components/ArmsRosterScreen';
import { registerPushNotifications, unregisterPushNotifications } from './utils/push-notifications';
import { supabase } from './utils/supabase/client';
import { User as RawUser } from '@supabase/supabase-js';

// --- Components ---

const PilotIcon = ({ size = 24, className = "", active = false }: { size?: number, className?: string, active?: boolean }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    fill={active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Cap Top */}
    <path d="M6 8.5c0-2.5 3-4 6-4s6 1.5 6 4" />
    {/* Wings on Cap */}
    <path d="M10.5 6.5c0.5-0.3 2.5-0.3 3 0l-1.5 0.5z" />
    {/* Cap Brim */}
    <path d="M5.5 8.5h13l-0.5 1.5c-1 1-3 1.5-6 1.5s-5-0.5-6-1.5z" />
    
    {/* Head */}
    <path d="M12 11.5c-1.8 0-3.2 1.4-3.2 3.2s1.4 3.2 3.2 3.2 3.2-1.4 3.2-3.2-1.4-3.2-3.2-3.2z" />
    
    {/* Shoulders */}
    <path d="M3 21.5c0-2.5 2.5-4.5 5-4.5h8c2.5 0 5 2 5 4.5" />
    
    {/* Epaulettes (4 stripes) */}
    <g strokeWidth="1">
      <path d="M4 18.5l2 0.5" />
      <path d="M4 19.2l2 0.5" />
      <path d="M4 19.9l2 0.5" />
      <path d="M4 20.6l2 0.5" />
      
      <path d="M18 18.5l2 0.5" />
      <path d="M18 19.2l2 0.5" />
      <path d="M18 19.9l2 0.5" />
      <path d="M18 20.6l2 0.5" />
    </g>
    
    {/* Tie */}
    <path d="M12 18l-0.7 1.2 0.7 2.3 0.7-2.3z" />
  </svg>
);

const TcpIcon = ({ size = 24, className = "", active = false }: { size?: number, className?: string, active?: boolean }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    className={className}
    fill={active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Hat - Pillbox style */}
    <path d="M8.5 3h7l0.8 3h-8.6z" />
    {/* V detail on hat */}
    <path d="M10.5 4.2l1.5 1 1.5-1" strokeWidth="0.8" fill="none" />
    <path d="M7.5 6h9v2h-9z" />
    
    {/* Hair - Bob cut silhouette */}
    <path d="M6 14.5c0-4 2.5-6.5 6-6.5s6 2.5 6 6.5v3h-12v-3z" />
    
    {/* Face (eyes and smile) */}
    <g fill="currentColor" stroke="none">
      <circle cx="10.5" cy="13.5" r="0.7" />
      <circle cx="13.5" cy="13.5" r="0.7" />
    </g>
    <path d="M11 15.5c0.3 0.4 1.7 0.4 2 0" fill="none" stroke="currentColor" strokeWidth="0.8" />
    
    {/* Scarf - 4-petal/bow shape */}
    <path d="M12 18.5l-1.2 1.2 1.2 1.2 1.2-1.2z" />
    <path d="M10.8 19.7l1.2-1.2 1.2 1.2-1.2 1.2z" />
    
    {/* Shoulders */}
    <path d="M4 22c0-2 2.5-3.5 8-3.5s8 1.5 8 3.5" />
  </svg>
);

const CustomTimeInput = ({ value, onChange, className = "" }: { value: string, onChange: (val: string) => void, className?: string }) => (
  <div className="relative group">
    <div className={`input-field flex items-center ${className} group-focus-within:ring-2 group-focus-within:ring-[#1152d4] group-focus-within:border-[#1152d4]`}>
      {value}
    </div>
    <input 
      type="time" 
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
      value={value}
      onChange={(e) => onChange(e.target.value)}
      lang="en-GB"
      step="60"
    />
    <Clock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-[#1152d4] transition-colors" size={20} />
  </div>
);

const BottomNav = ({ currentScreen, setScreen }: { currentScreen: Screen, setScreen: (s: Screen) => void }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a2233] border-t border-slate-200 dark:border-[#2d3748] pb-safe-area-inset-bottom z-50 transition-all duration-300">
    <div className="flex max-w-lg mx-auto h-16">
      <button onClick={() => setScreen('home')} className={`nav-item ${currentScreen === 'home' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <LayoutDashboard size={24} />
        <span className="text-[10px] font-medium">Dashboard</span>
      </button>
      <button onClick={() => setScreen('pilotos')} className={`nav-item ${currentScreen === 'pilotos' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <PilotIcon size={24} active={currentScreen === 'pilotos'} />
        <span className="text-[10px] font-medium">Pilotos</span>
      </button>
      <button onClick={() => setScreen('tcp')} className={`nav-item ${currentScreen === 'tcp' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <TcpIcon size={24} active={currentScreen === 'tcp'} />
        <span className="text-[10px] font-medium">TCP</span>
      </button>
      <button onClick={() => setScreen('normas')} className={`nav-item ${currentScreen === 'normas' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <BookOpen size={24} />
        <span className="text-[10px] font-medium">Normas</span>
      </button>
      <button onClick={() => setScreen('libro')} className={`nav-item ${currentScreen === 'libro' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <Plane size={24} className={currentScreen === 'libro' ? 'fill-[#1152d4]/20' : ''} />
        <span className="text-[10px] font-medium">Libro</span>
      </button>
      <button onClick={() => setScreen('roster')} className={`nav-item ${currentScreen === 'roster' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <Calendar size={24} />
        <span className="text-[10px] font-medium">Roster</span>
      </button>
    </div>
  </nav>
);

const Header = ({ title, onBack, darkMode, toggleDarkMode }: { title: string, onBack?: () => void, darkMode: boolean, toggleDarkMode: () => void }) => (
  <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#101622]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#2d3748] px-4 py-4 transition-colors">
    <div className="flex items-center justify-between max-w-lg mx-auto">
      {onBack ? (
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft size={24} className="text-slate-900 dark:text-white" />
        </button>
      ) : (
        <div className="w-10" />
      )}
      <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      <div className="w-10" />
    </div>
  </header>
);

// --- Constants & Data ---

const CHANGELOG_DATA = [
  {
    date: "14 de Mayo, 2026",
    version: "1.3.1",
    items: [
      "Optimización del inicio de sesión automático con el portal ANAC reduciendo los tiempos de espera en la sincronización.",
      "Mejora en la detección temprana de sesión mediante validación dinámica (polling) en lugar de pausas estáticas."
    ]
  },
  {
    date: "11 de Mayo, 2026",
    version: "1.3.0",
    items: [
      "Nueva funcionalidad de 'Restablecer registros': permite consolidar las horas del historial en los totales del perfil y limpiar la base de datos para optimizar el rendimiento.",
      "Validación inteligente de sincronización: el sistema verifica automáticamente el estado con la ANAC antes de permitir el restablecimiento para asegurar la integridad de los datos.",
      "Autocompletado optimizado para IFR: los campos de vuelo por instrumentos ahora sugieren automáticamente el Total - 0.2 hs (12 min) por defecto para agilizar la carga manual.",
      "Gestión proactiva de límites: implementación de avisos de capacidad al alcanzar 120 registros y bloqueo preventivo de carga a los 150 registros."
    ]
  },
  {
    date: "4 de Mayo, 2026",
    version: "1.2.1",
    items: [
      "Incorporación de líneas de corte punteadas en la parte superior e inferior de cada folio del PDF.",
      "Eliminación de la barra gris decorativa en el encabezado del PDF para optimizar la impresión.",
      "Ajuste de precisión en márgenes superiores (6mm) e inferiores (5mm) para facilitar el foliado manual."
    ]
  },
  {
    date: "1 de Mayo, 2026",
    version: "1.2.0",
    items: [
      "Implementación de flujo de sincronización manual y controlada con el portal de la ANAC.",
      "Resolución de error Circular JSON e integración de sesión estricta (bypassing bot-detection).",
      "Ordenamiento cronológico estricto automático de los vuelos para evitar rechazos por fechas en la ANAC.",
      "Nuevo Traductor Inteligente de Aeropuertos (ej. AEP a AER) respaldado por caché de base de datos local offline.",
      "Nueva ventana visual de revisión de 'Vuelos Pendientes' y mensajes dinámicos de éxito tras la sincronización."
    ]
  },
  {
    date: "27 de Abril, 2026",
    version: "1.1.0",
    items: [
      "Eliminación de leyenda informativa sobre sumatoria de columnas en el PDF.",
      "Actualización del Dashboard: ahora muestra totales de horas diurnas y nocturnas por separado.",
      "Personalización de colores en Dashboard y gráficos (Naranja #da631e para horas nocturnas).",
      "Sincronización automática del campo grand_total_hours en la base de datos de Supabase.",
      "Mejora en la experiencia de carga de registros: auto-limpieza de ceros al enfocar campos y auto-completado de tiempos precalculados.",
      "Validación de itinerario: se requiere Origen y Destino antes de habilitar la carga de tiempos de vuelo.",
      "Nombre de archivo PDF dinámico con rango de folios exportados (ej. Folio 47 al 49).",
      "Eliminación de la etiqueta 'PDF' en la lista de últimos registros para una interfaz más limpia."
    ]
  },
  {
    date: "27 de Abril, 2026",
    version: "1.0.9",
    items: [
      "Inclusión de número de FOLIO en la exportación a Excel y libro de vuelo.",
      "Ajuste de anchos de columna en el PDF generado para optimizar el espacio.",
      "Mejora estética en filas de totales del PDF: alineación a la derecha y diseño de flecha punteada.",
      "Consolidación de columnas de fecha (DÍA y MES) y eliminación de líneas verticales internas en totales para mayor limpieza visual."
    ]
  },
  {
    date: "20 de Abril, 2026",
    version: "1.0.8",
    items: [
      "Actualización del Libro de Vuelo PDF para cumplir con las dimensiones oficiales (35.5cm x 16.5cm).",
      "Rediseño completo del esquema de columnas y encabezados del PDF según normativa ANAC.",
      "Implementación de cálculos acumulativos dinámicos por página para 'Totales Página Anterior' y 'Página Siguiente'."
    ]
  },
  {
    date: "18 de Abril, 2026",
    version: "1.0.7",
    items: [
      "Solución definitiva al problema de carga de imagen en entornos de producción (Vercel).",
      "Renombrado de activos críticos para invalidación de caché de servidor.",
      "Mejora en la lógica del Service Worker para evitar el almacenamiento de peticiones fallidas."
    ]
  },
];

const APP_VERSION = CHANGELOG_DATA[0].version;

// --- Screens ---

const HomeScreen = ({ onEnter, onGoToTcp, onViewNorms, onGoToLibro, onGoToRoster, onChangelog, darkMode, toggleDarkMode }: { onEnter: () => void, onGoToTcp: () => void, onViewNorms: () => void, onGoToLibro: () => void, onGoToRoster: () => void, onChangelog: () => void, darkMode: boolean, toggleDarkMode: () => void }) => (
  <div className="flex flex-col h-full bg-white dark:bg-[#101622] text-slate-900 dark:text-white transition-colors">
    <div className="flex items-center p-4 justify-between border-b border-slate-200 dark:border-[#2d3748]">
      <div className="flex items-center gap-2">
        <div className="text-[#1152d4] flex size-10 items-center justify-center">
          <PlaneTakeoff size={30} />
        </div>
        <div className="text-[#1152d4] flex size-10 items-center justify-center">
          <Calculator size={30} />
        </div>
      </div>
      <h2 className="text-lg font-bold flex-1 text-center">Personal flight log</h2>
      <button 
        onClick={toggleDarkMode}
        className="p-2 hover:bg-slate-100 dark:hover:bg-[#2d3748] rounded-full transition-colors"
      >
        {darkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-600" />}
      </button>
    </div>
    
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="p-4">
        <div 
          className="w-full bg-slate-200 dark:bg-slate-800 flex flex-col justify-end overflow-hidden rounded-xl min-h-[45vh] shadow-2xl relative"
        >
          <img 
            src={heroBase64} 
            alt="Dashboard" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#101622] via-transparent to-transparent transition-colors duration-300 pointer-events-none" />
        </div>
      </div>

      <div className="px-6 py-4 flex flex-col items-center text-center">
        <h1 className="text-3xl font-extrabold leading-tight mb-4">
          Calculadora de tiempos de Servicio y Libro de Vuelo
        </h1>
        <p className="text-slate-400 text-base font-normal leading-relaxed max-w-md">
          Libro de vuelo y control de tiempos de Servicio y descansos mínimos según el Anexo I al Decreto 378/2025 (Arg.)
        </p>

        <div className="grid grid-cols-1 gap-4 mt-8 w-full">
          {/* Pilotos */}
          <button 
            onClick={onEnter}
            className="group relative bg-slate-50 dark:bg-[#1a2233] p-5 rounded-2xl border border-slate-200 dark:border-[#2d3748] text-left hover:border-[#1152d4]/50 hover:bg-slate-100 dark:hover:bg-[#2d3748]/80 transition-all flex items-center gap-4 active:scale-95 shadow-sm"
          >
            <div className="bg-[#1152d4]/10 p-3 rounded-xl group-hover:bg-[#1152d4]/20 transition-colors">
              <User className="text-[#1152d4]" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tiempo de Servicio Pilotos</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Tripulación de mando</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-[#1152d4]" />
          </button>

          {/* TCPs */}
          <button 
            onClick={onGoToTcp}
            className="group relative bg-slate-50 dark:bg-[#1a2233] p-5 rounded-2xl border border-slate-200 dark:border-[#2d3748] text-left hover:border-emerald-500/50 hover:bg-slate-100 dark:hover:bg-[#2d3748]/80 transition-all flex items-center gap-4 active:scale-95 shadow-sm"
          >
            <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
              <UsersIcon className="text-emerald-500" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tiempos de Servicio TCPs</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Tripulación de cabina</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500" />
          </button>

          {/* Libro de Vuelo */}
          <button 
            onClick={onGoToLibro}
            className="group relative bg-slate-50 dark:bg-[#1a2233] p-5 rounded-2xl border border-slate-200 dark:border-[#2d3748] text-left hover:border-amber-500/50 hover:bg-slate-100 dark:hover:bg-[#2d3748]/80 transition-all flex items-center gap-4 active:scale-95 shadow-sm"
          >
            <div className="bg-amber-500/10 p-3 rounded-xl group-hover:bg-amber-500/20 transition-colors">
              <BookOpen className="text-amber-500" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Libro de Vuelo Digital</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Registros y exportación</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-amber-500" />
          </button>

          {/* Roster de Vuelo ARMS */}
          <button 
            onClick={onGoToRoster}
            className="group relative bg-slate-50 dark:bg-[#1a2233] p-5 rounded-2xl border border-slate-200 dark:border-[#2d3748] text-left hover:border-violet-500/50 hover:bg-slate-100 dark:hover:bg-[#2d3748]/80 transition-all flex items-center gap-4 active:scale-95 shadow-sm"
          >
            <div className="bg-violet-500/10 p-3 rounded-xl group-hover:bg-violet-500/20 transition-colors">
              <Calendar className="text-violet-500" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Roster de Vuelo ARMS</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Calendario mensual y tramos</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 group-hover:text-violet-500" />
          </button>

          <button 
            onClick={onViewNorms}
            className="group relative bg-slate-50 dark:bg-[#1a2233] p-4 rounded-xl border border-slate-200 dark:border-[#2d3748] text-left hover:bg-slate-100 dark:hover:bg-[#2d3748]/80 transition-all flex items-center gap-3 active:scale-[0.98]"
          >
            <div className="bg-slate-200 dark:bg-slate-700 p-2 rounded-lg">
              <FileText size={16} className="text-slate-600 dark:text-slate-300" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex-1">Normativa Aeronáutica</span>
            <ChevronRight size={14} className="text-slate-400" />
          </button>
        </div>

        <button 
          onClick={onChangelog}
          className="text-slate-500 text-[10px] mt-12 mb-10 hover:text-[#1152d4] transition-colors font-medium tracking-widest uppercase p-4"
        >
          Versión {APP_VERSION} • Desarrollado por Ariel Basseterre
        </button>
      </div>
    </div>
  </div>
);

const PilotCalculator = () => {
  const [horaPresentacion, setHoraPresentacion] = useState(() => {
    return localStorage.getItem('pilot_hora_presentacion') || '08:00';
  });

  const [segmentos, setSegmentos] = useState(() => {
    return localStorage.getItem('pilot_segmentos') || '1-2 Segmentos';
  });

  const [tipoTripulacion, setTipoTripulacion] = useState(() => {
    return localStorage.getItem('pilot_tipo_tripulacion') || 'Mínima';
  });

  const [claseDescanso, setClaseDescanso] = useState(() => {
    return localStorage.getItem('pilot_clase_descanso') || 'Clase 1';
  });

  const [horaCierre, setHoraCierre] = useState(() => {
    return localStorage.getItem('pilot_hora_cierre') || '19:45';
  });

  const [traslado, setTraslado] = useState(() => {
    const saved = localStorage.getItem('pilot_traslado');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('pilot_hora_presentacion', horaPresentacion);
  }, [horaPresentacion]);

  useEffect(() => {
    localStorage.setItem('pilot_segmentos', segmentos);
  }, [segmentos]);

  useEffect(() => {
    localStorage.setItem('pilot_tipo_tripulacion', tipoTripulacion);
  }, [tipoTripulacion]);

  useEffect(() => {
    localStorage.setItem('pilot_clase_descanso', claseDescanso);
  }, [claseDescanso]);

  useEffect(() => {
    localStorage.setItem('pilot_hora_cierre', horaCierre);
  }, [horaCierre]);

  useEffect(() => {
    localStorage.setItem('pilot_traslado', String(traslado));
  }, [traslado]);

  // Dynamic calculations
  const tsMaxMinutes = getPilotTSMax(horaPresentacion, segmentos, tipoTripulacion, claseDescanso);
  const tsMax = minutesToTime(tsMaxMinutes);
  const vencimiento = addMinutes(horaPresentacion, tsMaxMinutes);
  
  const duracionServicioMinutes = diffMinutes(horaPresentacion, horaCierre);
  const duracionServicio = minutesToTime(duracionServicioMinutes);
  
  const descansoMinimoMinutes = Math.max(10 * 60, duracionServicioMinutes);
  const descansoMinimo = minutesToTime(descansoMinimoMinutes);
  
  const formatAvailability = (baseTime: string, waitMinutes: number) => {
    const totalMins = timeToMinutes(baseTime) + waitMinutes;
    const days = Math.floor(totalMins / (24 * 60));
    const time = minutesToTime(totalMins % (24 * 60));
    
    if (days === 0) return `Hoy, ${time}`;
    if (days === 1) return `Mañana, ${time}`;
    return `En ${days} días, ${time}`;
  };

  const proximaDisponibilidad = formatAvailability(horaCierre, (traslado ? 45 : 0) + descansoMinimoMinutes);

  return (
    <div className="max-w-lg mx-auto px-5 py-6 space-y-8 pb-32">
      {/* Inicio de Servicio */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <Clock className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inicio de Servicio</h2>
        </div>
        
        <div className="card space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Hora de Presentación</label>
            <CustomTimeInput 
              value={horaPresentacion}
              onChange={setHoraPresentacion}
              className="pr-12"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Segmentos</label>
            <div className="relative">
              <select 
                className="input-field appearance-none pr-12"
                value={segmentos}
                onChange={(e) => setSegmentos(e.target.value)}
              >
                <option>1-2 Segmentos</option>
                <option>3-4 Segmentos</option>
                <option>5 Segmentos</option>
                <option>6 Segmentos</option>
                <option>7+ Segmentos</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Tipo de Tripulación</label>
            <div className="relative">
              <select 
                className="input-field appearance-none pr-12"
                value={tipoTripulacion}
                onChange={(e) => setTipoTripulacion(e.target.value)}
              >
                <option>Mínima</option>
                <option>Aumentada 3 Pil</option>
                <option>Aumentada 4 Pil</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className={`text-sm font-medium ml-1 transition-colors ${tipoTripulacion === 'Mínima' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
              Clase de Descanso {tipoTripulacion === 'Mínima' && <span className="text-[10px] font-normal italic">(No aplica en caso de tripulación mínima)</span>}
            </label>
            <div className="relative">
              <select 
                className={`input-field appearance-none pr-12 transition-all ${tipoTripulacion === 'Mínima' ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800/50' : ''}`}
                value={claseDescanso}
                onChange={(e) => setClaseDescanso(e.target.value)}
                disabled={tipoTripulacion === 'Mínima'}
              >
                <option>Clase 1</option>
                <option>Clase 2</option>
                <option>Clase 3</option>
              </select>
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${tipoTripulacion === 'Mínima' ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Límites */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <AlertTriangle className="text-red-500" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Límites (Art. 10/11)</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="text-[11px] font-bold text-[#1152d4] uppercase tracking-widest">TS MÁXIMO</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{tsMax}</span>
              <span className="text-sm font-medium text-slate-500">h</span>
            </div>
          </div>
          <div className="card border-red-200 dark:border-red-900/30">
            <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest">VENCIMIENTO</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{vencimiento}</span>
              <span className="text-sm font-medium text-slate-500">h</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <CheckCircle2 className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cierre</h2>
        </div>
        <div className="card space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Fin Tiempo de Servicio Real (On-Block + 30 min)</label>
            <CustomTimeInput 
              value={horaCierre}
              onChange={setHoraCierre}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#101622] rounded-xl border border-slate-200 dark:border-[#2d3748]/50">
            <div className="flex items-center gap-4">
              <div className="bg-[#1152d4]/10 p-2 rounded-lg">
                <Bus className="text-[#1152d4]" size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Traslado (+45 min)</p>
                <p className="text-[11px] text-slate-500">Añadir tiempo de transporte</p>
              </div>
            </div>
            <button 
              onClick={() => setTraslado(!traslado)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 focus:outline-none ${traslado ? 'bg-[#1152d4]' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${traslado ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Descanso */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <Bed className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Descanso (Art. 15)</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-5 card">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Duración Servicio</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{duracionServicio}h</span>
          </div>
          <div className="flex items-center justify-between p-5 bg-[#1152d4]/10 border border-[#1152d4]/30 rounded-2xl">
            <span className="text-sm font-bold text-[#1152d4]">Descanso Mínimo</span>
            <div className="text-right">
              <span className="text-xl font-black text-[#1152d4] italic">{descansoMinimo}h</span>
              <p className="text-[9px] text-[#1152d4]/70 uppercase font-bold">Max de (10h o Servicio)</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">Próxima Disponibilidad</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">{proximaDisponibilidad}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

const TcpCalculator = () => {
  const [horaPresentacion, setHoraPresentacion] = useState(() => {
    return localStorage.getItem('tcp_hora_presentacion') || '08:00';
  });

  const [config, setConfig] = useState(() => {
    return localStorage.getItem('tcp_config') || 'minima';
  });

  const [horaCierre, setHoraCierre] = useState(() => {
    return localStorage.getItem('tcp_hora_cierre') || '23:00';
  });

  const [traslado, setTraslado] = useState(() => {
    const saved = localStorage.getItem('tcp_traslado');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('tcp_hora_presentacion', horaPresentacion);
  }, [horaPresentacion]);

  useEffect(() => {
    localStorage.setItem('tcp_config', config);
  }, [config]);

  useEffect(() => {
    localStorage.setItem('tcp_hora_cierre', horaCierre);
  }, [horaCierre]);

  useEffect(() => {
    localStorage.setItem('tcp_traslado', String(traslado));
  }, [traslado]);

  // Dynamic calculations
  const tsMaxMinutes = getTcpTSMax(config);
  const tsMax = minutesToTime(tsMaxMinutes);
  const vencimiento = addMinutes(horaPresentacion, tsMaxMinutes);
  
  const duracionServicioMinutes = diffMinutes(horaPresentacion, horaCierre);
  const duracionServicio = minutesToTime(duracionServicioMinutes);
  
  const excessMinutes = Math.max(0, duracionServicioMinutes - tsMaxMinutes);
  const descansoMinimoMinutes = (10 * 60) + excessMinutes;
  const descansoMinimo = minutesToTime(descansoMinimoMinutes);

  const formatAvailability = (baseTime: string, waitMinutes: number) => {
    const totalMins = timeToMinutes(baseTime) + waitMinutes;
    const days = Math.floor(totalMins / (24 * 60));
    const time = minutesToTime(totalMins % (24 * 60));
    
    if (days === 0) return `Hoy, ${time}`;
    if (days === 1) return `Mañana, ${time}`;
    return `En ${days} días, ${time}`;
  };

  const proximaDisponibilidad = formatAvailability(horaCierre, (traslado ? 45 : 0) + descansoMinimoMinutes);

  return (
    <div className="max-w-lg mx-auto px-5 py-6 space-y-8 pb-32">
      {/* Inicio de Servicio */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <Clock className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Inicio de Servicio</h2>
        </div>
        
        <div className="card space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Hora de Presentación</label>
            <CustomTimeInput 
              value={horaPresentacion}
              onChange={setHoraPresentacion}
            />
          </div>
          
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Configuración de Tripulación</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'minima', label: 'Mínima (Límite 14h)' },
                { id: 'minima1', label: 'Mínima + 1 (Límite 16h)' },
                { id: 'minima2', label: 'Mínima + 2 (Límite 18h)' }
              ].map((opt) => (
                <label 
                  key={opt.id}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${config === opt.id ? 'border-[#1152d4] bg-[#1152d4]/10' : 'border-slate-200 dark:border-[#2d3748] bg-slate-50 dark:bg-[#101622]/50'}`}
                >
                  <span className={`text-sm ${config === opt.id ? 'text-[#1152d4] dark:text-white font-bold' : 'text-slate-600 dark:text-slate-300'}`}>{opt.label}</span>
                  <input 
                    type="radio" 
                    name="crew-config" 
                    className="sr-only"
                    checked={config === opt.id}
                    onChange={() => setConfig(opt.id)}
                  />
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${config === opt.id ? 'border-[#1152d4]' : 'border-slate-300 dark:border-slate-600'}`}>
                    {config === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-[#1152d4]" />}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Límites */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/20 p-2 rounded-lg">
            <AlertTriangle className="text-red-500" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Límites (Art. 18)</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="text-[11px] font-bold text-[#1152d4] uppercase tracking-widest">TS MÁXIMO</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{tsMax}</span>
              <span className="text-sm font-medium text-slate-500">h</span>
            </div>
          </div>
          <div className="card border-red-200 dark:border-red-900/30">
            <p className="text-[11px] font-bold text-red-500 uppercase tracking-widest">VENCIMIENTO</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{vencimiento}</span>
              <span className="text-sm font-medium text-slate-500">h</span>
            </div>
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <CheckCircle2 className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Cierre</h2>
        </div>
        <div className="card space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Fin Tiempo de Servicio Real (On-Block + 30 min)</label>
            <CustomTimeInput 
              value={horaCierre}
              onChange={setHoraCierre}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#101622] rounded-xl border border-slate-200 dark:border-[#2d3748]/50">
            <div className="flex items-center gap-4">
              <div className="bg-[#1152d4]/10 p-2 rounded-lg">
                <Bus className="text-[#1152d4]" size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Traslado (+45 min)</p>
                <p className="text-[11px] text-slate-500">Añadir tiempo de transporte</p>
              </div>
            </div>
            <button 
              onClick={() => setTraslado(!traslado)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-200 focus:outline-none ${traslado ? 'bg-[#1152d4]' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${traslado ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Descanso */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="bg-[#1152d4]/20 p-2 rounded-lg">
            <Bed className="text-[#1152d4]" size={22} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Descanso (Art. 19)</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-5 card">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Duración Servicio</span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">{duracionServicio}h</span>
          </div>
          <div className="flex items-center justify-between p-5 bg-[#1152d4]/10 border border-[#1152d4]/30 rounded-2xl">
            <span className="text-sm font-bold text-[#1152d4]">Descanso Mínimo</span>
            <div className="text-right">
              <span className="text-xl font-black text-[#1152d4] italic">{descansoMinimo}h</span>
              <p className="text-[9px] text-[#1152d4]/70 uppercase font-bold">10h base + excedente TS</p>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-500">Próxima Disponibilidad</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-500">{proximaDisponibilidad}</span>
          </div>
        </div>
      </section>
    </div>
  );
};

const NormasScreen = ({ onBack }: { onBack: () => void }) => {
  const pdfUrl = "/normativa.pdf";
  const fullPdfUrl = window.location.origin + pdfUrl;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = 'Normativa_Anexo_I.pdf';
    a.click();
  };

  const handleOpenExternal = () => {
    window.open(fullPdfUrl, '_blank');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Normativa Aeronáutica - Anexo I',
          text: 'Consulta el Reglamento Nacional de Gestión de Tripulaciones.',
          url: fullPdfUrl,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      alert('Copiado al portapapeles: ' + fullPdfUrl);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f172a] transition-colors">
      <header className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 transition-colors">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">Normativa - Anexo I</h1>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Reglamento Oficial</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" title="Compartir">
            <Share2 size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 bg-slate-100 dark:bg-slate-950 relative flex flex-col overflow-hidden">
        <div className="flex-1 w-full h-full">
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full"
          >
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white dark:bg-[#1a2233]">
              <BookOpen size={64} className="mb-6 text-slate-300 dark:text-slate-700" />
              <h3 className="text-slate-900 dark:text-white font-bold mb-2">Previsualización no disponible</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 max-w-xs">
                Tu dispositivo o navegador no permite ver el PDF aquí. Presiona el botón de abajo para abrirlo.
              </p>
              <button 
                onClick={handleOpenExternal}
                className="bg-[#1152d4] hover:bg-[#1152d4]/90 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-[#1152d4]/20"
              >
                <Search size={20} />
                ABRIR NORMATIVA
              </button>
            </div>
          </object>
        </div>

        <div className="p-4 bg-white dark:bg-[#1a2233] border-t border-slate-200 dark:border-[#2d3748] grid grid-cols-2 gap-3">
          <button 
            onClick={handleOpenExternal}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Search size={16} />
            VER PANTALLA COMPLETA
          </button>
          <button 
            onClick={handleDownload}
            className="bg-[#1152d4] hover:bg-[#1152d4]/90 text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={16} className="rotate-45" />
            DESCARGAR PDF
          </button>
        </div>
      </main>

      <nav className="bg-white dark:bg-[#1a2233] border-t border-slate-200 dark:border-[#2d3748] p-4 flex items-center justify-center pb-safe-area-inset-bottom">
        <button 
          onClick={onBack}
          className="text-slate-500 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest"
        >
          Cerrar Documento
        </button>
      </nav>
    </div>
  );
};

const ChangelogScreen = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
      <Header title="Historial de Cambios" onBack={onBack} darkMode={true} toggleDarkMode={() => {}} />
      <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
        {CHANGELOG_DATA.map((change, idx) => (
          <div key={idx} className="relative pl-6 border-l-2 border-slate-200 dark:border-[#2d3748]">
            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-[#1152d4] border-4 border-white dark:border-[#101622]" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#1152d4] uppercase tracking-wider">{change.date}</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-2 py-1 rounded-md">v{change.version}</span>
            </div>
            <ul className="space-y-2">
              {change.items.map((item, i) => (
                <li key={i} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [user, setUser] = useState<RawUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const fetchData = async (userId: string) => {
    if (!supabase) return null;
    setDataLoading(true);
    let finalProfile: Profile | null = null;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;

      const { data: logsData, error: logsError } = await supabase
        .from('flight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('fechaHoraSalida', { ascending: false });
      
      if (logsError) {
        console.error("Error fetching logs with new schema, trying fallback:", logsError);
        const { data: fallbackLogs } = await supabase
          .from('flight_logs')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (fallbackLogs) setLogs(fallbackLogs);
      } else if (logsData) {
        setLogs(logsData);
      }

      // console.log("Fetching profile from DB for userId:", userId, "email:", authUser?.email);
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error("Supabase profile fetch error:", profileError);
      }
      
      // Fallback: search by email if ID fetch returned nothing
      if (!profileData && authUser?.email) {
        console.log("Profile not found by ID in profiles, trying by email:", authUser.email);
        const { data: emailProfileData, error: emailProfileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();
        
        if (!emailProfileError && emailProfileData) {
          console.log("Profile found by email backup in profiles:", emailProfileData);
          profileData = emailProfileData;
        }
      }

      // console.log("Profile data to be used:", profileData);

      if (profileData && Object.keys(profileData).length > 0) {
        // Record found in profiles table. Merging...
        finalProfile = {
          ...profileData, 
          id: userId,
          email: profileData.email || authUser?.email || '',
          initial_total_hours: profileData.initial_total_hours ?? null,
          initial_folio_number: profileData.initial_folio_number ?? null,
          grand_total_hours: profileData.grand_total_hours ?? null,
          first_name: profileData.first_name || authUser?.user_metadata?.first_name || authUser?.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: profileData.last_name || authUser?.user_metadata?.last_name || authUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        };
        // console.log("Final merged profile with folio:", finalProfile.initial_folio_number);
      } else {
        console.log("No record found in profiles table. Using auth metadata as fallback.");
        // Initialize from auth if no DB record exists yet
        finalProfile = {
          id: userId,
          email: authUser?.email || '',
          first_name: authUser?.user_metadata?.first_name || authUser?.user_metadata?.full_name?.split(' ')[0] || '',
          last_name: authUser?.user_metadata?.last_name || authUser?.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          license: '',
          dni: '',
          legajo: '',
          initial_total_hours: null,
          total_airfield_day_pilot: null,
          total_airfield_day_copilot: null,
          total_airfield_night_pilot: null,
          total_airfield_night_copilot: null,
          total_cross_country_day_pilot: null,
          total_cross_country_day_copilot: null,
          total_cross_country_night_pilot: null,
          total_cross_country_night_copilot: null,
          total_landings: null,
          total_instruction_time: null,
          total_multi_engine: null,
          total_jet: null,
          total_turboprop: null,
          total_ag_application: null,
          total_ifr_real_pilot: null,
          total_ifr_real_copilot: null,
          total_ifr_hood: null,
          total_sim_instructor: null,
          total_sim_student: null,
          initial_folio_number: null,
          grand_total_hours: null
        } as any;
      }
      
      // Safety: If we already have a profile with data, and the new one is 'empty' (meaning no DB record found),
      // we might want to keep the current one to avoid "resetting to empty" while syncing.
      // However, usually Sync implies "get what's in DB".
      // Let's at least log it.
      
      setProfile(finalProfile);
      return finalProfile;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    let lastUserId: string | null = null;

    // Check active session
    supabase?.auth.getSession().then(({ data: { session } }) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      setAuthLoading(false);
      if (activeUser) {
        lastUserId = activeUser.id;
        fetchData(activeUser.id);
        registerPushNotifications(activeUser.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        lastUserId = activeUser.id;
        fetchData(activeUser.id);
        registerPushNotifications(activeUser.id);
      } else {
        if (lastUserId) {
          unregisterPushNotifications(lastUserId);
          lastUserId = null;
        }
        setProfile(null);
        setLogs([]);
      }
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    // Escuchar el evento de notificación tocada para abrir la pantalla de roster
    const handleOpenRoster = () => {
      setScreen('roster');
    };
    window.addEventListener('open-arms-roster', handleOpenRoster);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('open-arms-roster', handleOpenRoster);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen onEnter={() => setScreen('pilotos')} onGoToTcp={() => setScreen('tcp')} onGoToLibro={() => setScreen('libro')} onGoToRoster={() => setScreen('roster')} onViewNorms={() => setScreen('normas')} onChangelog={() => setScreen('changelog')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
      case 'pilotos':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            <Header title="Calculadora de Pilotos" onBack={() => setScreen('home')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            <div className="flex-1 overflow-y-auto">
              <PilotCalculator />
            </div>
          </div>
        );
      case 'tcp':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            <Header title="Calculadora TCP Art. 18" onBack={() => setScreen('home')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            <div className="flex-1 overflow-y-auto">
              <TcpCalculator />
            </div>
          </div>
        );
      case 'normas':
        return <NormasScreen onBack={() => setScreen('home')} />;
      case 'libro':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            <Header title="Libro de Vuelo" onBack={() => setScreen('home')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            <div className="flex-1 overflow-y-auto">
              {!user ? (
                <AuthScreen />
              ) : (
                <LibroScreen 
                  logs={logs} 
                  setLogs={setLogs} 
                  profile={profile} 
                  setProfile={setProfile} 
                  refreshData={() => fetchData(user.id)}
                  loading={dataLoading}
                />
              )}
            </div>
          </div>
        );
      case 'roster':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            <Header title="Mi Roster ARMS" onBack={() => setScreen('home')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
            <div className="flex-1 overflow-y-auto">
              {!user ? (
                <AuthScreen />
              ) : (
                <ArmsRosterScreen userId={user.id} />
              )}
            </div>
          </div>
        );
      case 'changelog':
        return <ChangelogScreen onBack={() => setScreen('home')} />;
      default:
        return <HomeScreen onEnter={() => setScreen('pilotos')} onGoToTcp={() => setScreen('tcp')} onGoToLibro={() => setScreen('libro')} onGoToRoster={() => setScreen('roster')} onViewNorms={() => setScreen('normas')} onChangelog={() => setScreen('changelog')} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />;
    }
  };

  return (
    <div className={`h-screen w-full max-w-lg mx-auto bg-white dark:bg-[#101622] relative overflow-hidden font-sans transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
      
      {screen !== 'normas' && screen !== 'changelog' && <BottomNav currentScreen={screen} setScreen={setScreen} />}
    </div>
  );
}
