// ═══════════════════════════════════════════════════════════════════════════
// ARMS ROSTER SCREEN — Calendario mensual + Detalle diario + Tripulación
// ═══════════════════════════════════════════════════════════════════════════
// Componente principal de visualización del roster extraído de ARMS.
// Diseñado siguiendo las skills de diseño premium del proyecto:
//   - Estética: Dark mode (#101622 base), accent #1152d4
//   - Motion: Spring physics via motion/react (ya instalado)
//   - Tipografía: Geist (ya en package.json)
//   - Layout: Calendario mensual + timeline vertical de tramos
//   - Iconos: lucide-react (ya instalado)
//
// SECCIONES DEL COMPONENTE:
//   A. Vista Mensual     — Grid de 7 columnas con íconos por tipo de día
//   B. Detalle Diario    — Timeline cronológica de tramos de vuelo
//   C. Modal Tripulación — Bottom sheet con crew por roles
//   D. Formulario ARMS   — Input de credenciales (patrón ANAC existente)
//   E. Componente Root   — Orquestador principal
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plane, RefreshCw, Clock, Users, ChevronLeft, ChevronRight,
  Shield, Home, AlertCircle, AlertTriangle, Briefcase, X, Eye, EyeOff, HelpCircle,
  Calendar, CalendarMinus, Loader2, Coffee, ArrowRight, Laptop, WifiOff, CheckCircle2,
  FileText, Download, Settings, MessageCircle
} from 'lucide-react';
import { MisEnlacesModal } from './MisEnlacesModal';
import type { ArmsDayEntry, ArmsFlightLeg, ArmsCrewMember } from '../types';
import { supabase } from '../utils/supabase/client';
import { getApiUrl } from '../utils/api';
import { generateRosterICS } from '../utils/ics';
import { FLIGHT_EVENT_FORMATS, REPORT_EVENT_FORMATS, formatFlightPreview, formatReportPreview } from '../utils/formatCalendar';
import { pdf } from '@react-pdf/renderer';
import { AlmanaquePDF } from './AlmanaquePDF';
import { saveAs } from 'file-saver';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';



// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES Y CONFIGURACIÓN VISUAL
// ═══════════════════════════════════════════════════════════════════════════

/** Configuración visual por rol de tripulación (color + label en español) */
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  CPT:   { label: 'Comandante',          color: 'text-amber-400'   },
  FO:    { label: 'Primer Oficial',      color: 'text-[#1152d4]'   },
  PU:    { label: 'Purser / Comisario',  color: 'text-emerald-400' },
  CC:    { label: 'Tripulante de Cabina',color: 'text-slate-700 dark:text-slate-300'   },
  OTHER: { label: 'Tripulante',          color: 'text-slate-400 dark:text-slate-600 dark:text-slate-400'   },
};

/** Nombres de los meses en español para el selector */
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Labels de días de la semana para el header del calendario */
const DAY_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

/** Animación spring premium para todas las transiciones */
const SPRING_CONFIG = { type: 'spring' as const, stiffness: 200, damping: 24 };


// ═══════════════════════════════════════════════════════════════════════════
// SECCIÓN A: VISTA MENSUAL — Grid de calendario con marcadores
// ═══════════════════════════════════════════════════════════════════════════

const isLeaveEntry = (entry: ArmsDayEntry | null | undefined): boolean => {
  if (!entry) return false;
  return entry.eventType === 'LEAVE' || entry.rawTask?.toUpperCase().startsWith('LEAVE');
};

/**
 * Marcador visual que aparece debajo del número de día.
 * Cada tipo de evento tiene su propio ícono y color:
 *   - Vuelo  → Avión azul (#1152d4)
 *   - OFF    → Casa verde (emerald)
 *   - Standby → Escudo gris
 *   - Layover → Maleta ámbar
 */
function DayMarker({ entry }: { entry: ArmsDayEntry }) {
  if (entry.rawTask?.toUpperCase().startsWith('OTH')) {
    return <HelpCircle size={22} className="text-cyan-400" />;
  }

  if (isLeaveEntry(entry)) {
    return <CalendarMinus size={22} className="text-red-400" />;
  }

  switch (entry.eventType) {
    case 'FLIGHT_OP':
    case 'FLIGHT_DH':
      return <Plane size={22} className="text-[#1152d4] fill-[#1152d4]/30" />;
    case 'OFF':
      return <Home size={22} className="text-emerald-400" />;
    case 'NDA':
      return <Coffee size={22} className="text-purple-400" />;
    case 'GTR':
      return <Laptop size={22} className="text-cyan-400" />;
    case 'STANDBY':
      return <Shield size={22} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />;
    case 'LAYOVER':
      return <Briefcase size={22} className="text-amber-400" />;
    default:
      return null;
  }
}

/**
 * Grid mensual interactivo (7 columnas × N filas).
 *
 * Cada celda muestra:
 *   - Número del día
 *   - Ícono de DayMarker si hay un evento en el roster
 *   - Fondo azul si está seleccionado
 *   - Borde sutil si es el día actual (hoy)
 */
