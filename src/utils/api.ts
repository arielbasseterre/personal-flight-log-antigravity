import { Capacitor } from '@capacitor/core';

/**
 * Retorna la URL de API correcta según la plataforma.
 * - Móvil (Capacitor) o cuando hay VITE_API_URL configurado: apunta al backend absoluto
 *   (Render/Vercel). En local, si VITE_API_URL apunta a Render, el login ANAC y el sync
 *   corren en el servidor de Render (IP no bloqueada por el anti-bot de ANAC).
 * - En web sin VITE_API_URL: mantiene la ruta relativa ('/api/...') aprovechando el
 *   mismo host que sirve la app o el proxy de Vite.
 */
export const getApiUrl = (endpoint: string): string => {
  const isMobileNative = Capacitor.isNativePlatform();
  const configuredBackend = import.meta.env.VITE_API_URL;

  if (isMobileNative || configuredBackend) {
    const productionBackend = configuredBackend || 'https://personal-flight-log-backend.onrender.com';
    return `${productionBackend.replace(/\/$/, '')}${endpoint}`;
  }

  return endpoint;
};
