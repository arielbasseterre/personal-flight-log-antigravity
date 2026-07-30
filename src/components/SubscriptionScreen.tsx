import React, { useState } from 'react';
import {
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Profile } from '@/src/types';

interface SubscriptionScreenProps {
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshData: () => Promise<Profile | null>;
  onBack: () => void;
}

export const SubscriptionScreen = ({ profile, setProfile, refreshData, onBack }: SubscriptionScreenProps) => {
  const [isRenewingSubscription, setIsRenewingSubscription] = useState(false);
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRenewSubscription = async () => {
    if (!profile) return;
    setIsRenewingSubscription(true);
    setError(null);
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
      setError(err.message || 'Error al procesar la suscripción');
    } finally {
      setIsRenewingSubscription(false);
    }
  };

  const daysRemaining = profile?.subscription_end_date
    ? Math.ceil((new Date(profile.subscription_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const isWithin30Days = daysRemaining >= 0 && daysRemaining <= 30;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] transition-colors">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101622] shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-sm font-bold text-slate-900 dark:text-white">Suscripción</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4 pb-12">
          {profile?.subscription_end_date ? (
            <Card className={profile.subscription_status === 'cancelled' ? 'border-red-200 dark:border-red-900/40 bg-red-50/10 dark:bg-red-900/5' : 'border-blue-100 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-900/5'}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  {profile.subscription_status === 'cancelled' ? '❌' : '💳'} Suscripción
                  <span className="ml-auto text-[10px] font-normal text-slate-400">
                    {daysRemaining >= 0 ? `${daysRemaining} días restantes` : ''}
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
                {profile.subscription_status !== 'cancelled' && isWithin30Days && (
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-2 text-xs font-semibold rounded-lg h-9 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleRenewSubscription}
                    disabled={isRenewingSubscription}
                  >
                    {isRenewingSubscription ? 'Redirigiendo a Mercado Pago...' : 'Renovar Suscripción'}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-200 dark:border-amber-900/30 bg-amber-50/10 dark:bg-amber-900/5">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Sin suscripción activa
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No tenés una suscripción activa. Para acceder a todas las funcionalidades de la app, necesitás una suscripción anual.
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full mt-2 text-xs font-semibold rounded-lg h-9 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleRenewSubscription}
                  disabled={isRenewingSubscription}
                >
                  {isRenewingSubscription ? (
                    <><Loader2 className="animate-spin mr-2" size={14} /> Redirigiendo...</>
                  ) : (
                    'Suscribirse'
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-red-700 dark:text-red-400">Error</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

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
