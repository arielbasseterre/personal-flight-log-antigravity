import React, { useState, useRef } from 'react';
import { supabase } from '../utils/supabase/client';
import { getApiUrl } from '../utils/api';

export const AnacAuth = ({ onAuthSuccess, cuil }: { onAuthSuccess?: (session: any) => void; cuil?: string | null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const loadingRef = useRef(false);

  const storedCuil = (cuil || '').replace(/\D/g, '');
  const isLocked = storedCuil.length === 11;

  const [formData, setFormData] = useState({
    cuil: storedCuil,
    password: '',
    rememberMe: true
  });

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    loadingRef.current = true;
    setError(null);
    setSuccess(false);
    setProgress(0);
    setStatusMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes estar logueado en la app");

      const response = await fetch(getApiUrl('/api/auth-anac'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          cuil: isLocked ? storedCuil : formData.cuil,
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No se pudo leer la respuesta del servidor");

      const decoder = new TextDecoder();
      let buffer = '';
      let result: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setStatusMessage(data.message);
              setProgress(data.progress);
            } else if (data.type === 'success') {
              result = data;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e: any) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (!result) throw new Error("No se recibió respuesta del servidor");

      setSuccess(true);
      setProgress(100);
      setStatusMessage('¡Sesión capturada!');

      if (onAuthSuccess) {
        onAuthSuccess(result.storageState);
      }

      window.dispatchEvent(new CustomEvent('anac-login-success', { detail: result.storageState }));

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4 border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800">Sincronizar con ANAC</h2>
      <p className="text-sm text-slate-500">
        Ingrese sus credenciales de ANAC
      </p>

      <form onSubmit={handleSync} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">CUIL</label>
          <input
            type="text"
            required
            disabled={isLocked}
            className={`mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${isLocked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : ''}`}
            value={formData.cuil}
            onChange={(e) => setFormData({ ...formData, cuil: e.target.value })}
            placeholder="20XXXXXXXX9"
            autoComplete="username"
          />
          {isLocked && (
            <p className="mt-1 text-[11px] text-slate-400">
              CUIL vinculado a tu cuenta (no editable)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Contraseña ANAC</label>
          <input
            type="password"
            required
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="rememberMe"
            className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
            checked={formData.rememberMe}
            onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
          />
          <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-900">
            Recordar credenciales de ANAC
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="relative overflow-hidden w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400"
        >
          {loading && (
            <div
              className="absolute inset-y-0 left-0 bg-white/20 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          )}
          <span className="relative z-10">
            {loading ? (statusMessage || 'Iniciando sesión en ANAC...') : 'Iniciar Sesión'}
          </span>
        </button>
      </form>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md border border-green-200">
          ¡Sincronización exitosa! La sesión ha sido capturada.
        </div>
      )}
    </div>
  );
};
