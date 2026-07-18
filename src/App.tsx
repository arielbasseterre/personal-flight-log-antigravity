import React, { useState, useEffect, useCallback } from 'react';
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
  Calendar,
  Lock,
  CheckCircle,
  Loader2,
  Info,
  LogOut,
  CreditCard
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
import { ProfileScreen } from './components/ProfileScreen';
import { SubscriptionScreen } from './components/SubscriptionScreen';
import { AuthScreen } from './components/AuthScreen';
import { ReportScreen } from './components/ReportScreen';
import { AnacAuth } from './components/AnacAuth';
import { ArmsRosterScreen } from './components/ArmsRosterScreen';
import { PdfViewer } from './components/PdfViewer';

import { supabase } from './utils/supabase/client';
import { User as RawUser } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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

const BottomNav = ({ currentScreen, setScreen, role }: { currentScreen: Screen, setScreen: (s: Screen) => void, role?: string }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a2233] border-t border-slate-200 dark:border-[#2d3748] pb-safe-area-inset-bottom z-50 transition-all duration-300">
    <div className="flex justify-around max-w-lg mx-auto h-16">
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
      {role !== 'tcp_fb' && (
        <button onClick={() => setScreen('libro')} className={`nav-item ${currentScreen === 'libro' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
          <Plane size={24} className={currentScreen === 'libro' ? 'fill-[#1152d4]/20' : ''} />
          <span className="text-[10px] font-medium">Libro</span>
        </button>
      )}
      <button onClick={() => setScreen('roster')} className={`nav-item ${currentScreen === 'roster' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <Calendar size={24} />
        <span className="text-[10px] font-medium">Roster</span>
      </button>
    </div>
  </nav>
);

const Header = ({ title, onBack, darkMode, toggleDarkMode }: { title: string, onBack?: () => void, darkMode: boolean, toggleDarkMode: () => void }) => (
  <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#101622]/80 backdrop-blur-md border-b border-slate-200 dark:border-[#2d3748] px-4 pb-4 pt-safe-area-inset-top transition-colors">
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
    date: "18 de Julio, 2026",
    version: "1.5.0",
    items: [
      "Mercado Pago: sistema de suscripciones anuales integrado. Registro y renovación con redirect checkout. Webhook y callback para actualización automática. Monto dinámico desde app_config.",
      "Perfil independiente: nueva pantalla ProfileScreen para todos los roles (TCP y pilotos). Incluye formulario de datos personales, card de suscripción y renovación con modal de pago.",
      "Bug fix — redirect post-pago: corregida la URL de redirección después de pagar en MP. Usa frontend_url query param explícito en vez de depender de cabeceras referer/origin.",
      "Bug fix — race condition callback/webhook: cuando el webhook procesa el pago antes que el callback, busca al usuario por subscription_id.",
      "Disclaimer roster: modal con scroll-to-accept y footer recordatorio.",
      "Validación email en restablecer contraseña: antes de enviar el enlace, se verifica que el email esté registrado.",
      "Reporte de problemas: validación visual de campos obligatorios (título y descripción) al enviar o al enfocar.",
      "Compatibilidad iOS PWA: ajuste de safe area superior para que el botón de modo claro/oscuro no quede detrás del notch en iPhone.",
      "Registro simplificado: se eliminaron los campos Licencia, Legajo y DNI del formulario de registro. Se completan después en el Perfil.",
      "Restauración de esquema Supabase: recuperadas columnas y tablas faltantes tras restauración de backup (calendar_settings, calendar_tokens, arms_sessions, arms_roster).",
      "Fix build: corregido fragment </> huérfano en AuthScreen.tsx que rompía el build de Vite con 'Unterminated regular expression'."
    ]
  },
  {
    date: "14 de Julio, 2026",
    version: "1.4.7",
    items: [
      "Detalle de Roster: corregido el indicador de 'Presentación' cuando un tramo de vuelo cruza la medianoche (es al otro día) pero es continuación de un servicio previo (dentro de las 13 horas). Ahora muestra correctamente 'escala HH:MM'.",
      "Cálculo de escala cross-day: la app calcula automáticamente el tiempo de escala entre vuelos de días consecutivos al cruzar la medianoche."
    ]
  },
  {
    date: "25 de Junio, 2026",
    version: "1.4.6",
    items: [
      "Preferencias de exportación: nuevo panel con filtros (Standby, Day Off, NDA, GTR, OTH, Layover, Licencias), unificación de vuelos, minutos extras post-bloque, y exclusión de tripulación.",
      "Formato de evento personalizable: elegí entre vista combinada (ruta+vuelo+horarios), solo ruta o solo vuelo para los eventos del calendario.",
      "Vista previa en vivo: las preferencias de formato muestran un ejemplo visual de cómo se verá el evento en el calendario antes de guardar.",
      "Las preferencias de exportación ahora aplican también al Almanaque PDF (filtros, formato y agregación de vuelos).",
      "Corrección: el aviso de nueva versión ahora funciona correctamente en iPad y Safari al forzar la actualización del service worker sin caché HTTP."
    ]
  },
  {
    date: "23 de Junio, 2026",
    version: "1.4.5",
    items: [
      "Estadísticas de Roster: visualización del resumen mensual de tiempos y desglose de actividades (FT, DP, Flight Duties, OFF, Licencias, Standby, etc.) debajo de los detalles diarios.",
      "Cálculo en caliente: el resumen mensual se calcula dinámicamente en el cliente de forma retroactiva sin requerir volver a sincronizar datos de ARMS."
    ]
  },
  {
    date: "23 de Junio, 2026",
    version: "1.4.4",
    items: [
      "Roster ARMS: ahora podés exportar tu roster en dos formatos — archivo .ICS para importar en Google Calendar o Apple Calendar, y Almanaque PDF con calendario mensual imprimible.",
      "Almanaque PDF: calendario mensual en hoja A4 apaisada, con rutas, horarios de presentación, números de vuelo y tipo de actividad. Los días de guardia muestran el rango horario.",
      "Corrección: Los eventos exportados a Google Calendar ahora se importan correctamente (se agregó DTSTAMP requerido por RFC 5545)."
    ]
  },
  {
    date: "21 de Junio, 2026",
    version: "1.4.3",
    items: [
      "Actualización automática: cada 24 horas la app verifica si hay una nueva versión disponible y la descarga automáticamente con un aviso en pantalla."
    ]
  },
  {
    date: "10 de Junio, 2026",
    version: "1.4.2",
    items: [
      "Libro de Vuelo: ahora podés guardar vuelos sin conexión a internet. Se sincronizan automáticamente cuando recuperes la conexión. Los vuelos pendientes se ven con un ícono de reloj en el historial.",
      "Roster ARMS: la sincronización ahora detecta si estás desconectado y muestra un aviso claro sin borrar tus credenciales guardadas. Si no hay cambios en el roster, te lo notificamos.",
    ]
  },
  {
    date: "5 de Junio, 2026",
    version: "1.4.1",
    items: [
      "Correcciones de seguridad: se ocultaron las trazas de error en producción, se escapó la inyección HTML, se agregó limitación de velocidad en los endpoints y se restringió CORS.",
      "Se agregaron políticas de seguridad (RLS) en la base de datos de Supabase.",
    ]
  },
  {
    date: "1 de Junio, 2026",
    version: "1.4.0",
    items: [
      "Nueva pantalla Roster ARMS: calendario mensual sincronizado con el portal ARMS, con detalle de tramos por día y horarios locales/UTC.",
      "Detalle de tripulación dividido en Tripulación de Vuelo (LS/RS) y Tripulación de Cabina (Jefe de Cabina primero).",
      "Acceso offline al roster mediante caché local automático.",
    ]
  },
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

const HomeScreen = ({ onEnter, onGoToTcp, onViewNorms, onGoToLibro, onGoToRoster, onChangelog, onGoToReport, onGoToSuscripcion, onLogout, userEmail, darkMode, toggleDarkMode, role, profile }: { onEnter: () => void, onGoToTcp: () => void, onViewNorms: () => void, onGoToLibro: () => void, onGoToRoster: () => void, onChangelog: () => void, onGoToReport: () => void, onGoToSuscripcion: () => void, onLogout: () => void, userEmail: string | null, darkMode: boolean, toggleDarkMode: () => void, role?: string, profile?: Profile | null }) => {
  const daysRemaining = profile?.subscription_end_date
    ? Math.ceil((new Date(profile.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showRenewalWarning = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30;
  const isTrial = !profile?.subscription_id && !!profile?.subscription_end_date;
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] text-slate-900 dark:text-white transition-colors">
    <div className="flex items-center px-4 pb-4 pt-safe-area-inset-top justify-between border-b border-slate-200 dark:border-[#2d3748]">
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

    <div className="flex-1 overflow-y-auto pb-44">
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

        {profile?.subscription_end_date && (
          <button
            onClick={() => {
              onGoToSuscripcion();
            }}
            className={`w-full p-4 mt-6 rounded-2xl text-left flex items-start gap-3 shadow-sm cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all ${
              showRenewalWarning
                ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30'
                : 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30'
            }`}>
            {showRenewalWarning ? (
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            ) : (
              <svg className="text-green-500 shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className={`text-xs font-bold ${showRenewalWarning ? 'text-amber-800 dark:text-amber-400' : 'text-green-800 dark:text-green-400'}`}>
                  {isTrial ? 'Período de prueba gratuito' : `Suscripción ${showRenewalWarning ? 'próxima a vencer' : 'activa'}`}
                </h4>
                <span className={`text-[10px] font-semibold ${showRenewalWarning ? 'text-amber-600' : 'text-green-600'}`}>
                  {daysRemaining} días restantes
                </span>
              </div>
              <p className="text-[11px] mt-0.5 text-slate-500 dark:text-slate-400">
                Vence el {new Date(profile.subscription_end_date).toLocaleDateString()}
              </p>
            </div>
          </button>
        )}

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

          {role !== 'tcp_fb' && (
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
          )}

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
          Versión {APP_VERSION} • Desarrollado por GRINGOSOFT
        </button>

        {userEmail && (
          <button
            onClick={onGoToReport}
            className="text-slate-400 text-[10px] hover:text-amber-500 transition-colors font-medium p-2"
          >
            ¿Problemas, cambios o sugerencias?
          </button>
        )}
        {userEmail && (
          <button
            onClick={onLogout}
            className="text-slate-400 text-[10px] mb-10 hover:text-red-500 transition-colors font-medium p-2 flex items-center justify-center gap-1"
          >
            <LogOut size={12} />
            Cerrar Sesión
          </button>
        )}
      </div>
    </div>
  </div>
  );
};

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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
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

  const handleShare = async () => {
    const isAndroid = /android/i.test(navigator.userAgent);
    
    try {
      if (isAndroid) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const response = await fetch(pdfUrl);
        const blob = await response.blob();

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
          };
        });
        reader.readAsDataURL(blob);
        const base64Data = await base64Promise;

        const fileName = 'Normativa_Anexo_I.pdf';
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        const { uri } = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Normativa Aeronáutica - Anexo I',
          url: uri,
        });
      } else {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], 'Normativa_Anexo_I.pdf', { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Normativa Aeronáutica - Anexo I',
          });
        } else if (navigator.share) {
          await navigator.share({
            title: 'Normativa Aeronáutica - Anexo I',
            text: 'Consulta el Reglamento Nacional de Gestión de Tripulaciones.',
            url: fullPdfUrl,
          });
        } else {
          alert('Copiado al portapapeles: ' + fullPdfUrl);
        }
      }
    } catch (err) {
      console.error('Error sharing file:', err);
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Normativa Aeronáutica - Anexo I',
            url: fullPdfUrl,
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('Enlace: ' + fullPdfUrl);
      }
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
        <PdfViewer url={pdfUrl} />
      </main>
    </div>
  );
};