function MonthlyCalendar({
  entries,
  month,
  year,
  selectedDate,
  onSelectDate,
}: {
  entries: ArmsDayEntry[];
  month: number;
  year: number;
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  // Calcular el offset del primer día del mes (0=Domingo)
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const daysInMonth     = new Date(year, month, 0).getDate();
  const startOffset     = firstDayOfMonth.getDay(); // 0=Dom, 1=Lun, ...

  // Crear un mapa rápido: dateISO → entry, para lookup O(1)
  const entriesMap = new Map(entries.map(e => [e.dateISO, e]));

  // Fecha de hoy en ISO local para highlighting
  const todayISO = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayVal}`;
  })();

  return (
    <div className="w-full select-none">
      {/* ── Header: Labels de días de la semana ──────────────────────── */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Grilla de días del mes ───────────────────────────────────── */}
      <div className="grid grid-cols-7 gap-[3px]">
        {/* Celdas vacías antes del día 1 (offset) */}
        {Array.from({ length: startOffset }).map((_, i) => (
          <div key={`offset-${i}`} className="aspect-square" />
        ))}

        {/* Celdas de cada día del mes */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day  = idx + 1;
          const iso  = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entry = entriesMap.get(iso);
          const isSelected = selectedDate === iso;
          const isToday    = iso === todayISO;

          return (
            <motion.button
              key={iso}
              onClick={() => onSelectDate(iso)}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5
                transition-all duration-200 cursor-pointer relative
                ${isSelected
                  ? 'bg-[#1152d4] shadow-[0_0_12px_rgba(17,82,212,0.35)]'
                  : entry
                    ? 'bg-white dark:bg-[#1a2233] hover:bg-slate-50 dark:hover:bg-[#222d40]'
                    : 'hover:bg-white dark:bg-[#1a2233]/50'}
                ${isToday && !isSelected ? 'bg-emerald-500/20 ring-1 ring-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : ''}
              `}
            >
              {/* Número del día */}
              <span className={`text-sm font-bold leading-none ${
                isSelected ? 'text-white' : isToday ? 'text-emerald-400' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {day}
              </span>

              {/* Ícono marcador del tipo de evento */}
              {entry && <DayMarker entry={entry} />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SECCIÓN B: DETALLE DIARIO — Timeline vertical de tramos de vuelo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tarjeta de un tramo (leg) de vuelo dentro de la timeline vertical.
 *
 * Estructura visual:
 *   1. Evento de Presentación (REPORT) — ícono reloj + hora local/UTC
 *   2. Línea vertical punteada (conector)
 *   3. Card del tramo de vuelo — número, ruta, horarios, crew count
 *   4. Turn time (si hay tramo siguiente) — escala HH:MM
 *
 * Al hacer tap en la card del vuelo, dispara onClick para abrir el modal
 * de tripulación con los miembros del crew complement.
 */
function FlightLegCard({
  leg,
  index,
  onClick,
}: {
  leg: ArmsFlightLeg;
  index: number;
  onClick: () => void;
  key?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ...SPRING_CONFIG }}
    >
      {/* ── Evento de Presentación (REPORT) — solo en el primer tramo y si NO es continuación del día anterior ── */}
      {index === 0 && !leg.isContinuation && (
        <div className="flex items-center gap-3 px-4 py-2.5">
          {/* Ícono circular de reloj */}
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-[#1152d4]/10 border border-blue-100 dark:border-[#1152d4]/20 flex items-center justify-center shrink-0">
            <Clock size={14} className="text-[#1152d4]" />
          </div>

          {/* Texto del reporte */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              Presentación
            </p>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {/* Aeropuerto + hora local */}
              {leg.origin} — {leg.reportTimeLoc}L
              {/* Hora UTC (si está disponible) */}
              {leg.reportTimeUtc && (
                <span className="text-slate-500 dark:text-slate-400 font-normal ml-1.5 text-[11px]">
                  ({leg.reportTimeUtc}Z)
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ── Turn time (tiempo en tierra desde el tramo anterior) ─────── */}
      {leg.turnTime && (
        <div className="ml-8 pl-7 border-l border-dashed border-slate-200 dark:border-[#2d3748] flex items-center gap-2 py-2">
          <div className="h-px w-3 bg-[#2d3748]" />
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-0.5">
            <span className="text-[10px] text-amber-400 font-mono font-medium">
              escala {leg.turnTime}
            </span>
          </div>
        </div>
      )}

      {/* ── Línea de timeline + Card del tramo ───────────────────────── */}
      <div className="ml-8 pl-7 border-l border-dashed border-slate-200 dark:border-[#2d3748] py-1">
        <button
          onClick={onClick}
          className="w-full text-left bg-white dark:bg-[#1a2233] hover:bg-slate-50 dark:hover:bg-[#222d40] rounded-2xl p-4 border border-slate-200 dark:border-[#2d3748] hover:border-blue-200 dark:border-[#1152d4]/30 transition-all duration-300 active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            {/* Ícono del avión */}
            <div className="w-9 h-9 rounded-xl bg-blue-50/50 dark:bg-[#1152d4]/15 border border-blue-100 dark:border-[#1152d4]/20 flex items-center justify-center shrink-0 group-hover:bg-[#1152d4]/25 transition-colors">
              <Plane size={15} className="text-[#1152d4]" />
            </div>

            {/* Info del vuelo */}
            <div className="flex-1 min-w-0">
              {/* Número de vuelo + block time */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1152d4] dark:text-amber-500">{leg.flightNumber}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-600">·</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{leg.blockTime}h bloque</span>
              </div>

              {/* Ruta (origen → destino) */}
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {leg.origin} → {leg.destination}
              </p>

              {/* Horarios de salida y llegada (local + UTC) */}
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                {leg.departureTimeLoc}L – {leg.arrivalTimeLoc}L
                {/* Horarios UTC debajo */}
                {leg.departureTimeUtc && leg.arrivalTimeUtc && (
                  <span className="text-slate-800 dark:text-slate-200 font-medium ml-1.5">
                    ({leg.departureTimeUtc}Z – {leg.arrivalTimeUtc}Z)
                  </span>
                )}
              </p>
            </div>

            {/* Contador de tripulación */}
            <div className="flex items-center gap-1.5 shrink-0 transition-opacity">
              <Users size={16} className="text-slate-900 dark:text-slate-100" />
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{leg.crewComplement.length}</span>
            </div>
          </div>
        </button>
      </div>
    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SECCIÓN C: MODAL DE TRIPULACIÓN — Bottom sheet con crew por roles
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modal bottom-sheet que muestra la tripulación asignada a un tramo.
 *
 * Agrupa los miembros por rol aeronáutico:
 *   - CPT (Comandante) — Ámbar
 *   - FO  (Primer Oficial) — Azul (#1152d4)
 *   - PU  (Purser/Comisario) — Emerald
 *   - CC  (Tripulante de Cabina) — Slate
 *
 * Usa motion spring para la animación de entrada/salida (slide up).
 */
function CrewModal({
  crew,
  flightNumber,
  onClose,
}: {
  crew: ArmsCrewMember[];
  flightNumber: string;
  onClose: () => void;
}) {
  // Normalizar roles: detectar LS/RS en el nombre del tripulante
  // para reclasificar miembros con role='OTHER' que en realidad son pilotos
  const normalizedCrew = crew.map(c => {
    if (c.role === 'OTHER' || c.role === 'CC') {
      if (/\(LS\)/i.test(c.name)) return { ...c, role: 'CPT' as const };
      if (/\(RS\)/i.test(c.name)) return { ...c, role: 'FO'  as const };
    }
    return c;
  });

  // Mapa para mostrar LS/RS en lugar de CPT/FO en los badges de vuelo
  const FLIGHT_BADGE: Record<string, { label: string; color: string }> = {
    CPT: { label: 'LS', color: 'text-amber-400' },
    FO:  { label: 'RS', color: 'text-[#1152d4]' },
  };

  // Agrupar: Tripulación de Vuelo (LS primero, luego RS) y Tripulación de Cabina (PU primero)
  const flightCrew = [
    ...normalizedCrew.filter(c => c.role === 'CPT'),
    ...normalizedCrew.filter(c => c.role === 'FO'),
  ];
  const cabinCrew = [
    ...normalizedCrew.filter(c => c.role === 'PU'),
    ...normalizedCrew.filter(c => c.role === 'CC' || c.role === 'OTHER'),
  ];
  const grouped: Record<string, ArmsCrewMember[]> = {
    'TRIPULACIÓN DE VUELO':  flightCrew,
    'TRIPULACIÓN DE CABINA': cabinCrew,
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── Overlay oscuro con blur ──────────────────────────────────── */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Sheet que sube desde abajo ───────────────────────────────── */}
      <motion.div
        className="relative w-full bg-slate-50 dark:bg-[#101622] border-t border-slate-200 dark:border-[#2d3748] rounded-t-3xl p-6 pb-32 max-h-[75vh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Drag handle visual (pill decorativa) */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[#2d3748]" />

        {/* Header del modal */}
        <div className="flex items-center justify-between mb-6 mt-2">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold">
              Tripulación asignada
            </p>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{flightNumber}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2d3748] hover:bg-[#3d4858] flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* ── Listado por roles ───────────────────────────────────────── */}
        <div className="space-y-5">
          {(Object.entries(grouped) as [string, ArmsCrewMember[]][])
            .filter(([, members]) => members.length > 0)
            .map(([role, members], groupIdx) => (
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.06, ...SPRING_CONFIG }}
              >
                {/* Label del grupo */}
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 text-slate-400 dark:text-slate-500">
                  {role}
                </p>

                {/* Miembros del grupo */}
                {members.map((member, memberIdx) => (
                  <div
                    key={`${role}-${memberIdx}`}
                    className="flex items-center gap-3 py-2.5 border-b border-[#1a2233] last:border-0"
                  >
                    {/* Avatar circular — LS/RS para pilotos, rol para cabina */}
                    <div className="w-9 h-9 rounded-full bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] flex items-center justify-center shrink-0">
                      <span className={`text-[10px] font-bold ${
                        FLIGHT_BADGE[member.role]?.color || ROLE_CONFIG[member.role]?.color || 'text-slate-400'
                      }`}>
                        {FLIGHT_BADGE[member.role]?.label || member.role}
                      </span>
                    </div>

                    {/* Nombre del tripulante — sin paréntesis vacíos ni badges de rol */}
                    <span className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-tight">
                      {(member.name || 'Nombre no disponible')
                        .replace(/\s*\((LS|RS|CPT|FO|PU|CC)\)\s*/gi, '')
                        .replace(/\s*\(\s*\)\s*/g, '')
                        .trim()}
                    </span>
                  </div>
                ))}
              </motion.div>
            ))}
        </div>

        {/* Caso: sin tripulación */}
        {crew.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center">
            <Users size={32} className="text-slate-400 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 dark:text-slate-600 dark:text-slate-400">Sin datos de tripulación</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1">
              Asegúrate de activar "Show Crew Complement" al sincronizar.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// SECCIÓN D: FORMULARIO DE CREDENCIALES ARMS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Modal de credenciales para el portal ARMS.
 * Sigue el mismo patrón visual que el flujo de login ANAC existente.
 * Incluye toggle de visibilidad de contraseña y checkbox de "Recordar sesión".
 */
function ArmsCredentialsModal({
  onSubmit,
  onClose,
  loading,
}: {
  onSubmit: (user: string, pass: string, remember: boolean) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [user, setUser]       = useState(() => localStorage.getItem('arms_saved_username') || '');
  const [pass, setPass]       = useState(() => localStorage.getItem('arms_saved_password') || '');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card de credenciales */}
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-5"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-[#1152d4]/10 border border-blue-100 dark:border-[#1152d4]/20 flex items-center justify-center mx-auto mb-3">
            <Calendar size={20} className="text-[#1152d4]" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Portal ARMS</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Ingresá tus credenciales del portal ARMS Crew Portal
          </p>
        </div>

        {/* Input: Usuario */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
            Usuario / Legajo
          </label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Tu usuario de ARMS"
            className="w-full px-4 py-3 bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] outline-none transition-all"
            autoComplete="username"
          />
        </div>

        {/* Input: Contraseña (con toggle de visibilidad) */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
            Contraseña
          </label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Tu contraseña de ARMS"
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:border-[#1152d4] focus:ring-1 focus:ring-[#1152d4] outline-none transition-all"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-300 transition-colors"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Checkbox: Recordar sesión */}
        <label className="flex items-center gap-3 cursor-pointer py-1">
          <button
            type="button"
            onClick={() => setRemember(!remember)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              remember
                ? 'bg-[#1152d4] border-[#1152d4]'
                : 'border-slate-200 dark:border-[#2d3748] bg-transparent'
            }`}
          >
            {remember && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4l3 3 5-6" />
              </svg>
            )}
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-600 dark:text-slate-400">
            Recordar sesión para sincronización automática
          </span>
        </label>

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2d3748] text-sm font-semibold text-slate-400 dark:text-slate-600 dark:text-slate-400 hover:bg-white dark:bg-[#1a2233] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSubmit(user, pass, remember)}
            disabled={!user || !pass || loading}
            className="flex-1 px-4 py-3 rounded-xl bg-[#1152d4] text-sm font-bold text-white hover:bg-[#0e47b5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Conectando...
              </>
            ) : (
              'Sincronizar'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}


interface RosterChange {
  dateISO: string;
  oldActivity: string;
  newActivity: string;
}

