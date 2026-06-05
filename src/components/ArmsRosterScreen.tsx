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

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plane, RefreshCw, Clock, Users, ChevronLeft, ChevronRight,
  Shield, Home, AlertCircle, Briefcase, X, Eye, EyeOff, HelpCircle,
  Calendar, Loader2, Coffee, ArrowRight
} from 'lucide-react';
import type { ArmsDayEntry, ArmsFlightLeg, ArmsCrewMember } from '../types';
import { supabase } from '../utils/supabase/client';
import { getApiUrl } from '../utils/api';

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

  switch (entry.eventType) {
    case 'FLIGHT_OP':
    case 'FLIGHT_DH':
      return <Plane size={22} className="text-[#1152d4] fill-[#1152d4]/30" />;
    case 'OFF':
      return <Home size={22} className="text-emerald-400" />;
    case 'NDA':
      return <Coffee size={22} className="text-purple-400" />;
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
      {/* ── Evento de Presentación (REPORT) — solo en el primer tramo ── */}
      {index === 0 && (
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
                <span className="text-[11px] font-bold text-[#1152d4]">{leg.flightNumber}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-600">·</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">{leg.blockTime}h bloque</span>
              </div>

              {/* Ruta (origen → destino) */}
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {leg.origin} → {leg.destination}
              </p>

              {/* Horarios de salida y llegada (local + UTC) */}
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
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
  const [user, setUser]       = useState('');
  const [pass, setPass]       = useState('');
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
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-[#2d3748] text-sm font-semibold text-slate-400 dark:text-slate-600 dark:text-slate-400 hover:bg-white dark:bg-[#1a2233] transition-colors"
          >
            Cancelar
          </button>
          <button
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
  if (!entry) return 'Libre / Sin programar';
  if (entry.eventType === 'OFF') return 'Libre';
  if (entry.eventType === 'LAYOVER') return `Layover (${entry.layoverAirport || '—'})`;
  if (entry.eventType === 'STANDBY') return `Guardia (${entry.rawTask || ''})`;
  if (entry.isFlight) {
    const flights = entry.legs.map(l => l.flightNumber).join(', ');
    return `Vuelo: ${flights || entry.rawTask || 'Tramos'}`;
  }
  return entry.rawTask || entry.eventType || 'Sin actividad';
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
                  <div className="bg-red-500/10 text-red-500 dark:text-red-400 px-3 py-2 rounded-xl text-xs line-through text-center font-medium min-h-[32px] flex items-center justify-center">
                    {c.oldActivity}
                  </div>
                  <ArrowRight size={14} className="text-slate-400 dark:text-slate-600" />
                  <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-2 rounded-xl text-xs text-center font-bold min-h-[32px] flex items-center justify-center">
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


// ═══════════════════════════════════════════════════════════════════════════
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
  const [selectedDate, setSelectedDate] = useState<string | null>(
    today.toISOString().slice(0, 10)
  );

  // ── Estado de sincronización ──────────────────────────────────────────
  const [syncing, setSyncing]               = useState(false);
  const [syncError, setSyncError]           = useState<string | null>(null);
  const [lastSynced, setLastSynced]         = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [rosterChanges, setRosterChanges]     = useState<RosterChange[] | null>(null);

  // ── Estado del modal de tripulación ───────────────────────────────────
  const [crewModal, setCrewModal] = useState<{
    crew: ArmsCrewMember[];
    flight: string;
  } | null>(null);

  // ── Estado de carga inicial ───────────────────────────────────────────
  const [initialLoading, setInitialLoading] = useState(true);

  // ── Entrada seleccionada ──────────────────────────────────────────────
  const selectedEntry = entries.find(e => e.dateISO === selectedDate) || null;

  // ╔═════════════════════════════════════════════════════════════════════╗
  // ║  CARGA INICIAL: Roster cacheado desde Supabase (modo offline)     ║
  // ╚═════════════════════════════════════════════════════════════════════╝
  const loadCachedRoster = useCallback(async () => {
    setInitialLoading(true);
    
    // Primero intentar cargar desde caché local para acceso offline inmediato
    const cacheKey = `roster_cache_${userId}_${year}_${month}`;
    const cachedStr = localStorage.getItem(cacheKey);
    let hasLocalCache = false;
    
    if (cachedStr) {
      try {
        const cachedData = JSON.parse(cachedStr);
        setEntries(cachedData.entries || []);
        setLastSynced(cachedData.synced_at || null);
        hasLocalCache = true;
      } catch (e) {
        console.error("Error parsing local roster cache", e);
      }
    }

    try {
      const { data, error } = await supabase
        .from('arms_roster')
        .select('roster_json, synced_at')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) {
         throw error;
      }

      if (data?.roster_json) {
        setEntries(data.roster_json as ArmsDayEntry[]);
        setLastSynced(data.synced_at);
        // Guardar en caché local para el futuro
        localStorage.setItem(cacheKey, JSON.stringify({
          entries: data.roster_json,
          synced_at: data.synced_at
        }));
      } else if (!hasLocalCache) {
        setEntries([]);
        setLastSynced(null);
      }
    } catch (e: any) {
      console.error('[ARMS_UI] Error cargando roster desde base de datos:', e.message);
      // Si falla (ej. sin conexión), mantenemos lo que ya cargamos desde localStorage
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
      });

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
        }
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
      console.error('[ARMS_UI] Error en sincronización:', error.message);
      setSyncError(error.message);
    } finally {
      setSyncing(false);
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
          <button
            onClick={() => setShowCredentials(true)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-[#1152d4]/10 border border-blue-200 dark:border-[#1152d4]/30 rounded-full text-[#1152d4] text-sm font-semibold hover:bg-[#1152d4]/20 active:scale-[0.96] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
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
            entries={entries}
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
            <HelpCircle size={10} className="text-cyan-400" />
            <span className="text-[9px] text-slate-500 dark:text-slate-400">OTH</span>
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

              {/* ── CASO: LAYOVER ────────────────────────────────────── */}
              {selectedEntry.eventType === 'LAYOVER' && (
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
              {selectedEntry.eventType === 'OFF' && (
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
              {selectedEntry.eventType === 'NDA' && (
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

              {/* ── CASO: GUARDIA / STANDBY ──────────────────────────── */}
              {selectedEntry.eventType === 'STANDBY' && (
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
              {selectedEntry.isFlight && selectedEntry.legs.length > 0 && (
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
    </div>
  );
}
