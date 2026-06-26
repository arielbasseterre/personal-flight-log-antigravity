import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(Date.now()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // PERMITIR CUALQUIER SUBDOMINIO DE TRYCLOUDFLARE (Solución definitiva Vite 6)
      allowedHosts: ['.trycloudflare.com'],
      
      // Compatibilidad por si acaso
      disableHostCheck: true,
      
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/ping': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});