const ChangelogScreen = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
      <Header title="Historial de Cambios" onBack={onBack} darkMode={true} toggleDarkMode={() => { }} />
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

const SubscriptionExpiredScreen = ({ profile, onLogout }: { profile: Profile | null, onLogout: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);

  const handleRenew = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile?.id,
          email: profile?.email || '',
          password: 'RENEWAL_DUMMY_PASSWORD',
          firstName: profile?.first_name || '',
          lastName: profile?.last_name || '',
          license: profile?.license || '',
          dni: profile?.dni || '',
          legajo: profile?.legajo || ''
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al renovar');
      if (data.init_point) {
        setPendingCheckoutUrl(data.init_point);
      } else {
        throw new Error('No se recibió la URL de pago');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (pendingCheckoutUrl) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-full max-w-sm mx-auto text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <CreditCard size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Confirmar pago</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Serás redirigido a Mercado Pago para realizar el pago de tu suscripción anual.
          </p>
        </div>

        <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 w-full text-left space-y-2">
          <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold">
            Importante
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
            Este es un pago único anual. Al finalizar el período de 12 meses deberás renovar manualmente la suscripción. No se realizarán cobros automáticos.
          </p>
        </div>

        <div className="w-full space-y-3">
          <Button
            className="w-full h-11 bg-blue-600 hover:bg-blue-700"
            onClick={() => { window.location.href = pendingCheckoutUrl; }}
          >
            <CreditCard className="mr-2" size={18} />
            Ir a Pagar
          </Button>
          <button
            onClick={() => setPendingCheckoutUrl(null)}
            className="w-full h-11 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 h-full max-w-sm mx-auto text-center space-y-6">
      <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
        <AlertTriangle size={32} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {!profile?.subscription_id && profile?.subscription_end_date ? 'Período de prueba vencido' : 'Suscripción Expirada'}
        </h1>
        <p className="text-sm text-slate-400 dark:text-slate-400">
          {!profile?.subscription_id && profile?.subscription_end_date
            ? 'Tu período de prueba gratuito de 30 días ha vencido. Suscribite para seguir usando la aplicación.'
            : 'Tu suscripción anual ha vencido. Hacé click para renovar.'}
        </p>
      </div>

      {profile?.subscription_end_date && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full text-left space-y-2">
          <p className="text-xs text-slate-500">Último Vencimiento: <span className="font-bold text-slate-800 dark:text-white">{new Date(profile.subscription_end_date).toLocaleDateString()}</span></p>
          <p className="text-xs text-slate-500">Estado: <span className="font-bold text-red-500 capitalize">{profile.subscription_status}</span></p>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30 w-full">
          {error}
        </div>
      )}

      <div className="w-full space-y-3">
        <Button className="w-full h-11 bg-blue-600 hover:bg-blue-700" onClick={handleRenew} disabled={loading}>
          {loading ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" size={18} />}
          {loading ? 'Redirigiendo a Mercado Pago...' : 'Renovar Suscripción'}
        </Button>
        <button onClick={onLogout} className="w-full h-11 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [screen, setScreen_] = useState<Screen>('home');
  const [user, setUser] = useState<RawUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [logs, setLogs] = useState<FlightLog[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  const setScreen = useCallback((s: Screen) => {
    setScreen_(prev => {
      if (s === 'libro' && profile?.role === 'tcp_fb') return prev;
      return s;
    });
  }, [profile?.role]);
  const [dataLoading, setDataLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showResetPassword, setShowResetPassword] = useState(() => {
    return window.location.hash.includes('type=recovery');
  });
  const [registerAlert, setRegisterAlert] = useState<{ show: boolean }>({ show: false });
  const [paymentModal, setPaymentModal] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: ''
  });
  const [webviewEscape, setWebviewEscape] = useState<{
    show: boolean;
    newUser: boolean;
  }>({
    show: false,
    newUser: false
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);

  const fetchData = async (userId: string) => {
    if (!supabase) return null;
    setDataLoading(true);
    let finalProfile: Profile | null = null;

    try {
      const cachedLogs = localStorage.getItem(`logs_cache_${userId}`);
      if (cachedLogs) setLogs(JSON.parse(cachedLogs));

      const cachedProfile = localStorage.getItem(`profile_cache_${userId}`);
      if (cachedProfile) {
        const p = JSON.parse(cachedProfile);
        setProfile(p);
        finalProfile = p;
      }
    } catch (e) {
      console.error("Cache read error:", e);
    }

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
        if (fallbackLogs) {
          setLogs(fallbackLogs);
          localStorage.setItem(`logs_cache_${userId}`, JSON.stringify(fallbackLogs));
        }
      } else if (logsData) {
        setLogs(logsData);
        localStorage.setItem(`logs_cache_${userId}`, JSON.stringify(logsData));
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
      } else if (!profileError) {
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
      localStorage.setItem(`profile_cache_${userId}`, JSON.stringify(finalProfile));
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

      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setAuthLoading(false);
        return;
      }
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) {
        lastUserId = activeUser.id;
        fetchData(activeUser.id);

      } else {
        setProfile(null);
        setLogs([]);
      }
    }) || { data: { subscription: { unsubscribe: () => { } } } };

    // Escuchar el evento de notificación tocada para abrir la pantalla de roster
    const handleOpenRoster = () => {
      setScreen('roster');
    };


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

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let mounted = true;

    const activateUpdate = (sw: ServiceWorker) => {
      if (!mounted) return;
      setShowUpdateBanner(true);
      setTimeout(() => { sw.postMessage('SKIP_WAITING'); }, 2000);
    };

    const initSW = async () => {
      try {
        await navigator.serviceWorker.register(`/sw.js?v=${import.meta.env.VITE_BUILD_TIME}`);
      } catch (err) {
        console.log('SW registration failed', err);
        return;
      }
      if (!mounted) return;

      const reg = await navigator.serviceWorker.ready;
      if (!mounted) return;

      const checkUpdate = () => reg.update();

      if (reg.waiting) activateUpdate(reg.waiting);

      if (reg.installing) {
        const sw = reg.installing;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            activateUpdate(sw);
          }
        });
      }

      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            activateUpdate(sw);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!mounted) return;
        window.location.reload();
      });

      checkUpdate();
      const interval = setInterval(checkUpdate, 24 * 60 * 60 * 1000);
      const onVisibility = () => { if (!document.hidden && mounted) checkUpdate(); };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibility);
      };
    };

    const cleanup = initSW();
    return () => { mounted = false; };
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setResetError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Las contraseñas no coinciden');
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const { error } = await supabase!.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetPassword(false);
        supabase!.auth.signOut();
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Error al actualizar la contraseña');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase!.auth.signOut();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const newUser = params.get('newUser');
    const webview = params.get('webview') === 'true';

    const isIOS = /ipad|iphone|ipod/i.test(window.navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;

    if (payment === 'success') {
      if (webview && isIOS && !isStandalone) {
        setWebviewEscape({
          show: true,
          newUser: newUser === 'true'
        });
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        if (newUser === 'true') {
          setPaymentModal({
            show: true,
            type: 'success',
            title: '¡Pago Exitoso!',
            message: 'Tu cuenta ha sido creada con éxito. Por favor, inicia sesión con tu email y contraseña para continuar.'
          });
        } else {
          setPaymentModal({
            show: true,
            type: 'success',
            title: '¡Suscripción Activada!',
            message: 'Tu pago fue procesado con éxito y tu suscripción anual ya se encuentra activa.'
          });
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (payment === 'error') {
      setPaymentModal({
        show: true,
        type: 'error',
        title: 'Error en el Pago',
        message: 'No pudimos procesar tu suscripción. Detalle: ' + (params.get('reason') || 'desconocido')
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const isSubscriptionActive = (() => {
    if (!user) return true;
    if (!profile) return true;
    if (!profile.subscription_end_date) return false;
    return new Date() < new Date(profile.subscription_end_date);
  })();

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <HomeScreen onEnter={() => setScreen('pilotos')} onGoToTcp={() => setScreen('tcp')} onGoToLibro={() => setScreen('libro')} onGoToRoster={() => setScreen('roster')} onGoToSuscripcion={() => setScreen('suscripcion')} onViewNorms={() => setScreen('normas')} onChangelog={() => setScreen('changelog')} onGoToReport={() => setScreen('report')} onLogout={handleLogout} userEmail={user?.email || null} darkMode={darkMode} toggleDarkMode={toggleDarkMode} role={profile?.role} profile={profile} />;
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
      case 'perfil':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            {!user ? (
              <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
            ) : (
              <ProfileScreen
                logs={logs}
                profile={profile}
                setProfile={setProfile}
                refreshData={() => fetchData(user.id)}
                loading={dataLoading}
                userId={user.id}
                onBack={() => setScreen('home')}
              />
            )}
          </div>
        );
      case 'libro':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            <Header 
              title="Libro de Vuelo" 
              onBack={() => {
                localStorage.removeItem('draft_flight_log_form');
                localStorage.removeItem('draft_flight_log_editing_id');
                localStorage.removeItem('draft_flight_log_active_tab');
                setScreen('home');
              }} 
              darkMode={darkMode} 
              toggleDarkMode={toggleDarkMode} 
            />
            <div className="flex flex-col flex-1 overflow-y-auto">
              {!user ? (
                <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
              ) : (
                <LibroScreen
                  logs={logs}
                  setLogs={setLogs}
                  profile={profile}
                  setProfile={setProfile}
                  refreshData={() => fetchData(user.id)}
                  loading={dataLoading}
                  userId={user.id}
                  onGoToSuscripcion={() => setScreen('suscripcion')}
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
                <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
              ) : (
                <ArmsRosterScreen userId={user.id} />
              )}
            </div>
          </div>
        );
      case 'changelog':
        return <ChangelogScreen onBack={() => setScreen('home')} />;
      case 'report':
        return <ReportScreen onBack={() => setScreen('home')} />;
      case 'suscripcion':
        return (
          <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
            {!user ? (
              <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
            ) : (
              <SubscriptionScreen
                profile={profile}
                setProfile={setProfile}
                refreshData={() => fetchData(user.id)}
                onBack={() => setScreen('home')}
              />
            )}
          </div>
        );
      default:
        return <HomeScreen onEnter={() => setScreen('pilotos')} onGoToTcp={() => setScreen('tcp')} onGoToLibro={() => setScreen('libro')} onGoToRoster={() => setScreen('roster')} onGoToSuscripcion={() => setScreen('suscripcion')} onViewNorms={() => setScreen('normas')} onChangelog={() => setScreen('changelog')} onGoToReport={() => setScreen('report')} onLogout={handleLogout} userEmail={user?.email || null} darkMode={darkMode} toggleDarkMode={toggleDarkMode} role={profile?.role} profile={profile} />;
    }
  };

  if (user && !isSubscriptionActive) {
    return (
      <div className={`min-h-screen w-full max-w-lg mx-auto bg-white dark:bg-[#101622] relative font-sans transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
        <SubscriptionExpiredScreen profile={profile} onLogout={handleLogout} />
      </div>
    );
  }

  const content = (() => {
    if (showResetPassword) {
      return (
        <div className={`h-screen w-full max-w-lg mx-auto bg-white dark:bg-[#101622] relative overflow-hidden font-sans transition-colors duration-300 flex items-center justify-center p-6 ${darkMode ? 'dark' : ''}`}>
          <Card className="w-full border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">
                {resetSuccess ? 'Contraseña actualizada' : 'Restablecer contraseña'}
              </CardTitle>
              <CardDescription>
                {resetSuccess
                  ? 'Tu contraseña se actualizó correctamente. Serás redirigido al inicio de sesión.'
                  : 'Ingresá tu nueva contraseña'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-900/30 flex items-start gap-3">
                  <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">¡Listo!</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">Redirigiendo al inicio de sesión...</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  {resetError && (
                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                      {resetError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">Nueva contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">Confirmar contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700" disabled={resetLoading}>
                    {resetLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                    {resetLoading ? 'Actualizando...' : 'Actualizar contraseña'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className={`min-h-screen w-full max-w-lg mx-auto bg-white dark:bg-[#101622] relative font-sans transition-colors duration-300 ${darkMode ? 'dark' : ''}`}>
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

        {screen !== 'changelog' && <BottomNav currentScreen={screen} setScreen={setScreen} role={profile?.role} />}
      </div>
    );
  })();

  return (
    <>
      {content}
      <AnimatePresence>
        {showUpdateBanner && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                  <Loader2 className="animate-spin" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nueva versión disponible</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Actualizando...</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {registerAlert.show && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRegisterAlert({ show: false })}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-6 text-center">
                <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                  <Info size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Registro exitoso</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Su cuenta ha sido creada con éxito. Por favor revise su correo donde encontrará las instrucciones de uso. ¡Muchas gracias!
                </p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <Button
                  className="flex-1 rounded-xl h-12 font-bold text-white shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                  onClick={() => setRegisterAlert({ show: false })}
                >
                  Entendido
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Pago Exitoso / Fallido */}
      <AnimatePresence>
          {paymentModal.show && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-sm overflow-hidden bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-2xl shadow-2xl p-6 text-center"
              >
                <div className="flex justify-center mb-4">
                  {paymentModal.type === 'success' ? (
                    <div className="w-16 h-16 rounded-full bg-green-500/10 dark:bg-green-500/20 text-green-500 flex items-center justify-center animate-bounce">
                      <CheckCircle2 size={36} />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-red-500/10 dark:bg-red-500/20 text-red-500 flex items-center justify-center">
                      <AlertTriangle size={36} />
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {paymentModal.title}
                </h3>

                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                  {paymentModal.message}
                </p>

                <button
                  onClick={() => {
                    setPaymentModal(prev => ({ ...prev, show: false }));
                    if (paymentModal.type === 'success' && user) {
                      window.location.reload();
                    }
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all transform active:scale-95 shadow-md ${
                    paymentModal.type === 'success'
                      ? 'bg-[#1152d4] hover:bg-[#1152d4]/90 shadow-blue-500/20'
                      : 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                  }`}
                >
                  Comenzar
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal de Escape de WebView en iOS */}
        <AnimatePresence>
          {webviewEscape.show && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-sm overflow-hidden bg-white dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-2xl shadow-2xl p-6 text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center animate-pulse">
                    <Share2 size={36} />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  ¡Pago Confirmado!
                </h3>

                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                  Para ingresar a tu cuenta de <strong>Personal Flight Log</strong>, necesitas salir de Mercado Pago y abrir el sitio en el navegador de tu teléfono.
                </p>

                <div className="text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3 mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Instrucciones para iPhone:</p>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1152d4] text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 text-left">
                      Presiona el botón de <strong>Compartir / Opciones</strong> (abajo en tu pantalla o arriba a la derecha).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1152d4] text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 text-left">
                      Selecciona la opción <strong>"Abrir en Safari"</strong> de la lista.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + "/?payment=success" + (webviewEscape.newUser ? "&newUser=true" : ""));
                    alert("Enlace copiado al portapapeles. Puedes pegarlo en Safari.");
                  }}
                  className="w-full py-2.5 px-4 mb-3 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium text-sm transition-all"
                >
                  Copiar enlace para Safari
                </button>

                <button
                  onClick={() => setWebviewEscape({ show: false, newUser: false })}
                  className="text-xs text-slate-400 hover:text-slate-500 underline"
                >
                  Cerrar y continuar aquí (no recomendado)
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
}
