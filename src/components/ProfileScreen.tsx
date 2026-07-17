import React, { useState, useEffect } from 'react';
import {
  User,
  ArrowLeft,
  Clock,
  History,
  BarChart3,
  ChevronRight,
  LogOut,
  AlertTriangle,
  AlertCircle,
  Info,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Profile, FlightLog } from '@/src/types';
import { supabase } from '@/src/utils/supabase/client';

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

interface ProfileScreenProps {
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  logs: FlightLog[];
  refreshData: () => Promise<Profile | null>;
  loading: boolean;
  userId: string;
  onBack: () => void;
}

export const ProfileScreen = ({ profile, setProfile, logs, refreshData, loading, userId, onBack }: ProfileScreenProps) => {
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isRenewingSubscription, setIsRenewingSubscription] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
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

  useEffect(() => {
    const shouldScroll = localStorage.getItem('draft_flight_log_scroll_to_subscription');
    if (shouldScroll) {
      localStorage.removeItem('draft_flight_log_scroll_to_subscription');
      setTimeout(() => {
        document.getElementById('subscription-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  const handleProfileFieldChange = (field: keyof Profile, value: any) => {
    setProfile(prev => {
      if (!prev) return null;
      const updated = { ...prev, [field]: value };
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

  const handleRenewSubscription = async () => {
    if (!profile) return;
    setIsRenewingSubscription(true);
    try {
      const response = await fetch('/api/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          email: profile.email || '',
          password: 'RENEWAL_DUMMY_PASSWORD',
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          license: profile.license || '',
          dni: profile.dni || '',
          legajo: profile.legajo || ''
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al renovar');
      if (data.init_point) {
        setPendingCheckoutUrl(data.init_point);
      } else {
        throw new Error('No se recibió la URL de pago');
      }
    } catch (err: any) {
      showAlert("Error", err.message || "No se pudo renovar la suscripción", "danger");
    } finally {
      setIsRenewingSubscription(false);
    }
  };

  const updateProfile = async () => {
    if (!supabase || !profile) return;
    setIsSavingProfile(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const authUser = session?.user;
      if (!authUser) throw new Error("No hay sesión de usuario activa");

      const { ...toSave } = profile;
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

      const { error } = await supabase
        .from('profiles')
        .upsert({
          ...toSave,
          id: authUser.id,
          initial_total_hours: parseFloat(initialTotal.toFixed(1)),
          grand_total_hours: parseFloat(grandTotal.toFixed(1))
        }, { onConflict: 'id' });

      if (error) throw error;
      await refreshData();
      showAlert("Perfil Actualizado", "Los cambios en tu perfil han sido guardados correctamente.", 'info');
    } catch (error: any) {
      console.error("Error updating profile:", error);
      showAlert("Error al Actualizar", error.message || 'Ocurrió un problema al guardar los cambios.', 'danger');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await supabase?.auth.signOut();
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101622] shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-sm font-bold text-slate-900 dark:text-white">Perfil</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-12 relative">
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
                <Input id="prof_email" value={profile?.email || ''} disabled className="bg-slate-50 dark:bg-slate-800 text-slate-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prof_nombre">Nombre</Label>
                  <Input id="prof_nombre" value={profile?.first_name || ''} onChange={e => setProfile(prev => prev ? {...prev, first_name: e.target.value} : null)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prof_apellido">Apellido</Label>
                  <Input id="prof_apellido" value={profile?.last_name || ''} onChange={e => setProfile(prev => prev ? {...prev, last_name: e.target.value} : null)} />
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
                  <Input id="prof_legajo" value={profile?.legajo || ''} onChange={e => setProfile(prev => prev ? {...prev, legajo: e.target.value} : null)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prof_dni">DNI / Pasaporte</Label>
                <Input id="prof_dni" value={profile?.dni || ''} onChange={e => setProfile(prev => prev ? {...prev, dni: e.target.value} : null)} />
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

                  <div className="p-3 bg-slate-900 dark:bg-slate-800 rounded-lg border border-slate-700">
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2">Configuración de Folio</div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-white">Próximo Folio Nº a Generar</Label>
                      <Input type="number" className="h-8 text-xs bg-slate-800 border-slate-600 text-white" placeholder="Ej: 1" value={profile?.initial_folio_number ?? ''} onChange={e => setProfile(prev => prev ? {...prev, initial_folio_number: e.target.value === '' ? null : (parseInt(e.target.value) || 0)} : null)}/>
                      <p className="text-[9px] text-slate-400 mt-1">Establece el número con el que se identificará tu primer PDF generado.</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-4">
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

              {profile?.subscription_end_date && (
                <Card id="subscription-card" className={`mt-4 mb-4 ${profile.subscription_status === 'cancelled' ? 'border-red-200 dark:border-red-900/40 bg-red-50/10 dark:bg-red-900/5' : 'border-blue-100 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-900/5'}`}>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      {profile.subscription_status === 'cancelled' ? '❌' : '💳'} Suscripción
                      <span className="ml-auto text-[10px] font-normal text-slate-400">
                        {(() => {
                          const d = profile?.subscription_end_date
                            ? Math.ceil((new Date(profile.subscription_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                          return d >= 0 ? `${d} días restantes` : '';
                        })()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    {profile.subscription_id && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">ID:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{profile.subscription_id}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Vencimiento:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {new Date(profile.subscription_end_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Estado:</span>
                      <Badge className={`capitalize text-[10px] ${profile.subscription_status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {profile.subscription_status === 'cancelled' ? 'Cancelada' : 'Activa'}
                      </Badge>
                    </div>
                    {(() => {
                      const daysRemaining = profile?.subscription_end_date
                        ? Math.ceil((new Date(profile.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const isWithin30Days = daysRemaining >= 0 && daysRemaining <= 30;
                      return profile.subscription_status !== 'cancelled' && isWithin30Days ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full mt-2 text-xs font-semibold rounded-lg h-9 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={handleRenewSubscription}
                          disabled={isRenewingSubscription}
                        >
                          {isRenewingSubscription ? 'Redirigiendo a Mercado Pago...' : 'Renovar Suscripción'}
                        </Button>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              )}

              <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl" onClick={updateProfile} disabled={isSavingProfile || !profile}>
                {isSavingProfile ? 'Guardando...' : 'Actualizar Perfil'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !confirmModal.isAlert && confirmModal.onCancel?.()}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{confirmModal.message}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                {!confirmModal.isAlert && (
                  <Button variant="outline" className="flex-1 rounded-xl h-12 font-semibold" onClick={() => confirmModal.onCancel?.()}>
                    {confirmModal.cancelText || 'Cancelar'}
                  </Button>
                )}
                <Button className={`flex-1 rounded-xl h-12 font-bold text-white shadow-lg ${
                  confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' :
                  confirmModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' :
                  'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`} onClick={confirmModal.onConfirm}>
                  {confirmModal.confirmText || 'Aceptar'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingCheckoutUrl && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a2233] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <CreditCard size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirmar pago</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Serás redirigido a Mercado Pago para realizar el pago de tu suscripción anual.
                </p>
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 text-left">
                  <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold mb-1">Importante</p>
                  <p className="text-xs text-amber-700 dark:text-amber-500 leading-relaxed">
                    Este es un pago único anual. Al finalizar el período de 12 meses deberás renovar manualmente la suscripción. No se realizarán cobros automáticos.
                  </p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-12 font-semibold" onClick={() => setPendingCheckoutUrl(null)}>Cancelar</Button>
                <Button className="flex-1 rounded-xl h-12 font-bold text-white shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-600/20" onClick={() => { window.location.href = pendingCheckoutUrl; }}>
                  <CreditCard className="mr-2" size={18} /> Ir a Pagar
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