const getActivitySummary = (entry: ArmsDayEntry | null | undefined): string => {
  if (!entry) return '—';
  if (isLeaveEntry(entry)) {
    const rawTask = entry.rawTask || '';
    const leaveMatch = rawTask.match(/leave\s*-\s*(.*)/i);
    return `Licencia: ${leaveMatch ? leaveMatch[1].trim() : rawTask}`;
  }
  if (entry.eventType === 'OFF') return 'Libre';
  if (entry.eventType === 'LAYOVER') {
    let s = `Layover (${entry.layoverAirport || '—'})`;
    if (entry.layoverDuration) s += `\nDuración: ${entry.layoverDuration}`;
    return s;
  }
  if (entry.eventType === 'STANDBY') {
    let s = `Guardia: ${entry.rawTask || ''}`;
    if (entry.startTimeLoc && entry.endTimeLoc) s += `\n${entry.startTimeLoc}→${entry.endTimeLoc}`;
    return s;
  }
  if (entry.eventType === 'GTR') {
    let s = `Curso: ${entry.rawTask || 'GTR'}`;
    if (entry.startTimeLoc && entry.endTimeLoc) s += `\n${entry.startTimeLoc}→${entry.endTimeLoc}`;
    return s;
  }
  if (entry.isFlight) {
    const legParts = entry.legs.map(l => {
      let p = `${l.flightNumber || ''}`;
      if (l.origin && l.destination) p += ` ${l.origin}→${l.destination}`;
      if (l.reportTimeLoc) p += ` Pres:${l.reportTimeLoc}`;
      if (l.departureTimeLoc && l.arrivalTimeLoc) p += ` (${l.departureTimeLoc}→${l.arrivalTimeLoc})`;
      if (l.blockTime) p += ` [${l.blockTime}]`;
      return p;
    });
    let s = `Vuelo: ${legParts.join(' · ')}`;
    if (entry.dailyBlockTotal) s += `\nBlock: ${entry.dailyBlockTotal}`;
    const allCrew = entry.legs.flatMap(l => l.crewComplement || []);
    if (allCrew.length > 0) {
      const seen = new Set<string>();
      const crewStr = allCrew.filter(c => { const k = `${c.name}|${c.role}`; if (seen.has(k)) return false; seen.add(k); return true; }).map(c => `${c.name} (${c.role})`).join(', ');
      s += `\nTrip: ${crewStr}`;
    }
    return s;
  }
  return entry.rawTask || entry.eventType || '—';
};

