import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Loader2, Copy, CheckCircle2, X, Plus, Trash2, Settings, Link } from 'lucide-react';
import { getApiUrl } from '../utils/api';

const SPRING_CONFIG = { type: 'spring' as const, stiffness: 200, damping: 24 };

interface TokenInfo {
  id: string;
  token: string;
  label: string;
  settings: any;
  url: string;
  created_at: string;
}

function describeSettings(settings: any): string {
  const parts: string[] = [];
  if (settings.excludeCrew) parts.push('sin tripulación');
  if (settings.excludeStandby) parts.push('sin guardias');
  if (settings.excludeDayOff) parts.push('sin libres');
  if (settings.excludeLayover) parts.push('sin escalas');
  if (settings.excludeLeave) parts.push('sin licencias');
  if (settings.excludeNDA) parts.push('sin NDA');
  if (settings.excludeGTR) parts.push('sin GTR');
  if (settings.excludeOTH) parts.push('sin OTH');
  if (settings.aggregateFlights) parts.push('vuelos unificados');

  const fmtMap: Record<string, string> = {
    route_flight_times: 'ruta/vuelo + horarios',
    flight_route_times: 'vuelo/ruta + horarios',
    route_times: 'solo ruta + horarios',
    flight_only: 'solo vuelo',
  };
  const flightFmt = fmtMap[settings.flightEventFormat];
  const reportFmt = settings.reportEventFormat === 'type_only' ? 'tipo simplificado' : null;
  if (flightFmt) parts.push(`vuelos: ${flightFmt}`);
  if (reportFmt) parts.push(`reportes: ${reportFmt}`);

  return parts.length > 0 ? parts.join(' | ') : 'Configuración predeterminada';
}

export function MisEnlacesModal({
  userId,
  onClose,
  onOpenPreferences,
}: {
  userId: string;
  onClose: () => void;
  onOpenPreferences?: () => void;
}) {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [revokingIndex, setRevokingIndex] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadTokens = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${getApiUrl('/api/roster/my-tokens')}?user_id=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens);
      } else {
        setError(data.error || 'Error al cargar enlaces');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, [userId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(getApiUrl('/api/roster/generate-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, label: newLabel.trim() || 'Sin nombre' }),
      });
      const data = await res.json();
      if (data.success) {
        setShowNewInput(false);
        setNewLabel('');
        await loadTokens();
      } else {
        setError(data.error || 'Error al generar enlace');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (token: string, index: number) => {
    setRevokingIndex(index);
    try {
      const res = await fetch(getApiUrl('/api/roster/revoke-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTokens();
      }
    } catch {
      setError('Error al revocar enlace');
    } finally {
      setRevokingIndex(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      const res = await fetch(getApiUrl('/api/roster/revoke-all-tokens'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data.success) {
        await loadTokens();
      }
    } catch {
      setError('Error al revocar todos los enlaces');
    } finally {
      setRevokingAll(false);
    }
  };

  const handleCopy = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    } catch {}
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
        className="relative w-full max-w-md bg-slate-50 dark:bg-[#101622] border border-slate-200 dark:border-[#2d3748] rounded-3xl p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col"
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        transition={SPRING_CONFIG}
      >
        <div className="shrink-0 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Mis Enlaces de Calendario</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2d3748] transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center">{error}</p>
        )}

        {onOpenPreferences && (
          <button
            onClick={onOpenPreferences}
            className="w-full py-3 text-xs font-semibold bg-slate-100 dark:bg-[#1a2233] border border-slate-200 dark:border-[#2d3748] rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-[#242f3e]"
          >
            <Settings size={14} /> Ajustar preferencias de calendario
          </button>
        )}

        <div className="shrink-0">
          {showNewInput ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nombre del enlace (ej: Compartido con Juan)"
                className="w-full text-sm bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-xl p-3 text-slate-700 dark:text-slate-300 outline-none focus:border-[#1152d4]"
                onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate(); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 py-2.5 text-xs font-bold bg-[#1152d4] text-white rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {generating ? (
                    <><Loader2 size={14} className="animate-spin" /> Generando...</>
                  ) : (
                    <><Plus size={14} /> Generar</>
                  )}
                </button>
                <button
                  onClick={() => { setShowNewInput(false); setNewLabel(''); }}
                  className="py-2.5 px-4 text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl active:scale-95 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewInput(true)}
              className="w-full py-3 text-xs font-bold bg-[#1152d4]/10 text-[#1152d4] dark:text-blue-400 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 hover:bg-[#1152d4]/20"
            >
              <Plus size={14} /> Generar nuevo enlace
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="text-[#1152d4] animate-spin" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Link size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No tenés enlaces generados todavía.</p>
            </div>
          ) : (
            tokens.map((t, i) => (
              <div
                key={t.id}
                className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#2d3748] rounded-xl p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white truncate mr-2">
                    {t.label}
                  </span>
                  <button
                    onClick={() => handleRevoke(t.token, i)}
                    disabled={revokingIndex === i}
                    className="p-1.5 shrink-0 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    title="Revocar enlace"
                  >
                    {revokingIndex === i ? (
                      <Loader2 size={14} className="text-red-500 animate-spin" />
                    ) : (
                      <Trash2 size={14} className="text-red-500" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  📅 {describeSettings(t.settings)}
                </p>
                <button
                  onClick={() => handleCopy(t.url, i)}
                  className="w-full py-2 text-xs font-bold bg-[#1152d4] text-white rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedIndex === i ? (
                    <><CheckCircle2 size={14} /> Copiado</>
                  ) : (
                    <><Copy size={14} /> Copiar URL</>
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {tokens.length > 0 && (
          <button
            onClick={handleRevokeAll}
            disabled={revokingAll}
            className="w-full py-2.5 text-xs font-semibold text-red-500 hover:text-red-600 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {revokingAll ? (
              <><Loader2 size={14} className="animate-spin" /> Revocando todos...</>
            ) : (
              <><Trash2 size={14} /> Revocar todos los accesos</>
            )}
          </button>
        )        }

        <div className="bg-blue-50 dark:bg-[#1152d4]/5 border border-blue-200 dark:border-[#1152d4]/20 rounded-xl p-3 space-y-1">
          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300">📱 iOS</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Configuración → Calendario → Cuentas → Agregar cuenta → Otra → Agregar calendario por suscripción
          </p>
          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-2">💻 Google Calendar</p>
          <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Otros calendarios → Agregar por URL → pegar el enlace (solo desde PC)
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 text-sm font-bold bg-[#1152d4] text-white rounded-xl active:scale-98 transition-all"
        >
          Cerrar
        </button>
      </motion.div>
    </motion.div>
  );
}
