import { Capacitor } from '@capacitor/core';

/**
 * Retorna la URL de API correcta según la plataforma.
 * En móviles (Capacitor nativo), apunta al backend absoluto en producción (Render/Vercel).
 * En la web, mantiene la ruta relativa ('/api/...') aprovechando el proxy de Vite o el hosting integrado.
 */
export const getApiUrl = (endpoint: string): string => {
  const isMobileNative = Capacitor.isNativePlatform();
  
  if (isMobileNative) {
    // Si estás en producción móvil, apunta a tu servidor backend alojado en Render/Vercel.
    // Puedes configurar VITE_API_URL en tu .env móvil o usar el fallback por defecto.
    const productionBackend = import.meta.env.VITE_API_URL || 'https://personal-flight-log-backend.onrender.com'; // Reemplazar con tu URL de Render real si difiere
    return `${productionBackend.replace(/\/$/, '')}${endpoint}`;
  }
  
  return endpoint;
};