function RosterChangesModal({
  changes,
  onClose,
}: {
  changes: RosterChange[];
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-5 max-h-[85vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="text-center shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <RefreshCw size={22} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cambios en tu Roster</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Se han detectado modificaciones en tu programación para este mes.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-2 space-y-3 pr-1">
          {changes.map((c, idx) => {
            const dateObj = new Date(c.dateISO + 'T12:00');
            const dateStr = dateObj.toLocaleDateString('es-AR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            });
            return (
              <div key={idx} className="bg-white dark:bg-[#1a2233] p-4 rounded-2xl border border-slate-150 dark:border-[#2d3748] space-y-2">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">{dateStr}</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                  <div className="bg-red-500/10 text-red-500 dark:text-red-400 px-3 py-2 rounded-xl text-xs line-through text-center font-medium min-h-[32px] whitespace-pre-wrap leading-tight">
                    {c.oldActivity}
                  </div>
                  <ArrowRight size={14} className="text-slate-400 dark:text-slate-600" />
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-xl text-xs text-center font-bold min-h-[32px] whitespace-pre-wrap leading-tight">
                    {c.newActivity}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1152d4] hover:bg-[#0e47b5] text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98] shrink-0"
        >
          Entendido
        </button>
      </motion.div>
    </motion.div>
  );
}


function OfflineAlert({ onClose }: { onClose: () => void }) {
  const [countdown, setCountdown] = useState(4);
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 text-center"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <WifiOff size={24} className="text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin conexión a internet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            No se puede conectar con el servidor. Verificá tu conexión e intentá de nuevo.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1152d4] hover:bg-[#0e47b5] text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
        >
          Entendido
        </button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right -mb-2">
          cerrando ventana en... {countdown}
        </p>
      </motion.div>
    </motion.div>
  );
}

function TimeoutAlert({ onClose }: { onClose: () => void }) {
  const [countdown, setCountdown] = useState(6);
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 text-center"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <Clock size={24} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">El servidor tardó demasiado</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            La sincronización con ARMS excedió el tiempo de espera. Esto puede pasar si el portal ARMS está lento. Intentá de nuevo en unos minutos.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1152d4] hover:bg-[#0e47b5] text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
        >
          Entendido
        </button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right -mb-2">
          cerrando ventana en... {countdown}
        </p>
      </motion.div>
    </motion.div>
  );
}

function PasswordExpiredAlert({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 text-center"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
          <Shield size={24} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Contraseña expirada en ARMS</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            El portal ARMS requiere que actualices tu contraseña antes de poder acceder al roster.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Ingresá a{' '}
            <a
              href="https://fbz.arms.aero/CREWPORTAL"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1152d4] font-semibold underline"
            >
              fbz.arms.aero/CREWPORTAL
            </a>
            {' '}desde un navegador, actualizá tu contraseña y luego volvé a sincronizar acá.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1152d4] hover:bg-[#0e47b5] text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
        >
          Entendido
        </button>
      </motion.div>
    </motion.div>
  );
}

function NoChangesAlert({ onClose }: { onClose: () => void }) {
  const [countdown, setCountdown] = useState(5);
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 text-center"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
          <CheckCircle2 size={24} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sincronización completada</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            No se detectaron cambios en tu roster para este período.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-3 bg-[#1152d4] hover:bg-[#0e47b5] text-white rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
        >
          Entendido
        </button>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right -mb-2">
          cerrando ventana en... {countdown}
        </p>
      </motion.div>
    </motion.div>
  );
}

function ExportMenuModal({
  onPDF,
  onSubscribe,
  onICS,
  onClose,
}: {
  onPDF: () => void;
  onSubscribe: () => void;
  onICS: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-3"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-1">
          Exportar Roster
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">
          Seleccioná el formato de exportación
        </p>

        <button
          onClick={() => { onICS(); onClose(); }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-[#1152d4]/10 border border-blue-200 dark:border-[#1152d4]/30 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[#1152d4]/20 flex items-center justify-center shrink-0">
            <Calendar size={20} className="text-[#1152d4]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Exportar Calendario (.ICS)</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
              Configurar filtros y descargar archivo .ICS
            </p>
          </div>
        </button>

        <button
          onClick={() => { onPDF(); onClose(); }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Almanaque PDF</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
              Calendario mensual imprimible con todas tus actividades
            </p>
          </div>
        </button>

        <div className="border-t border-slate-200 dark:border-[#2d3748] pt-3">
          <button
            onClick={() => { onSubscribe(); onClose(); }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 active:scale-[0.98] transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center shrink-0">
              <Download size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">Suscribir Calendario</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                Sincronización automática — se actualiza solo al sincronizar el roster
              </p>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center justify-between cursor-pointer py-2 select-none">
    <span className="text-sm text-slate-700 dark:text-slate-300 leading-tight">{label}</span>
    <div className="relative shrink-0">
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-[#1152d4]' : 'bg-slate-300 dark:bg-slate-700'}`} />
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
  </label>
);

const Select = ({ label, value, options, onChange }: { label: string; value: string; options: {value: string; label: string}[]; onChange: (v: string) => void }) => (
  <div className="flex flex-col gap-1 w-full">
    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-lg p-2.5 text-slate-700 dark:text-slate-300 outline-none focus:border-[#1152d4] cursor-pointer"
    >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

function PreferencesModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<any>({
    exportTodayOnwards: false,
    excludeStandby: false,
    excludeDayOff: false,
    excludeLayover: false,
    excludeLeave: false,
    excludeNDA: false,
    excludeGTR: false,
    excludeOTH: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    excludeCrew: false,
    flightEventFormat: "route_flight_times",
    reportEventFormat: "type_info",
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('calendar_settings')
          .eq('id', userId)
          .single();
        if (profile?.calendar_settings) {
          setSettings((prev: any) => ({ ...prev, ...profile.calendar_settings }));
        }
      } catch (err) {
        console.error("Error loading calendar settings:", err);
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, [userId]);

  const handleUpdateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ calendar_settings: settings })
        .eq('id', userId);
      if (error) throw error;
      setSaveSuccess(true);
    } catch (err) {
      console.error("Error saving calendar settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center">
            Preferencias de Calendario
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 py-2 border-y border-slate-200 dark:border-[#2d3748]">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={24} className="text-[#1152d4] animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Filtros de Calendario
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <Toggle label="Exportar solo desde hoy" checked={settings.exportTodayOnwards} onChange={(v) => handleUpdateSetting('exportTodayOnwards', v)} />
                  <Toggle label="Excluir guardias (Standby)" checked={settings.excludeStandby} onChange={(v) => handleUpdateSetting('excludeStandby', v)} />
                  <Toggle label="Excluir días libres (Day Off)" checked={settings.excludeDayOff} onChange={(v) => handleUpdateSetting('excludeDayOff', v)} />
                  <Toggle label="Excluir licencias (Leaves)" checked={settings.excludeLeave} onChange={(v) => handleUpdateSetting('excludeLeave', v)} />
                  <Toggle label="Excluir NDA" checked={settings.excludeNDA} onChange={(v) => handleUpdateSetting('excludeNDA', v)} />
                  <Toggle label="Excluir GTR" checked={settings.excludeGTR} onChange={(v) => handleUpdateSetting('excludeGTR', v)} />
                  <Toggle label="Excluir otros (OTH)" checked={settings.excludeOTH} onChange={(v) => handleUpdateSetting('excludeOTH', v)} />
                  <Toggle label="Excluir tripulación de los eventos" checked={settings.excludeCrew} onChange={(v) => handleUpdateSetting('excludeCrew', v)} />
                  <Toggle label="Excluir escalas (Layover)" checked={settings.excludeLayover} onChange={(v) => handleUpdateSetting('excludeLayover', v)} />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Unificación de Vuelos
                </h4>
                <div className="space-y-3">
                  <Toggle label="Unificar todos los vuelos del día" checked={settings.aggregateFlights} onChange={(v) => handleUpdateSetting('aggregateFlights', v)} />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-700 dark:text-slate-300">Minutos extras post-bloque</span>
                    <input
                      type="number"
                      min="0"
                      value={settings.postFlightMinutes}
                      onChange={(e) => handleUpdateSetting('postFlightMinutes', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 text-center text-xs bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-lg p-1.5 text-slate-700 dark:text-slate-300 outline-none focus:border-[#1152d4]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Vista Previa
                </h4>
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-xl p-3 space-y-1 mb-2">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {formatFlightPreview(settings.flightEventFormat).summary}
                  </p>
                  {formatFlightPreview(settings.flightEventFormat).location && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatFlightPreview(settings.flightEventFormat).location}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatFlightPreview(settings.flightEventFormat).description}
                  </p>
                  <div className="border-t border-slate-200 dark:border-[#2d3748] my-1" />
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {formatReportPreview(settings.reportEventFormat).summary}
                  </p>
                  {formatReportPreview(settings.reportEventFormat).location && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatReportPreview(settings.reportEventFormat).location}
                    </p>
                  )}
                  {formatReportPreview(settings.reportEventFormat).description && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatReportPreview(settings.reportEventFormat).description}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1 italic">
                    Vista previa basada en datos de ejemplo. Se actualiza automáticamente.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Formato de Vuelos
                </h4>
                <div className="mt-2">
                  <Select
                    label="Formato de evento"
                    value={settings.flightEventFormat}
                    options={FLIGHT_EVENT_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                    onChange={(v) => handleUpdateSetting('flightEventFormat', v)}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Formato de Reportes y Actividades
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <Select
                    label="Formato de evento"
                    value={settings.reportEventFormat}
                    options={REPORT_EVENT_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                    onChange={(v) => handleUpdateSetting('reportEventFormat', v)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 flex pt-1">
          <button
            onClick={async () => {
              await handleSaveSettings();
              onClose();
            }}
            disabled={saving}
            className="w-full py-3 text-xs font-bold bg-[#1152d4] hover:bg-[#1152d4]/90 text-white rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <span>Guardar y Cerrar</span>
            )}
          </button>
        </div>

        {saveSuccess && (
          <p className="text-[10px] text-center text-emerald-500 font-semibold animate-pulse">
                      ✓ Preferencias guardadas.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
function ExportICSModal({
  entries,
  month,
  year,
  userId,
  onClose,
}: {
  entries: ArmsDayEntry[];
  month: number;
  year: number;
  userId: string;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<any>({
    exportTodayOnwards: false,
    excludeStandby: false,
    excludeDayOff: false,
    excludeLayover: false,
    excludeLeave: false,
    excludeNDA: false,
    excludeGTR: false,
    excludeOTH: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    excludeCrew: false,
    flightEventFormat: "route_flight_times",
    reportEventFormat: "type_info",
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('calendar_settings')
          .eq('id', userId)
          .single();
        if (profile?.calendar_settings) {
          setSettings((prev: any) => ({ ...prev, ...profile.calendar_settings }));
        }
      } catch (err) {
        console.error("Error loading calendar settings:", err);
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, [userId]);

  const handleUpdateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    if (entries.length === 0) return;
    setExporting(true);
    try {
      const icsContent = generateRosterICS(entries, month, year, settings);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const file = new File([blob], `Roster-ARMS-${month}-${year}.ics`, { type: 'text/calendar' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: `Roster ARMS ${month}/${year}` }).catch(() => {});
        setExporting(false);
        onClose();
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Roster-ARMS-${month}-${year}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting ICS:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center">
            Exportar Calendario (.ICS)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
            Ajustá los filtros antes de exportar
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 py-2 border-y border-slate-200 dark:border-[#2d3748]">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={24} className="text-[#1152d4] animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Filtros
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <Toggle label="Solo desde hoy" checked={settings.exportTodayOnwards} onChange={(v) => handleUpdateSetting('exportTodayOnwards', v)} />
                  <Toggle label="Excluir Standby" checked={settings.excludeStandby} onChange={(v) => handleUpdateSetting('excludeStandby', v)} />
                  <Toggle label="Excluir Day Off" checked={settings.excludeDayOff} onChange={(v) => handleUpdateSetting('excludeDayOff', v)} />
                  <Toggle label="Excluir Leaves" checked={settings.excludeLeave} onChange={(v) => handleUpdateSetting('excludeLeave', v)} />
                  <Toggle label="Excluir NDA" checked={settings.excludeNDA} onChange={(v) => handleUpdateSetting('excludeNDA', v)} />
                  <Toggle label="Excluir GTR" checked={settings.excludeGTR} onChange={(v) => handleUpdateSetting('excludeGTR', v)} />
                  <Toggle label="Excluir OTH" checked={settings.excludeOTH} onChange={(v) => handleUpdateSetting('excludeOTH', v)} />
                  <Toggle label="Excluir tripulación" checked={settings.excludeCrew} onChange={(v) => handleUpdateSetting('excludeCrew', v)} />
                  <Toggle label="Excluir Layover" checked={settings.excludeLayover} onChange={(v) => handleUpdateSetting('excludeLayover', v)} />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Unificación
                </h4>
                <div className="space-y-3">
                  <Toggle label="Unificar vuelos del día" checked={settings.aggregateFlights} onChange={(v) => handleUpdateSetting('aggregateFlights', v)} />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-slate-700 dark:text-slate-300">Minutos extra post-bloque</span>
                    <input
                      type="number"
                      min="0"
                      value={settings.postFlightMinutes}
                      onChange={(e) => handleUpdateSetting('postFlightMinutes', Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-16 text-center text-xs bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-lg p-1.5 text-slate-700 dark:text-slate-300 outline-none focus:border-[#1152d4]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Vista Previa
                </h4>
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-xl p-3 space-y-1 mb-2">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {formatFlightPreview(settings.flightEventFormat).summary}
                  </p>
                  {formatFlightPreview(settings.flightEventFormat).location && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatFlightPreview(settings.flightEventFormat).location}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatFlightPreview(settings.flightEventFormat).description}
                  </p>
                  <div className="border-t border-slate-200 dark:border-[#2d3748] my-1" />
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {formatReportPreview(settings.reportEventFormat).summary}
                  </p>
                  {formatReportPreview(settings.reportEventFormat).location && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatReportPreview(settings.reportEventFormat).location}
                    </p>
                  )}
                  {formatReportPreview(settings.reportEventFormat).description && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatReportPreview(settings.reportEventFormat).description}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1 italic">
                    Vista previa basada en datos de ejemplo.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Formato de Vuelos
                </h4>
                <div className="mt-2">
                  <Select
                    label="Formato de evento"
                    value={settings.flightEventFormat}
                    options={FLIGHT_EVENT_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                    onChange={(v) => handleUpdateSetting('flightEventFormat', v)}
                  />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Formato de Reportes
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <Select
                      label="Formato de evento"
                      value={settings.reportEventFormat}
                      options={REPORT_EVENT_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                      onChange={(v) => handleUpdateSetting('reportEventFormat', v)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            className="w-full py-3 text-sm font-bold bg-[#1152d4] text-white rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {exporting ? (
            <><Loader2 size={14} className="animate-spin" /> Exportando...</>
          ) : (
            <><Download size={14} /> Descargar .ICS</>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Cerrar
        </button>
      </motion.div>
    </motion.div>
  );
}

function ExportPDFModal({
  entries,
  month,
  year,
  userId,
  onExport,
  onClose,
}: {
  entries: ArmsDayEntry[];
  month: number;
  year: number;
  userId: string;
  onExport: (settings?: any) => Promise<void>;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState<any>({
    exportTodayOnwards: false,
    excludeStandby: false,
    excludeDayOff: false,
    excludeLayover: false,
    excludeLeave: false,
    excludeNDA: false,
    excludeGTR: false,
    excludeOTH: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    excludeCrew: false,
    flightEventFormat: "route_flight_times",
    reportEventFormat: "type_info",
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('calendar_settings')
          .eq('id', userId)
          .single();
        if (profile?.calendar_settings) {
          setSettings((prev: any) => ({ ...prev, ...profile.calendar_settings }));
        }
      } catch (err) {
        console.error("Error loading calendar settings for PDF modal:", err);
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, [userId]);

  const handleUpdateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    if (entries.length === 0) return;
    setExporting(true);
    try {
      await onExport(settings);
      onClose();
    } catch (err) {
      console.error("Error exporting PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full max-w-md bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="shrink-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center">
            Almanaque PDF
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
            Ajustá los filtros antes de exportar
          </p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 min-h-0 py-2 border-y border-slate-200 dark:border-[#2d3748]">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={24} className="text-[#1152d4] animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Filtros
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                  <Toggle label="Solo desde hoy" checked={settings.exportTodayOnwards} onChange={(v) => handleUpdateSetting('exportTodayOnwards', v)} />
                  <Toggle label="Excluir Standby" checked={settings.excludeStandby} onChange={(v) => handleUpdateSetting('excludeStandby', v)} />
                  <Toggle label="Excluir Day Off" checked={settings.excludeDayOff} onChange={(v) => handleUpdateSetting('excludeDayOff', v)} />
                  <Toggle label="Excluir Leaves" checked={settings.excludeLeave} onChange={(v) => handleUpdateSetting('excludeLeave', v)} />
                  <Toggle label="Excluir NDA" checked={settings.excludeNDA} onChange={(v) => handleUpdateSetting('excludeNDA', v)} />
                  <Toggle label="Excluir GTR" checked={settings.excludeGTR} onChange={(v) => handleUpdateSetting('excludeGTR', v)} />
                  <Toggle label="Excluir OTH" checked={settings.excludeOTH} onChange={(v) => handleUpdateSetting('excludeOTH', v)} />
                  <Toggle label="Excluir tripulación" checked={settings.excludeCrew} onChange={(v) => handleUpdateSetting('excludeCrew', v)} />
                  <Toggle label="Excluir Layover" checked={settings.excludeLayover} onChange={(v) => handleUpdateSetting('excludeLayover', v)} />
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Vista Previa
                </h4>
                <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-xl p-3 space-y-1 mb-2">
                  <p className="text-[13px] font-semibold text-slate-900 dark:text-white">
                    {formatReportPreview(settings.reportEventFormat).summary}
                  </p>
                  {formatReportPreview(settings.reportEventFormat).location && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatReportPreview(settings.reportEventFormat).location}
                    </p>
                  )}
                  {formatReportPreview(settings.reportEventFormat).description && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {formatReportPreview(settings.reportEventFormat).description}
                    </p>
                  )}
                  <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1 italic">
                    Vista previa basada en datos de ejemplo.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-bold text-[#1152d4] dark:text-blue-400 uppercase tracking-widest border-b border-slate-200 dark:border-[#2d3748]/55 pb-1 mb-2">
                  Formato de Reportes
                </h4>
                <div className="mt-2">
                  <Select
                    label="Formato de evento"
                    value={settings.reportEventFormat}
                    options={REPORT_EVENT_FORMATS.map(f => ({ value: f.value, label: f.label }))}
                    onChange={(v) => handleUpdateSetting('reportEventFormat', v)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || entries.length === 0}
          className="w-full py-3 text-sm font-bold bg-[#1152d4] text-white rounded-xl active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {exporting ? (
            <><Loader2 size={14} className="animate-spin" /> Exportando...</>
          ) : (
            <><Download size={14} /> Descargar PDF</>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Cerrar
        </button>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL TELEGRAM — Vincular cuenta con el bot de avisos de roster ARMS
// ═══════════════════════════════════════════════════════════════════════════
function TelegramLinkModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    if (!code) return;
    const full = `/registrar ${code}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getApiUrl('/api/telegram/generate-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar el código');
      setCode(data.code);
      setExpiresAt(data.expiresAt);
    } catch (e: any) {
      setError(e.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    generate();
  }, [generate]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-sm bg-white dark:bg-[#1a2233] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-sky-100 dark:bg-sky-500/15 text-sky-500 flex items-center justify-center">
            <MessageCircle size={26} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Avisos por Telegram</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Vinculá tu cuenta para recibir avisos cuando cambie tu programación ARMS.
          </p>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="animate-spin" size={16} /> Generando código...
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">{error}</p>
          )}

          {code && (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-sky-300 dark:border-sky-700 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Tu código (30 min)</p>
                <code className="font-mono text-2xl font-bold text-[#1152d4] dark:text-sky-400 break-all">{code}</code>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-left">
                Presioná <b>Start</b> en el bot y enviá este comando:
                <br />
                <code className="font-mono font-semibold break-all">/registrar {code}</code>
              </p>
              <button
                onClick={copyCommand}
                className="w-full h-10 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {copied ? '✅ Comando copiado' : '📋 Copiar comando completo'}
              </button>
              {expiresAt && (
                <p className="text-[11px] text-slate-400">
                  Vence: {new Date(expiresAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <button
                onClick={generate}
                disabled={loading}
                className="w-full h-11 rounded-xl text-sm font-semibold text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 disabled:opacity-50"
              >
                Regenerar código
              </button>

              <a
                href="https://t.me/flightlog_roster_bot"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  window.open('https://t.me/flightlog_roster_bot', '_blank', 'noopener,noreferrer');
                }}
                className="flex items-center justify-center gap-1.5 w-full h-11 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-600/20"
              >
                <MessageCircle size={16} />
                Abrir el bot en Telegram (@flightlog_roster_bot)
              </a>
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30 text-left">
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-1">Recordá</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
              Para que el bot pueda revisar tu roster, sincronizá tu roster en la app marcando <b>"recordar sesión"</b>.
            </p>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full h-12 rounded-xl font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-600/20"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// SECCIÓN E: COMPONENTE ROOT — ArmsRosterScreen
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Componente principal de la pantalla de Roster ARMS.
 *
 * Flujo de datos:
 *   1. Al montar, carga el roster cacheado de Supabase (offline-first)
 *   2. Al pulsar "Sincronizar", abre modal de credenciales (si no hay sesión)
 *   3. Envía POST al backend → scraper → parser → upsert Supabase
 *   4. Actualiza la UI con los nuevos datos
 *
 * El estado selectedDate controla qué día está abierto en el detalle inferior.
 */
export function ArmsRosterScreen({ userId }: { userId: string }) {
  // ── Estado del calendario ─────────────────────────────────────────────
  const today = new Date();
  const [month, setMonth]               = useState(today.getMonth() + 1);
  const [year, setYear]                 = useState(today.getFullYear());
  const [entries, setEntries]           = useState<ArmsDayEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // ── Estado de sincronización ──────────────────────────────────────────
  const [syncing, setSyncing]               = useState(false);
  const [syncError, setSyncError]           = useState<string | null>(null);
  const [lastSynced, setLastSynced]         = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [rosterChanges, setRosterChanges]       = useState<RosterChange[] | null>(null);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);
  const [showNoChangesAlert, setShowNoChangesAlert] = useState(false);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);
  const [showPasswordExpiredAlert, setShowPasswordExpiredAlert] = useState(false);

  // ── Estado del modal de tripulación ───────────────────────────────────
  const [crewModal, setCrewModal] = useState<{
    crew: ArmsCrewMember[];
    flight: string;
  } | null>(null);

  // ── Estado de carga inicial ───────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Estado del menú de exportación ─────────────────────────────────────
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [showICSExport, setShowICSExport] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);

  // ── Estado de modal de enlaces de calendario ──────────────────────────
  const [showTokensModal, setShowTokensModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    return localStorage.getItem('roster_disclaimer_accepted') !== 'true';
  });
  const disclaimerRef = useRef<HTMLDivElement>(null);
  const [disclaimerScrollComplete, setDisclaimerScrollComplete] = useState(false);

  // ── Entrada seleccionada ──────────────────────────────────────────────
  const processedEntries = React.useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
    const result = sorted.map(e => ({
      ...e,
      legs: e.legs.map(l => ({ ...l }))
    }));

    const MAX_CONTINUATION_MINUTES = 13 * 60; // 13 horas

    for (let i = 1; i < result.length; i++) {
      const curr = result[i];
      const prev = result[i - 1];

      if (!curr.isFlight || curr.legs.length === 0) continue;
      if (!prev.isFlight || prev.legs.length === 0) continue;

      const prevDate = new Date(prev.dateISO + 'T00:00:00');
      const currDate = new Date(curr.dateISO + 'T00:00:00');
      const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      if (dayDiff !== 1) continue;

      const prevLastLeg = prev.legs[prev.legs.length - 1];
      const currFirstLeg = curr.legs[0];

      const toMin = (t: string): number => {
        const p = t.split(':').map(Number);
        return (p[0] || 0) * 60 + (p[1] || 0);
      };

      // Si la llegada del día anterior (prev) ocurrió después de su salida, fue el mismo día prev.
      // Si la llegada es numéricamente menor que la salida, cruzó la medianoche (es del día curr).
      const prevLastArrivalMins = toMin(prevLastLeg.arrivalTimeLoc);
      const prevLastDepartureMins = toMin(prevLastLeg.departureTimeLoc);
      const currFirstDepartureMins = toMin(currFirstLeg.departureTimeLoc);

      let diffMins = 0;
      if (prevLastArrivalMins < prevLastDepartureMins) {
        // Ya cruzó la medianoche, ambos eventos ocurrieron el mismo día (curr)
        diffMins = currFirstDepartureMins - prevLastArrivalMins;
      } else {
        // La llegada ocurrió en el día anterior (prev)
        diffMins = (24 * 60 - prevLastArrivalMins) + currFirstDepartureMins;
      }

      // Si por alguna razón da negativo, sumar un día
      if (diffMins < 0) diffMins += 24 * 60;

      if (diffMins <= MAX_CONTINUATION_MINUTES) {
        currFirstLeg.isContinuation = true;
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        currFirstLeg.turnTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return result;
  }, [entries]);

  const selectedEntry = processedEntries.find(e => e.dateISO === selectedDate) || null;

  // ── Estadísticas mensuales calculadas ─────────────────────────────────
  const stats = React.useMemo(() => {
    const timeToMinutes = (t: string): number => {
      const parts = (t || '').split(':').map(Number);
      return (parts[0] || 0) * 60 + (parts[1] || 0);
    };

    const getDurationMinutes = (start: string, end: string): number => {
      let diff = timeToMinutes(end) - timeToMinutes(start);
      if (diff < 0) diff += 24 * 60;
      return diff;
    };

    let flightTimeMins = 0;
    let dutyPeriodMins = 0;
    let flightDuties = 0;
    let offDays = 0;
    let leaves = 0;
    let standby = 0;
    let sicks = 0;
    let training = 0;
    let simulator = 0;

    processedEntries.forEach(e => {
      const isLeave = isLeaveEntry(e);
      if (isLeave) {
        leaves++;
      } else if (e.eventType === 'OFF') {
        offDays++;
      } else if (e.eventType === 'STANDBY') {
        standby++;
      } else if (e.eventType === 'FLIGHT_OP') {
        flightDuties++;
      } else if (e.eventType === 'GTR') {
        training++;
      }

      const taskUpper = (e.rawTask || '').toUpperCase();
      if (taskUpper.includes('SIC') || taskUpper.includes('SICK')) {
        sicks++;
      }
      if (taskUpper.includes('SIM') || taskUpper.includes('SIMULATOR')) {
        simulator++;
      }

      // FT calculation
      if (e.isFlight && e.legs) {
        e.legs.forEach(leg => {
          if (leg.blockTime) {
            flightTimeMins += timeToMinutes(leg.blockTime);
          }
        });
      }

      // DP calculation
      if (e.isFlight && e.legs && e.legs.length > 0) {
        const firstLeg = e.legs[0];
        const lastLeg = e.legs[e.legs.length - 1];
        if (firstLeg.reportTimeLoc && lastLeg.arrivalTimeLoc) {
          dutyPeriodMins += getDurationMinutes(firstLeg.reportTimeLoc, lastLeg.arrivalTimeLoc) + 30;
        }
      } else if (e.eventType === 'STANDBY' || e.eventType === 'GTR') {
        if (e.startTimeLoc && e.endTimeLoc) {
          dutyPeriodMins += getDurationMinutes(e.startTimeLoc, e.endTimeLoc);
        }
      }
    });

    const formatMinsToHHMM = (totalMins: number): string => {
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    return {
      flightTime: formatMinsToHHMM(flightTimeMins),
      dutyPeriod: formatMinsToHHMM(dutyPeriodMins),
      flightDuties,
      offDays,
      leaves,
      standby,
      sicks,
      training,
      simulator,
    };
  }, [entries]);


  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  CARGA INICIAL: Roster cacheado desde Supabase (modo offline)     ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  const loadCachedRoster = useCallback(async () => {
    setInitialLoading(true);

    // Primero intentar cargar desde caché local para acceso offline inmediato
    const cacheKey = `roster_cache_${userId}_${year}_${month}`;
    const cachedStr = localStorage.getItem(cacheKey);
    let hasLocalCache = false;
    let localSyncedAt: string | null = null;

    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        setEntries(cachedData.entries || []);
        setLastSynced(cachedData.synced_at || null);
        localSyncedAt = cachedData.synced_at || null;
        hasLocalCache = true;
      } catch (e) {
        console.error("Error parsing local roster cache", e);
      }
    }

    // Consultar Supabase vía servidor (usa SUPABASE_SERVICE_ROLE_KEY → siempre puede leer,
    // sin depender de RLS). Así, si el roster se sincronizó en otro dispositivo, se detecta
    // automáticamente la versión más actualizada y se muestra sin volver a sincronizar con ARMS.
    try {
      const res = await fetch(`${getApiUrl('/api/arms/roster')}?user_id=${encodeURIComponent(userId)}&month=${month}&year=${year}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && data.roster && data.roster.length > 0) {
        const serverTime = data.syncedAt ? new Date(data.syncedAt).getTime() : 0;
        const localTime = localSyncedAt ? new Date(localSyncedAt).getTime() : 0;

        // Mostrar la versión más actualizada automáticamente
        if (!hasLocalCache || serverTime > localTime) {
          setEntries(data.roster as ArmsDayEntry[]);
          setLastSynced(data.syncedAt);
          // Guardar en caché local para el futuro
          localStorage.setItem(cacheKey, JSON.stringify({
            entries: data.roster,
            synced_at: data.syncedAt
          }));
        }
      } else if (!hasLocalCache) {
        setEntries([]);
        setLastSynced(null);
      }
    } catch (e: any) {
      console.error('[ARMS_UI] Error cargando roster desde el servidor:', e.message);
      // Fallback: intentar lectura directa desde Supabase (requiere RLS configurada en arms_roster)
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('arms_roster')
            .select('roster_json, synced_at')
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year)
            .maybeSingle();
          if (!error && data?.roster_json) {
            setEntries(data.roster_json as ArmsDayEntry[]);
            setLastSynced(data.synced_at);
            localStorage.setItem(cacheKey, JSON.stringify({
              entries: data.roster_json,
              synced_at: data.synced_at
            }));
          }
        }
      } catch (e2: any) {
        console.error('[ARMS_UI] Fallback directo a Supabase falló:', e2.message);
      }
      // Si falla todo (ej. sin conexión), mantenemos lo que ya cargamos desde localStorage
    } finally {
      setInitialLoading(false);
    }
  }, [userId, month, year]);

  // Recargar cada vez que cambia el mes/año
  useEffect(() => { loadCachedRoster(); }, [loadCachedRoster]);

  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  SINCRONIZACIÓN: POST al backend → scraper → parser              ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  const handleSync = async (username: string, password: string, remember: boolean) => {
    setSyncing(true);
    setSyncError(null);

    const abortController = new AbortController();
    const abortTimeout = setTimeout(() => abortController.abort(), 120000);

    try {
      const response = await fetch(getApiUrl('/api/arms/sync-roster'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          username,
          password,
          month,
          year,
          rememberSession: remember,
        }),
        signal: abortController.signal,
      });
      clearTimeout(abortTimeout);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Comparar cambios si ya había entries previas en este mes/año
      if (entries && entries.length > 0) {
        const changesList: RosterChange[] = [];
        const allDates = Array.from(new Set([
          ...entries.map(e => e.dateISO),
          ...data.entries.map((e: any) => e.dateISO)
        ])).sort();

        for (const date of allDates) {
          const oldEntry = entries.find(e => e.dateISO === date);
          const newEntry = data.entries.find((e: any) => e.dateISO === date);
          
          const oldSum = getActivitySummary(oldEntry);
          const newSum = getActivitySummary(newEntry);
          
          if (oldSum !== newSum) {
            changesList.push({
              dateISO: date,
              oldActivity: oldSum,
              newActivity: newSum
            });
          }
        }

        if (changesList.length > 0) {
          setRosterChanges(changesList);
        } else {
          setShowNoChangesAlert(true);
        }
      }

      // Guardar credenciales si el usuario marcó "Recordar sesión"
      if (remember) {
        localStorage.setItem('arms_saved_username', username);
        localStorage.setItem('arms_saved_password', password);
      } else {
        localStorage.removeItem('arms_saved_username');
        localStorage.removeItem('arms_saved_password');
      }

      setEntries(data.entries);
      const nowSync = new Date().toISOString();
      setLastSynced(nowSync);
      setShowCredentials(false); // Cerrar modal de credenciales
      
      // Actualizar caché local tras sincronización exitosa
      const cacheKey = `roster_cache_${userId}_${year}_${month}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        entries: data.entries,
        synced_at: nowSync
      }));

      console.log(`[ARMS_UI] Sincronización exitosa: ${data.entriesCount} entradas.`);

    } catch (error: any) {
      clearTimeout(abortTimeout);
      console.error('[ARMS_UI] Error en sincronización:', error.message);
      
      if (error.name === 'AbortError') {
        setShowTimeoutAlert(true);
      } else if (error instanceof TypeError && !navigator.onLine) {
        setShowOfflineAlert(true);
      } else if (error instanceof TypeError) {
        setSyncError('No se pudo conectar con el servidor backend.');
      } else {
        const msg = error.message || '';
        // Contraseña expirada en ARMS — mostrar modal específico
        if (/ARMS_PASSWORD_EXPIRED/i.test(msg)) {
          localStorage.removeItem('arms_saved_password');
          setShowPasswordExpiredAlert(true);
        // Error de autenticación con ARMS — limpiar credenciales y pedir reingreso
        } else if (/Login fallido|credenciales|password incorrect/i.test(msg)) {
          localStorage.removeItem('arms_saved_username');
          localStorage.removeItem('arms_saved_password');
          setShowCredentials(true);
        } else {
          // Otro error (servidor sin internet, timeout, etc.) — preservar credenciales
          setSyncError(msg);
        }
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncClick = () => {
    if (!navigator.onLine) {
      setShowOfflineAlert(true);
      return;
    }
    const savedUser = localStorage.getItem('arms_saved_username');
    const savedPass = localStorage.getItem('arms_saved_password');
    if (savedUser && savedPass) {
      handleSync(savedUser, savedPass, true);
    } else {
      setShowCredentials(true);
    }
  };

  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  EXPORTAR A PDF — Almanaque mensual vía @react-pdf/renderer       ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  const handleExportPDF = async (customSettings?: any) => {
    if (processedEntries.length === 0) return;

    let settings = customSettings;
    if (!settings) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('calendar_settings')
          .eq('id', userId)
          .single();
        if (profile?.calendar_settings) {
          settings = profile.calendar_settings;
        }
      } catch (err) {
        console.error("Error loading calendar settings for PDF:", err);
      }
    }

    const doc = <AlmanaquePDF entries={processedEntries} month={month} year={year} settings={settings} />;
    const pdfBlob = await pdf(doc).toBlob();
    const fileName = `Almanaque-Roster-${MONTH_NAMES[month - 1]}-${year}.pdf`;

    const isMobile = Capacitor.isNativePlatform();
    if (isMobile) {
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Cache,
          });
          await Share.share({
            title: `Almanaque Roster ${MONTH_NAMES[month - 1]} ${year}`,
            text: 'Aquí tienes tu almanaque mensual del roster',
            url: savedFile.uri,
            dialogTitle: 'Compartir Almanaque PDF',
          });
        } catch (err) {
          console.error('Error sharing PDF on mobile:', err);
        }
      };
    } else {
      saveAs(pdfBlob, fileName);
    }
  };

  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  NAVEGACIÓN DE MESES                                              ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  const goToPrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
    setSelectedDate(null); // Reset selección al cambiar de mes
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
    setSelectedDate(null);
  };

  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  RENDER                                                            ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  return (
    <div className="flex flex-col min-h-[100dvh] bg-slate-50 dark:bg-[#101622] text-slate-900 dark:text-white pb-24">

      {/* ════════════════════════════════════════════════════════════════
           HEADER STICKY — Título + Botón Sincronizar
         ════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 bg-slate-50 dark:bg-[#101622]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#2d3748] px-4 py-4">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] font-bold">
              Roster ARMS
            </p>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Mi Calendario</h1>
          </div>
          <div className="flex items-center gap-2">
            {processedEntries.length > 0 && (
              <button
                onClick={() => setShowExportMenu(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 active:scale-[0.96] transition-all"
              >
                <Download size={14} />
                Exportar
              </button>
            )}
            <button
              onClick={() => setShowTelegramModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-full text-sky-600 dark:text-sky-400 text-xs font-semibold hover:bg-sky-500/20 active:scale-[0.96] transition-all"
            >
              <MessageCircle size={14} />
              Telegram
            </button>
            <button
              onClick={handleSyncClick}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-[#1152d4]/10 border border-blue-200 dark:border-[#1152d4]/30 rounded-full text-[#1152d4] text-sm font-semibold hover:bg-[#1152d4]/20 active:scale-[0.96] transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
           CUERPO PRINCIPAL
         ════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">

        {/* ── Selector de mes (flechas + nombre) ─────────────────────── */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevMonth}
            className="p-2.5 rounded-xl hover:bg-white dark:bg-[#1a2233] transition-colors active:scale-[0.92]"
          >
            <ChevronLeft size={18} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />
          </button>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={goToNextMonth}
            className="p-2.5 rounded-xl hover:bg-white dark:bg-[#1a2233] transition-colors active:scale-[0.92]"
          >
            <ChevronRight size={18} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* ── Calendario mensual ─────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#0d1520] rounded-3xl p-4 border border-slate-200 dark:border-[#2d3748]/50 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
          <MonthlyCalendar
            entries={processedEntries}
            month={month}
            year={year}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        {/* ── Leyenda de marcadores ───────────────────────────────────── */}
        <div className="flex items-center justify-center gap-4 py-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Plane size={10} className="text-[#1152d4] fill-[#1152d4]/30" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Vuelo</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Home size={10} className="text-emerald-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Libre</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield size={10} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Guardia</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase size={10} className="text-amber-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Layover</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coffee size={10} className="text-purple-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">NDA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Laptop size={10} className="text-cyan-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">GTR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HelpCircle size={10} className="text-cyan-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">OTH</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CalendarMinus size={10} className="text-red-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Licencia</span>
          </div>
        </div>

        {/* ── Última sincronización ───────────────────────────────────── */}
        {lastSynced && (
          <p className="text-[10px] text-slate-400 dark:text-slate-600 text-center font-mono">
            Última sync: {new Date(lastSynced).toLocaleString('es-AR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}

        {/* ── Recordatorio footer ───────────────────────────────────────── */}
        <p className="text-[9px] text-slate-400/60 dark:text-slate-600/60 text-center leading-relaxed max-w-xs mx-auto">
          Recordá que ante la duda, el portal de la compañía es el único medio oficial.
        </p>

        {/* ── Error de sincronización ─────────────────────────────────── */}
        <AnimatePresence>
          {syncError && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl"
            >
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-red-400 font-medium">{syncError}</p>
                <button
                  onClick={() => setSyncError(null)}
                  className="text-[10px] text-red-500/60 hover:text-red-400 mt-1 transition-colors"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════════════
             DETALLE DEL DÍA SELECCIONADO
           ════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {selectedEntry && (
            <motion.div
              key={selectedEntry.dateISO}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={SPRING_CONFIG}
              className="space-y-3"
            >
              {/* Header del día */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                  {new Date(selectedEntry.dateISO + 'T12:00').toLocaleDateString('es-AR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })}
                </h3>
                {selectedEntry.isFlight && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a2233] px-2 py-0.5 rounded-full">
                    Bloque: {selectedEntry.dailyBlockTotal}h
                  </span>
                )}
              </div>

              {/* ── CASO: LICENCIA / LEAVE ───────────────────────────── */}
              {isLeaveEntry(selectedEntry) && (
                <div className="flex flex-col gap-4 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                      <CalendarMinus size={18} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Licencia / Inactividad
                      </p>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                        {(() => {
                          const rawTask = selectedEntry.rawTask || '';
                          const leaveMatch = rawTask.match(/leave\s*-\s*(.*)/i);
                          return leaveMatch ? leaveMatch[1].trim() : rawTask;
                        })()}
                      </h3>
                    </div>
                  </div>
                  
                  {(() => {
                    const rawTask = selectedEntry.rawTask || '';
                    const leaveMatch = rawTask.match(/leave\s*-\s*(.*)/i);
                    const leaveText = leaveMatch ? leaveMatch[1].trim() : rawTask;
                    
                    const originalRemarks = selectedEntry.remarks?.replace(/&nbsp;/gi, ' ').trim() || '';
                    const finalRemarksText = originalRemarks 
                      ? `${leaveText} - ${originalRemarks}` 
                      : leaveText;

                    return finalRemarksText ? (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-[#101622]/50 border border-red-500/10 rounded-xl">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Trg / Remarks
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {finalRemarksText}
                        </p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {/* ── CASO: LAYOVER ────────────────────────────────────── */}
              {selectedEntry.eventType === 'LAYOVER' && !isLeaveEntry(selectedEntry) && (
                <motion.div
                  className="flex items-center gap-4 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl"
                  initial={{ scale: 0.97 }}
                  animate={{ scale: 1 }}
                  transition={SPRING_CONFIG}
                >
                  <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <Briefcase size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-300">
                      Layover en {selectedEntry.layoverAirport || '—'}
                    </p>
                    {selectedEntry.layoverDuration && (
                      <p className="text-[11px] text-amber-400/70 mt-0.5">
                        Duración: {selectedEntry.layoverDuration}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── CASO: DÍA LIBRE (OFF) ────────────────────────────── */}
              {selectedEntry.eventType === 'OFF' && !isLeaveEntry(selectedEntry) && (
                <div className="flex items-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                    <Home size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-300">Día libre en base</p>
                    <p className="text-[11px] text-emerald-400/60">Descanso programado</p>
                  </div>
                </div>
              )}

              {/* ── CASO: NDA / OTH ── */}
              {selectedEntry.eventType === 'NDA' && !isLeaveEntry(selectedEntry) && (
                <div className="flex flex-col gap-4 p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                      <Coffee size={18} className="text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Actividad
                      </p>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                        {selectedEntry.rawTask || 'NDA'}
                      </h3>
                    </div>
                  </div>
                  
                  {/* Trg/Remarks for OTH tasks */}
                  {selectedEntry.rawTask?.toUpperCase().startsWith('OTH') && selectedEntry.remarks && selectedEntry.remarks.replace(/&nbsp;/gi, ' ').trim() !== '' && (
                    <div className="mt-2 p-3 bg-slate-50 dark:bg-[#101622]/50 border border-purple-500/10 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                        Trg / Remarks
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {selectedEntry.remarks.replace(/&nbsp;/gi, ' ').trim()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CASO: GTR (Ground Training Recurrent) ── */}
              {selectedEntry.eventType === 'GTR' && !isLeaveEntry(selectedEntry) && (
                <div className="flex flex-col gap-4 p-5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center shrink-0">
                      <Laptop size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Curso / Capacitación
                      </p>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                        {selectedEntry.rawTask || 'GTR'}
                      </h3>
                    </div>
                  </div>

                  {(selectedEntry.startTimeLoc || selectedEntry.endTimeLoc) && (
                    <div className="mt-1 flex items-center gap-8 p-3 bg-slate-50 dark:bg-[#101622]/50 border border-cyan-500/10 rounded-xl">
                      {selectedEntry.startTimeLoc && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Inicio</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {selectedEntry.startTimeLoc}L {selectedEntry.startTimeUtc && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({selectedEntry.startTimeUtc}Z)</span>}
                          </p>
                        </div>
                      )}
                      {selectedEntry.endTimeLoc && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Fin</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {selectedEntry.endTimeLoc}L {selectedEntry.endTimeUtc && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({selectedEntry.endTimeUtc}Z)</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {selectedEntry.remarks && selectedEntry.remarks.replace(/&nbsp;/gi, ' ').trim() !== '' && (
                    <div className="mt-2 p-3 bg-slate-50 dark:bg-[#101622]/50 border border-cyan-500/10 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                        Trg / Remarks
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {selectedEntry.remarks.replace(/&nbsp;/gi, ' ').trim()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── CASO: GUARDIA / STANDBY ──────────────────────────── */}
              {selectedEntry.eventType === 'STANDBY' && !isLeaveEntry(selectedEntry) && (
                <div className="flex flex-col gap-3 p-5 bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-[#2d3748] flex items-center justify-center shrink-0">
                      <Shield size={18} className="text-slate-400 dark:text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Guardia / Standby</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{selectedEntry.rawTask}</p>
                    </div>
                  </div>
                  
                  {(selectedEntry.startTimeLoc || selectedEntry.endTimeLoc) && (
                    <div className="mt-1 flex items-center gap-8 p-3 bg-slate-50 dark:bg-[#101622]/50 border border-slate-200 dark:border-[#2d3748]/50 rounded-xl">
                      {selectedEntry.startTimeLoc && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Inicio</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEntry.startTimeLoc}</p>
                        </div>
                      )}
                      {selectedEntry.endTimeLoc && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Fin</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedEntry.endTimeLoc}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── CASO: VUELO — Timeline vertical de tramos ────────── */}
              {selectedEntry.isFlight && selectedEntry.legs.length > 0 && !isLeaveEntry(selectedEntry) && (
                <div className="bg-white dark:bg-[#0d1520] rounded-3xl border border-slate-200 dark:border-[#2d3748]/50 overflow-hidden py-3 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
                  {selectedEntry.legs.map((leg, i) => (
                    <FlightLegCard
                      key={`${leg.flightNumber}-${i}`}
                      leg={leg}
                      index={i}
                      onClick={() => setCrewModal({
                        crew: leg.crewComplement,
                        flight: leg.flightNumber,
                      })}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Resumen Mensual de Estadísticas ─────────────────────────── */}
        {!initialLoading && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_CONFIG}
            className="bg-white dark:bg-[#0d1520] rounded-3xl p-5 border border-slate-200 dark:border-[#2d3748]/50 shadow-[0_4px_20px_rgba(0,0,0,0.15)] space-y-4 mt-6"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#2d3748]/30 pb-3">
              <Clock size={16} className="text-[#1152d4]" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Resumen Mensual
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Columna 1: Tiempos */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Tiempos
                </h4>
                <div className="space-y-2">
                  <div className="bg-slate-50 dark:bg-[#1a2233] p-3 rounded-2xl border border-slate-150 dark:border-[#2d3748]/30 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">FT</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">Vuelo</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-[#1152d4]">
                      {stats.flightTime}
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-[#1a2233] p-3 rounded-2xl border border-slate-150 dark:border-[#2d3748]/30 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">DP</p>
                      <p className="text-[9px] text-slate-400 dark:text-slate-600 leading-tight">Servicio</p>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                      {stats.dutyPeriod}
                    </span>
                  </div>
                </div>
              </div>

              {/* Columna 2: Días */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Días
                </h4>
                <div className="bg-slate-50 dark:bg-[#1a2233] p-3 rounded-2xl border border-slate-150 dark:border-[#2d3748]/30 space-y-1.5 text-[11px]">
                  {[
                    { label: 'Flight Duties', count: stats.flightDuties },
                    { label: 'OFF (Libres)', count: stats.offDays },
                    { label: 'Leaves (Licencias)', count: stats.leaves },
                    { label: 'Stand By', count: stats.standby },
                    { label: 'Sicks (Enfermedad)', count: stats.sicks },
                    { label: 'Training (Cursos)', count: stats.training },
                    { label: 'Simulator (Simulador)', count: stats.simulator }
                  ].map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className={item.count > 0 ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-400 dark:text-slate-600'}>
                        {item.label}
                      </span>
                      <span className={`font-mono font-bold ${item.count > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-600'}`}>
                        {item.count || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}


        {/* ── Estado vacío: sin datos del mes ─────────────────────────── */}
        {!initialLoading && entries.length === 0 && !selectedEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-12 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] flex items-center justify-center mb-4">
              <Calendar size={28} className="text-slate-400 dark:text-slate-600" />
            </div>
            <p className="text-sm font-semibold text-slate-400 dark:text-slate-600 dark:text-slate-400">Sin datos del roster</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-600 mt-1 max-w-[250px]">
              Pulsa "Sincronizar" para importar tu roster de ARMS para {MONTH_NAMES[month - 1]} {year}.
            </p>
          </motion.div>
        )}

        {/* ── Estado de carga inicial (skeleton) ─────────────────────── */}
        {initialLoading && (
          <div className="flex flex-col items-center py-12">
            <Loader2 size={24} className="text-[#1152d4] animate-spin mb-3" />
            <p className="text-xs text-slate-500 dark:text-slate-400">Cargando roster...</p>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
           MODALES
         ════════════════════════════════════════════════════════════════ */}

      {/* Modal de Tripulación */}
      <AnimatePresence>
        {crewModal && (
          <CrewModal
            crew={crewModal.crew}
            flightNumber={crewModal.flight}
            onClose={() => setCrewModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Credenciales ARMS */}
      <AnimatePresence>
        {showCredentials && (
          <ArmsCredentialsModal
            loading={syncing}
            onClose={() => setShowCredentials(false)}
            onSubmit={(user, pass, remember) => handleSync(user, pass, remember)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Cambios en Roster */}
      <AnimatePresence>
        {rosterChanges && (
          <RosterChangesModal
            changes={rosterChanges}
            onClose={() => setRosterChanges(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Sin Conexión */}
      <AnimatePresence>
        {showOfflineAlert && (
          <OfflineAlert onClose={() => setShowOfflineAlert(false)} />
        )}
      </AnimatePresence>

      {/* Modal de Servidor Lento (Timeout) */}
      <AnimatePresence>
        {showTimeoutAlert && (
          <TimeoutAlert onClose={() => setShowTimeoutAlert(false)} />
        )}
      </AnimatePresence>

      {/* Modal de Contraseña Expirada en ARMS */}
      <AnimatePresence>
        {showPasswordExpiredAlert && (
          <PasswordExpiredAlert onClose={() => setShowPasswordExpiredAlert(false)} />
        )}
      </AnimatePresence>

      {/* Modal de Sync exitosa sin cambios */}
      <AnimatePresence>
        {showNoChangesAlert && (
          <NoChangesAlert onClose={() => setShowNoChangesAlert(false)} />
        )}
      </AnimatePresence>

      {/* Modal de Exportación (PDF / Suscripción) */}
      <AnimatePresence>
        {showExportMenu && (
          <ExportMenuModal
            onPDF={() => setShowPDFExport(true)}
            onSubscribe={() => setShowTokensModal(true)}
            onICS={() => setShowICSExport(true)}
            onClose={() => setShowExportMenu(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Mis Enlaces de Calendario */}
      <AnimatePresence>
        {showTokensModal && (
          <MisEnlacesModal
            userId={userId}
            onClose={() => setShowTokensModal(false)}
            onOpenPreferences={() => setShowPreferences(true)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Telegram (avisos de roster) */}
      <AnimatePresence>
        {showTelegramModal && (
          <TelegramLinkModal
            userId={userId}
            onClose={() => setShowTelegramModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Disclaimer (primera vez) */}
      <AnimatePresence>
        {showDisclaimer && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-[#0d1520] border border-slate-200 dark:border-[#2d3748] rounded-3xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="p-5 pb-0">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Descargo de Responsabilidad</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Términos y Condiciones del Roster</p>
                  </div>
                </div>

                <div
                  ref={disclaimerRef}
                  className="h-64 overflow-y-auto space-y-4 pr-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-4"
                  onScroll={() => {
                    const el = disclaimerRef.current;
                    if (!el || disclaimerScrollComplete) return;
                    if (el.scrollHeight - el.scrollTop - el.clientHeight < 5) {
                      setDisclaimerScrollComplete(true);
                    }
                  }}
                >
                  <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Importante: El canal oficial es siempre tu prioridad.
                  </p>
                  <p>
                    Esta aplicación ha sido desarrollada como una herramienta de asistencia personal para facilitar la visualización de tu programación de vuelos. Si bien trabajamos de forma continua para garantizar que la sincronización de datos sea precisa y se actualice en tiempo real, esta plataforma no constituye un canal oficial de la línea aérea.
                  </p>
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Al utilizar esta función, aceptas y reconoces que:
                  </p>
                  <div className="space-y-3 pl-3 border-l-2 border-amber-200 dark:border-amber-900/40">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Responsabilidad de Verificación:</p>
                      <p>Es obligación exclusiva del usuario (tripulante) contrastar y verificar de manera regular su itinerario, cambios de guardia, asignaciones y notificaciones directamente en el portal oficial de la aerolínea.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Exclusión de Responsabilidad:</p>
                      <p>El desarrollador no se hace responsable por vuelos perdidos, presentaciones erróneas (no-show), penalizaciones, errores de interpretación o cualquier perjuicio derivado de discrepancias, fallas de conectividad, retrasos en la sincronización o desactualización de los datos mostrados en esta app.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Prevalencia de Datos:</p>
                      <p>Ante la más mínima duda, diferencia o conflicto entre la información mostrada aquí y el sistema de la compañía, prevalecerá siempre y sin excepción la información del portal oficial de la aerolínea.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                      Al continuar utilizando esta sección, confirmas que comprendes que el portal de la aerolínea es la única fuente de verdad legal y operativa para tu actividad de vuelo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
                <button
                  disabled={!disclaimerScrollComplete}
                  onClick={() => {
                    localStorage.setItem('roster_disclaimer_accepted', 'true');
                    setShowDisclaimer(false);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    disclaimerScrollComplete
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 active:scale-[0.98]'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {disclaimerScrollComplete ? (
                    <><CheckCircle2 size={16} /> He leído y acepto</>
                  ) : (
                    <><Shield size={16} /> Desplazate hasta el final para aceptar</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Preferencias de Calendario */}
      <AnimatePresence>
        {showPreferences && (
          <PreferencesModal
            userId={userId}
            onClose={() => setShowPreferences(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Exportar .ICS */}
      <AnimatePresence>
        {showICSExport && (
          <ExportICSModal
            entries={processedEntries}
            month={month}
            year={year}
            userId={userId}
            onClose={() => setShowICSExport(false)}
          />
        )}

        {showPDFExport && (
          <ExportPDFModal
            entries={processedEntries}
            month={month}
            year={year}
            userId={userId}
            onExport={handleExportPDF}
            onClose={() => setShowPDFExport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
