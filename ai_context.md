# Contexto de IA para el Proyecto: personal-flight-log

Este archivo sirve para mantener a cualquier modelo de IA (en VS Code, Antigravity u otros entornos de desarrollo) alineado sobre el estado actual, la arquitectura, configuraciones críticas e historial del proyecto.

---

## 1. Propósito del Proyecto
`personal-flight-log` es una aplicación de registro de vuelos personal diseñada para pilotos. Permite:
- Cargar y visualizar bitácoras de vuelo.
- Gestionar tramos, simulación de vuelos y tripulaciones.
- Sincronizar automáticamente tramos mensuales del roster a través de la integración con **ARMS**.
- Sincronizar los registros directamente con la **ANAC** (Administración Nacional de Aviación Civil de Argentina), automatizando la carga de vuelos en su portal de Foliado Web.

---

## 2. Tecnologías y Arquitectura
- **Frontend**: React (con el compilador de Vite) estructurado en componentes de TypeScript (`.tsx`). Estilado principal con **Tailwind CSS**.
- **Backend**: Servidor Express en Node.js (`server.ts`) corriendo en el puerto `3000` (o el puerto especificado en la variable `PORT`).
- **Base de Datos y Backend-as-a-Service**: **Supabase** para persistencia de datos (vuelos, sesiones de usuarios de ARMS, sesiones remotas, y tokens FCM de notificaciones push).
- **Scraping e Integración ANAC / ARMS**: 
  - **Playwright (Chromium)**: Se ejecuta headless en el backend para iniciar sesión en el portal de ANAC y en el sistema de ARMS usando las credenciales del usuario, recuperando cookies de sesión y resolviendo el flujo de autenticación.
  - **Axios**: Utilizado para enviar peticiones POST estructuradas directamente a las APIs internas de ANAC (`/api/VueloTripulante/Create` en `cad.anac.gob.ar` o en su fallback `cadam.anac.gob.ar`).

---

## 3. Configuraciones Críticas de Infraestructura
- **Allowed Hosts en Vite (`vite.config.ts`)**: 
  Para permitir la visualización y desarrollo de la aplicación cuando se expone a través de túneles externos temporales (como Cloudflare Tunnel / Quick Tunnels), se configuró el bypass de seguridad de Vite 6 para admitir cualquier subdominio dinámico de Cloudflare:
  ```typescript
  server: {
    allowedHosts: ['.trycloudflare.com'],
    disableHostCheck: true, // Compatibilidad adicional
    // ...
  }
  ```
- **Proxy de Vite**: 
  El servidor de desarrollo de Vite redirige todas las llamadas de `/api` y `/ping` hacia `http://localhost:3000` (el servidor Express de backend).

---

## 4. Historial de Cambios Recientes
- **Resolución de Bloqueo de Host de Vite**: Se añadió `.trycloudflare.com` a la propiedad `server.allowedHosts` en `vite.config.ts` para posibilitar el desarrollo a través de túneles dinámicos de Cloudflare sin recibir el error `Blocked host`.
- **Corrección de Timeouts por IPv6 / ENOTFOUND**:
  Se detectaron fallas de conexión (timeouts y errores `ENOTFOUND` / `ECONNABORTED`) en llamadas salientes hacia los dominios de la ANAC (`cad.anac.gob.ar`) desde entornos virtuales. Se resolvió forzando la resolución de nombres DNS para priorizar IPv4 sobre IPv6 en Express (`server.ts`):
  ```typescript
  import dns from "dns";
  dns.setDefaultResultOrder('ipv4first');
  ```
- **Limpieza de Recursos Temporales**: Se removieron los scripts de diagnóstico local (`scripts/analyze-anac-bundle.ts`) y la configuración e instancias locales de Supabase Edge Functions (`supabase/`) que no eran requeridas por la aplicación de producción.

---

## 5. Próximos Pasos
- [ ] Monitorear la estabilidad de la sincronización con los endpoints de la ANAC (usando el fallback de `cadam.anac.gob.ar` cuando `cad.anac.gob.ar` falle).
- [ ] Probar la persistencia y refresco de sesiones de autenticación para ARMS y ANAC almacenadas en Supabase (`arms_sessions` y `user_remote_sessions`).
- [ ] Validar el correcto flujo de envío de notificaciones push (FCM) registradas en la tabla `push_tokens`.
