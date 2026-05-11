import React, { useState } from 'react';
import { supabase } from '../utils/supabase/client';

export const AnacAuth = ({ onAuthSuccess }: { onAuthSuccess?: (session: any) => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    cuil: '',
    password: '',
    rememberMe: true
  });

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 1. Obtener el usuario actual de Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes estar logueado en la app");

      // 2. Llamar a nuestro servidor local
      const response = await fetch('/api/auth-anac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          cuil: formData.cuil,
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error en la sincronización");
      }

      setSuccess(true);
      console.log("Sesión capturada:", result.storageState);
      
      if (onAuthSuccess) {
        console.log("Ejecutando prop onAuthSuccess...");
        onAuthSuccess(result.storageState);
      }
      
      // Fallback: Evento global
      console.log("Lanzando evento global 'anac-login-success'...");
      window.dispatchEvent(new CustomEvent('anac-login-success', { detail: result.storageState }));
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            value={formData.cuil}
            onChange={(e) => setFormData({...formData, cuil: e.target.value})}
            placeholder="20XXXXXXXX9"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Contraseña ANAC</label>
          <input
            type="password"
            required
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 shadow-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            autoComplete="current-password"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="rememberMe"
            className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
            checked={formData.rememberMe}
            onChange={(e) => setFormData({...formData, rememberMe: e.target.checked})}
          />
          <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-900">
            Recordar credenciales de ANAC
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400"
        >
          {loading ? 'Sincronizando...' : 'Iniciar Sesión'}
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
