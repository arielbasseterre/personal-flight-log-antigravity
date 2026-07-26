import React, { useState, useEffect } from 'react';
import { supabase } from '@/src/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle, Loader2, Send, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportScreenProps {
  onBack: () => void;
}

export const ReportScreen = ({ onBack }: ReportScreenProps) => {
  const [userEmail, setUserEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [modal, setModal] = useState<{ show: boolean; title: string; message: string; type: 'info' | 'warning' | 'danger' }>({ show: false, title: '', message: '', type: 'info' });

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setUserEmail(session.user.email);
    });
  }, []);

  const isValid = title.trim().length >= 5 && title.trim().length <= 100 && description.trim().length >= 10 && description.trim().length <= 1000;

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), userEmail }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar el reporte');
      setModal({ show: true, title: 'Reporte enviado', message: 'Reporte enviado correctamente. ¡Gracias por tu ayuda!', type: 'info' });
      setTitle('');
      setDescription('');
    } catch (e: any) {
      setModal({ show: true, title: 'Error', message: e.message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#101622] text-slate-900 dark:text-white transition-colors">
      <div className="flex items-center p-4 border-b border-slate-200 dark:border-[#2d3748]">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-[#2d3748] rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold flex-1 text-center mr-8">Reportar un Problema</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2 mb-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Encontraste un error o querés sugerir una mejora? Contanos
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report_title">Título</Label>
            <Input
              id="report_title"
              placeholder="Ej: Error al sincronizar con ANAC"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-[10px] text-slate-400 text-right">{title.length}/100</p>
            {(submitted || titleTouched) && title.trim().length < 5 && (
              <p className="text-[10px] text-amber-500">Mínimo 5 caracteres</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="report_desc">Descripción</Label>
            <textarea
              id="report_desc"
              className="flex min-h-[150px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              placeholder="Describí el problema con el mayor detalle posible..."
              value={description}
              onFocus={() => setTitleTouched(true)}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
            />
            <p className="text-[10px] text-slate-400 text-right">{description.length}/1000</p>
            {submitted && description.trim().length < 10 && (
              <p className="text-[10px] text-amber-500">Mínimo 10 caracteres</p>
            )}
          </div>

          <Button
            className="w-full h-11 bg-blue-600 hover:bg-blue-700"
            onClick={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : <Send className="mr-2" size={18} />}
            {loading ? 'Enviando...' : 'Enviar Reporte'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {modal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a2233] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d3748] max-w-sm w-full p-6 space-y-4"
            >
              <div className="flex items-start gap-3">
                {modal.type === 'danger' ? (
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={24} />
                ) : (
                  <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={24} />
                )}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{modal.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{modal.message}</p>
                </div>
              </div>
              <Button
                className="w-full h-9 text-xs"
                onClick={() => {
                  setModal(prev => ({ ...prev, show: false }));
                  if (modal.type !== 'danger') {
                    onBack();
                  }
                }}
              >
                Entendido
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
