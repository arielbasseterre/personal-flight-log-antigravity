# Contexto de IA para el Proyecto: personal-flight-log

Este archivo sirve para mantener a cualquier modelo de IA (en VS Code, Antigravity u otros entornos de desarrollo) alineado sobre el estado actual, la arquitectura, configuraciones críticas e historial del proyecto.

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

---

## 1. Propósito del Proyecto
`personal-flight-log` es una aplicación de registro de vuelos personal diseñada para pilotos. Permite:
- Cargar y visualizar bitácoras de vuelo.
- Gestionar tramos, simulación de vuelos y tripulaciones.
- Sincronizar automáticamente tramos mensuales del roster a través de la integración con **ARMS**.
- Sincronizar los registros directamente con la **ANAC** (Administración Nacional de Aviación Civil de Argentina), automatizando la carga de vuelos en su portal de Foliado Web.

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

---

## 2. Tecnologías y Arquitectura
- **Frontend**: React (con el compilador de Vite) estructurado en componentes de TypeScript (`.tsx`). Estilado principal con **Tailwind CSS**.
- **Backend**: Servidor Express en Node.js (`server.ts`) corriendo en el puerto `3000` (o el puerto especificado en la variable `PORT`).
- **Base de Datos y Backend-as-a-Service**: **Supabase** para persistencia de datos (vuelos, sesiones de usuarios de ARMS, sesiones remotas, y tokens FCM de notificaciones push).
- **Scraping e Integración ANAC / ARMS**: 
  - **Playwright (Chromium)**: Se ejecuta headless en el backend para iniciar sesión en el portal de ANAC y en el sistema de ARMS usando las credenciales del usuario, recuperando cookies de sesión y resolviendo el flujo de autenticación.
  - **Axios**: Utilizado para enviar peticiones POST estructuradas directamente a las APIs internas de ANAC (`/api/VueloTripulante/Create` en `cad.anac.gob.ar` o en su fallback `cadam.anac.gob.ar`).

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

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

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

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
- **Fix login intermitente (15-Jun-2026)**: Se agregó `await supabase.auth.signOut({ scope: 'local' })` antes de `signInWithPassword` en `AuthScreen.tsx` para limpiar sesión stale de localStorage que causaba falsos "Invalid login credentials" en usuarios existentes.
- **Bug report system (16-Jun-2026)**: `ReportScreen.tsx` con formulario (título 5-100 chars, descripción 10-1000 chars, contadores), `POST /api/report` endpoint con validación e insert en `bug_reports` de Supabase, botón "Reportar un problema" en HomeScreen para usuarios logueados.
- **Fix Vite middleware local (16-Jun-2026)**: `POST /api/report` movido antes del bloque `app.use(vite.middlewares)` para que Express lo maneje primero en dev. En producción no ocurría porque usa `express.static`.
- **Email notification via Edge Function (16-Jun-2026)**: Función `send-bug-report-notification` deployada en Supabase. Database Webhook en `bug_reports` (INSERT) envía correo via Resend a `gringo.soft.ar@gmail.com`. Stack: Deno + Resend API.
- **Auto-update checker (21-Jun-2026)**: Service Worker modificado (sacado `skipWaiting` del install, agregado listener `SKIP_WAITING` por mensaje). App.tsx: `useEffect` que cada 24h llama a `reg.update()`, también al reabrir la app. Cuando detecta nuevo SW instalado, muestra overlay "Descargando nueva versión, por favor espere..." y activa el update automáticamente.
- **Payment confirmation modal (21-Jun-2026)**: Antes de redirigir a MP, se muestra un modal de confirmación con texto aclaratorio: "Este es un pago único anual. Al finalizar el período de 12 meses deberás renovar manualmente la suscripción. No se realizarán cobros automáticos." Botones "Ir a Pagar" / "Cancelar".
- **Fix callback redirect MP (21-Jun-2026)**: Se agregó `resolveFrontendUrl()` en el callback `subscription-callback` para que resuelva la URL de redirect usando `req.headers.origin/referer` en vez de depender exclusivamente de `VITE_API_URL`, evitando pantalla blanca post-pago si la env var no está configurada en Render.
- **Exportar roster a calendario (22-Jun-2026)**: Botón "Exportar" en ArmsRosterScreen que abre menú con dos opciones: "Exportar a Calendario" (archivo .ICS) y "Almanaque PDF".
- **ICS export fix**: Se agregó `DTSTAMP` (RFC 5545), UIDs determinísticos (`arms-{date}-{flight}-{i}@flightlog`), se removió `METHOD:PUBLISH`, y se reemplazó `→` por `-` para compatibilidad con Google Calendar.
- **Almanaque PDF (nuevo componente @react-pdf/renderer)**: `AlmanaquePDF.tsx` renderiza calendario mensual A4 landscape en una sola página. Muestra rutas en bold, horarios de presentación en línea separada, tiempos de vuelo, flight numbers, guardias con rango horario, escalas, OFF/NDA. Siempre cabe en 1 página ajustando altura de celdas según semanas.
- **Version bump**: 1.4.3 → 1.4.4
- **Resumen Mensual de Roster (23-Jun-2026)**: Nuevo panel de estadísticas mensuales debajo del detalle de actividad en `ArmsRosterScreen.tsx`. Calcula dinámicamente via `React.useMemo` desde los entries existentes: Flight Time (FT), Duty Period (DP), cantidad de Flight Duties, días OFF, Licencias, Standby, Enfermedad, Entrenamiento y Simulador. Compatible retroactivamente con rosters previamente sincronizados.
- **Almanaque PDF fix superposición (23-Jun-2026)**: Mejora del diseño del componente `AlmanaquePDF.tsx` para evitar superposición de texto en celdas con múltiples actividades. Rediseño estético general manteniendo toda la información existente.
- **RLS en pending_registrations (23-Jun-2026)**: Análisis confirmó que habilitar RLS en `pending_registrations` no tiene impacto en ninguna de las dos apps (v1 y v2) porque `server.ts` usa `SUPABASE_SERVICE_ROLE_KEY` que bypasea RLS. Verificado en variables de entorno de Render.
- **Version bump**: 1.4.4 → 1.4.5
- **Compatibilidad con Safari 15 / iOS 15.8.7 (24-Jun-2026)**:
  Se detectó que en dispositivos iOS antiguos (como Safari 15.8.7 en iPhone 6s/7), el fondo de los recuadros de horas aparecía transparente o blanco debido a la falta de soporte para el espacio de color `oklch()`.
  Se resolvieron los problemas convirtiendo todos los valores `oklch()` a formato hexadecimal/rgba en `:root` y `.dark` dentro de `src/index.css`.
  Adicionalmente, se reemplazaron los gradientes Tailwind en Tailwind CSS (`bg-gradient-to-...` que utilizaban opacidades de Slate) por propiedades `style={{ background: 'linear-gradient(...)' }}` inline con colores hexadecimales planos/rgba para asegurar que se rendericen correctamente en Safari antiguo.
   Se aplicó este mismo fix de compatibilidad a la versión v1 (`D:\app Antigravity\personal-flight-log sin roster`).
- **Fix chart actividad reciente (24-Jun-2026)**: El grafico de barras "Actividad Reciente" y la tabla de vuelos omitian horas de copiloto en el total mensual cuando el vuelo no tenia `horasDia`/`horasNoche`. Se agregaron los 4 campos de copiloto al fallback en `chartData` y en el display de la tabla.
- **Fix barra total (24-Jun-2026)**: El `LabelList` del total mensual no se mostraba cuando `nocturna = 0` (solo horas diurnas) porque Recharts no renderiza el label en un segmento de barra con altura 0. Se agregó `minPointSize={0.1}` a la barra `nocturna` para forzar un segmento mínimo que el LabelList pueda usar como ancla.
- **Fix layout iPad Safari (24-Jun-2026)**: El contenedor raíz usaba `h-screen overflow-hidden` que en iOS Safari cortaba el contenido porque `100vh` incluye el área detrás de las barras del navegador. Reemplazado por `min-h-screen` sin `overflow-hidden`. Tambien se agregó `viewport-fit=cover` al meta viewport tag.
- **Fix SW update detection (24-Jun-2026)**: El codigo nunca revisaba si ya habia un SW esperando (eg.waiting). Agregado check de eg.waiting, eg.installing, y eg.update() inmediato. Overlay reemplazado por banner azul con timeout de 2s antes de SKIP_WAITING.
- **Fix PDF.js self-host (24-Jun-2026)**: CSP de Safari bloqueaba carga dinamica desde CDN. Descargado a public/assets/ y cargado desde self. Eliminado cdnjs de CSP.
- **Fix WASM bloqueado por CSP (25-Jun-2026)**: @react-pdf/renderer usa yoga-layout con WASM binario. WebAssembly.instantiate(buffer) requiere unsafe-eval en CSP. Agregado a script-src en server.ts.
- **Build version injection (25-Jun-2026)**: Creado inject-sw-version.cjs que inyecta timestamp de build en dist/sw.js post-vite build. Cada deploy fuerza deteccion de actualizacion.
- **Admin notification via Brevo (25-Jun-2026)**: El endpoint `POST /api/send-welcome-email` en `server.ts` ahora envía notificación administrativa a `gringo.soft.ar@gmail.com` vía Brevo después del welcome email al usuario. La Edge Function `welcome-email` (Resend) también fue modificada pero no está conectada al webhook.
- **Fix escaped interpolation en welcome email (\${firstName}) (25-Jun-2026)**: En el HTML del welcome email, `${firstName}` estaba escapado como `\${firstName}`, mostrando el texto literal en vez del nombre del usuario. Corregido en ambas versiones.
- **Modal de registro exitoso en App.tsx (25-Jun-2026)**: El `alert()` nativo del navegador fue reemplazado por un modal overlay estilizado renderizado desde `App.tsx` (z-[9999], encima de cualquier screen). Al registrarse, `onRegisterSuccess` callback desde `AuthScreen` dispara `setRegisterAlert` en App. El modal persiste aunque el listener de auth navegue a MainScreen (auto-confirmación).
- **Personalización de exportación de calendario WebCal (25-Jun-2026)**: Agregada columna `calendar_settings` (JSONB) en la tabla `profiles`. El endpoint `/api/roster/calendar/:token` y el exportador manual `ics.ts` ahora aplican filtros de exclusión (deadheads, guardias, días libres, escalas, simuladores, reportes, debriefs), filtrado temporal, unificación de tramos de vuelo diarios (`aggregateFlights`), y minutos de post-bloque. En la UI (`ArmsRosterScreen.tsx`), el modal de suscripción se expandió con controles deslizantes y dropdowns para configurar cada sección con persistencia automática (*auto-save*) directa en Supabase. Excluida la carpeta `supabase` de la compilación en `tsconfig.json` para evitar chequeos de tipo sobre funciones edge de Deno.
- **Multi-token calendar system (25-Jun-2026)**: Nueva tabla `calendar_tokens` en Supabase para soportar múltiples enlaces de suscripción por usuario. Cada token tiene snapshot de calendar_settings (`jsonb`), label editable, y `revoked_at`. Nuevos endpoints en server.ts: `POST /api/roster/generate-token` (siempre crea token nuevo, nunca reusa), `GET /api/roster/my-tokens` (lista por user), `POST /api/roster/revoke-token` (revocación individual por token), `POST /api/roster/revoke-all-tokens` (revocación masiva por user), `GET /api/roster/calendar/:token` (sirve ICS usando el snapshot del token). `MisEnlacesModal.tsx`: componente que lista enlaces, permite generar con label, copiar URL, revocar individual o masivo. RLS policies creadas. Si el perfil no tiene `calendar_settings`, usa defaults completos.
- **ExportICSModal (25-Jun-2026)**: Reemplazado el botón directo "Exportar a Calendario" + "Preferencias de Exportación" del menú ExportMenuModal por un único botón "Exportar Calendario (.ICS)" que abre `ExportICSModal`. Este combina todos los filtros/formato (mismos controles que PreferencesModal) con el botón "Descargar .ICS". Los settings se cargan de DB pero se modifican in-memory, sin guardar. El menú de exportación queda simplificado a 3 opciones: Almanaque PDF, Exportar Calendario (.ICS), Suscribir Calendario.
- **Fix SW doble banner (25-Jun-2026)**: En App.tsx, el `useEffect` de detección de actualización SW tenía dos listeners (arrow functions inline) en `reg.installing` + `updatefound` que el navegador trataba como distintos aunque apuntaran al mismo SW, causando doble banner en Chrome/Android. Fix: usar una sola función listener con nombre (`onStateChange`) — el navegador descarta automáticamente `addEventListener` duplicados con la misma referencia de función.
- **user_email en calendar_tokens (26-Jun-2026)**: Agregada columna `user_email TEXT` a la tabla `calendar_tokens` para identificar usuarios al revisar la tabla directamente en Supabase. `generate-token` ahora obtiene el email desde `profiles.email` y lo guarda al crear el token.
- **DTSTART usa horario de presentación (27-Jun-2026)**: En `ics.ts` y `server.ts`, `DTSTART` de vuelos ahora usa `reportTimeLoc` en vez de `departureTimeLoc`. Si no hay report time, cae a departure.
- **Floating local → UTC con date shift (27-Jun-2026)**: Abandonado floating local por ambigüedad con calendarios que lo interpretan como UTC. Ahora DTSTART/DTEND usan UTC con `Z` y detección de cambio de día: si `startUtc < startLoc` → fecha UTC = fecha local + 1. Nuevo helper `getUtcForLoc` que mapea local→UTC y estima UTC mediante offset si el campo directo falta. Eliminado `toFloatingDatetime`. Mismos cambios en `ics.ts` y `server.ts`.
- **Fix ✈️ en WebCal (27-Jun-2026)**: `server.ts` no tenía `summary = `✈️ ${summary}`;` en ninguno de los dos bloques (agregado e individual). `ics.ts` sí lo tenía. Agregado.
- **Fix reportTime fallback (27-Jun-2026)**: Cuando `reportTimeUtc` está vacío (ARMS no muestra UTC para presentación), `getUtcForLoc` ahora calcula el UTC estimado usando el offset entre `departureTimeLoc`/`departureTimeUtc`. Antes devolvía `departureTimeUtc` (hora de salida), causando que DTSTART ignorara la presentación.
- **ANAC login progress streaming (27-Jun-2026)**: `POST /api/auth-anac` ahora envía NDJSON con progreso real en cada etapa (DNS, browser, navigate, credentials, waiting, session, done). `AnacAuth.tsx` lee el stream con `response.body.getReader()` y muestra barra de progreso animada + texto de etapa dentro del botón.
- **Fix DNS timeout en Windows/Node v24 (27-Jun-2026)**: `dns.promises.lookup()` tarda ~11s en resolver `cad.anac.gob.ar` en Windows con Node.js v24, superando el timeout de 3s del `Promise.race`. Reemplazado por `dns.promises.resolve4()` que resuelve en ~9ms.
- **Fix SSL clock drift en Render (27-Jun-2026)**: Agregado `ignoreHTTPSErrors: true` al `browser.newContext()` de Playwright para evitar falsos positivos de certificado cuando el reloj del servidor Render está desviado.
- **Cambios replicados a v1 (28-Jun-2026)**: ANAC progress NDJSON + barra de progreso, SSL ignoreHTTPSErrors, SW update fix (capturar `sw = reg.installing` en closure), VITE_BUILD_TIME en vite.config.ts, inline SW script removido de index.html.
- **Fix race condition getBrowser (28-Jun-2026)**: `browserLaunchPromise` como semáforo para evitar lanzar Chromium dos veces si dos requests simultáneos llegan con `globalBrowser === null`. `try/finally` limpia la promesa también si `chromium.launch()` falla.
- **Progress "Preparando navegador..." (28-Jun-2026)**: `sendProgress('Preparando navegador...', 20)` antes de `getBrowser()` para que usuarios en espera vean progreso mientras otro usuario usa Chromium.

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

---

## 5. Features a Desarrollar

### ✅ Completado — Mercado Pago (Suscripciones)
Sistema de pagos por suscripción anual implementado con redirect checkout de MP. Copiar referencia de implementación desde v1 (`D:\app Antigravity\personal-flight-log sin roster\server.ts`).

**Referencia de implementación en v1:** Ver sección "Lecciones Aprendidas" y "Decisiones Técnicas" más abajo para evitar errores conocidos.

- [x] Fix login intermitente (15-Jun-2026): `signOut({ scope: 'local' })` antes de `signInWithPassword` en AuthScreen

### ✅ Completado — Compatibilidad con Navegadores/iOS Antiguos (Safari 15.8.7)
- [x] Corrección de valores `oklch()` a Hexadecimal en `src/index.css` (temas claro y oscuro) para corregir recuadros transparentes.
- [x] Reemplazo de gradientes Tailwind problemáticos (`bg-gradient-to-...`) por estilos inline `linear-gradient` con colores hexadecimales en `LibroScreen.tsx` y `PdfViewer.tsx` (y equivalentes en versión v1).
- [x] Replicado de cambios en la versión v1 (`D:\app Antigravity\personal-flight-log sin roster`).

### ✅ Completado — Roster Export (Calendario ICS + Almanaque PDF)
Sistema de exportación de roster en dos formatos desde ArmsRosterScreen.

- [x] Botón "Exportar" con menú modal de dos opciones
- [x] Exportar a Calendario: archivo .ICS con DTSTAMP, UIDs determinísticos, sin METHOD:PUBLISH
- [x] Almanaque PDF: componente @react-pdf/renderer con calendario A4 landscape en 1 página
- [x] Soporte: vuelos (rutas, presentación, horarios, flight numbers), guardias, GTR, escalas, OFF/NDA
- [x] Texto legible: rutas en bold, detalles en 7pt, sin truncar
- [x] Export mobile: Capacitor Filesystem + Share (mismo patrón que LibroScreen)
- [x] Export web: file-saver (descarga directa)
- [x] Fix superposición de texto en celdas con múltiples actividades (23-Jun-2026)

### ✅ Completado — Resumen Mensual de Estadísticas del Roster
Panel de estadísticas mensuales en `ArmsRosterScreen.tsx`, calculado dinámicamente con `React.useMemo`.

- [x] Flight Time (FT): suma de horas de vuelo del mes, parseadas desde `flightTime` de cada entry
- [x] Duty Period (DP): calculado desde `reportTime` hasta `arrivalTime` + 30min debrief para vuelos, o duración completa para Standby/GTR
- [x] Conteo de Flight Duties, OFF, Licencias, Standby, Enfermedad, Entrenamiento, Simulador
- [x] Clasificación por `activityType` del entry (FLIGHT, OFF, LEAVE, STANDBY, SICK, TRAINING, SIMULATOR)
- [x] UI premium con tarjeta animada (framer-motion), dos columnas (tiempos + días), contadores en cero atenuados
- [x] Compatible retroactivamente con todos los rosters previamente sincronizados

### 🟡 Pendiente — Trial 30 días (implementado en v1)
- [ ] Endpoint `POST /api/mercadopago/register-with-trial` — crea usuario con `admin.createUser()` + perfil con trial 30d, devuelve `access_token` + `refresh_token` para auto-login directo
- [ ] En AuthScreen: llamar a `register-with-trial`, usar `setSession()` con tokens del server (no `signInWithPassword`)
- [ ] HomeScreen: mostrar "Período de prueba gratuito" en card verde cuando `!subscription_id && subscription_end_date`
- [ ] SubscriptionExpiredScreen: mensaje diferenciado "Período de prueba vencido" para trial vs "Suscripción Expirada" para pago
- [ ] Columna `mp_payer_email TEXT` en `profiles` (ejecutar `scripts/add_mp_payer_email.sql`)
- [ ] Los 8 puntos de callback/webhook guardan `mp_payer_email` en el perfil

### 🟡 Pendiente — Renovación anticipada (implementado en v1)
- [ ] LibroScreen: botón "Renovar Suscripción" azul cuando falten ≤ 30 días (reemplaza "Cancelar Suscripción" que se elimina)
- [ ] `handleRenewSubscription()`: llama a `POST /api/mercadopago/create-subscription` y redirige a `init_point`
- [ ] Callback y webhook: detectar si el usuario ya tiene `subscription_end_date` futura y sumarle 12 meses (stack) en vez de usar hoy + 365
- [ ] El botón de cancelar se elimina completamente (ya no existe en v1)

### 🟡 Pendiente — Centrado vertical del login (implementado en v1)
- [ ] AuthScreen: cambiar `h-full` → `flex-1` en el root div
- [ ] AuthScreen: agregar `-mt-8` al `motion.div` del contenido para desplazar el formulario 32px arriba del centro
- [ ] App.tsx (`case 'libro'`): cambiar `flex-1 overflow-y-auto` → `flex flex-col flex-1 overflow-y-auto` en el contenedor padre de AuthScreen

### 🟡 Pendiente — Navegación card suscripción → perfil (implementado en v1)
- [ ] HomeScreen: la card de suscripción debe ser clickable, seteando `localStorage.setItem('draft_flight_log_active_tab', 'perfil')` + `localStorage.setItem('draft_flight_log_scroll_to_subscription', 'true')` y navegando a `'libro'`
- [ ] LibroScreen: agregar `id="subscription-card"` al Card de suscripción
- [ ] LibroScreen: en el `useEffect` de `activeTab === 'perfil'`, hacer `scrollIntoView` a `#subscription-card` solo si la flag `draft_flight_log_scroll_to_subscription` existe, limpiarla después (evita scroll al entrar al perfil por otros medios)

### 🟡 Pendiente — MP callback redirect fix (implementado en v1)
- [ ] En `server.ts`, callback `GET /api/mercadopago/subscription-callback`: agregar función `resolveFrontendUrl()` que use `req.headers.origin || req.headers.referer` como primera opción, luego `VITE_API_URL`, y fallback a la URL hardcodeada de Render. Reemplazar las 8 ocurrencias de `(process.env.VITE_API_URL || "http://localhost:5173")` por `resolveFrontendUrl()`.

### 🟡 Pendiente — Payment confirmation modal (implementado en v1)
- [ ] App.tsx (SubscriptionExpiredScreen): al recibir `init_point` de MP, no redirigir directo. Mostrar modal de confirmación con texto: "Este es un pago único anual. Al finalizar el período de 12 meses deberás renovar manualmente la suscripción. No se realizarán cobros automáticos." Botones "Ir a Pagar" → redirige a MP, "Cancelar" → vuelve atrás.
- [ ] LibroScreen.tsx: mismo modal de confirmación antes de redirigir a MP desde `handleRenewSubscription`.

### 🟡 Media Prioridad
- [ ] Monitorear la estabilidad de la sincronización con los endpoints de la ANAC (usando el fallback de `cadam.anac.gob.ar` cuando `cad.anac.gob.ar` falle).
- [ ] Probar la persistencia y refresco de sesiones de autenticación para ARMS y ANAC almacenadas en Supabase (`arms_sessions` y `user_remote_sessions`).
- [ ] Validar el correcto flujo de envío de notificaciones push (FCM) registradas en la tabla `push_tokens`.

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

---

## 6. Implementación Futura: Mercado Pago (Referencia)

### Paquetes npm
```json
"mercadopago": "^3.1.0"
```

### Variables de Entorno (Render)
| Variable | Descripción |
|---|---|
| `MP_ACCESS_TOKEN` | Token de producción: `APP_USR-...` |
| `VITE_API_URL` | URL base de la app (ej: `https://app.onrender.com`) |

### Supabase — Tablas/Columnas a agregar

**Tabla `profiles`** (columnas nuevas):
- `subscription_id TEXT` — ID de la suscripción en MP
- `subscription_end_date TIMESTAMPTZ` — fecha de vencimiento
- `subscription_status TEXT` — `authorized`, `cancelled`, etc.

**Tabla `pending_registrations`**:
```sql
CREATE TABLE pending_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  license TEXT,
  dni TEXT,
  legajo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Tabla `app_config`** (monto dinámico):
```sql
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_config (key, value) VALUES ('subscription_amount', '12000');
ALTER TABLE app_config DISABLE ROW LEVEL SECURITY;
```

### Server.ts — Endpoints a agregar (5)

1. **`getOrCreateAnnualPlan(backUrl)`** — Lee monto de `app_config`, cachea plan en memoria. Si el monto cambió vs caché, invalida y crea plan nuevo en MP.
2. **`POST /api/mercadopago/create-subscription`** — Recibe `{ email, password, firstName, lastName, license, dni, legajo }`. Si el usuario existe (renovación), usa su `id` como `external_reference`. Si no existe, guarda en `pending_registrations`. Devuelve `{ success, init_point }` para redirect a MP.
3. **`GET /api/mercadopago/subscription-callback`** — MP redirige acá tras el pago con `?preapproval_id&external_reference&status`. Si `status=authorized`, actualiza perfil existente o crea usuario desde `pending_registrations`.
4. **`POST /api/mercadopago/webhook`** — Recibe notificaciones de MP. Procesa eventos de tipo `subscription_preapproval` (acción que contenga "subscription"). Busca la suscripción en MP, si está `authorized`, actualiza o crea el usuario según `external_reference`.
5. **`POST /api/mercadopago/cancel-subscription`** — Recibe `{ userId }`. Cancela la suscripción en MP y marca `subscription_status = 'cancelled'`.

### Frontend — Componentes a modificar

**AuthScreen.tsx**:
- En modo registro, enviar datos a `POST /api/mercadopago/create-subscription` en vez de `supabase.auth.signUp()`
- Redirigir a `resData.init_point`

**App.tsx**:
- Agregar `SubscriptionExpiredScreen` para usuarios con suscripción vencida
- Manejar query params `?payment=success|error`

**LibroScreen.tsx / HomeScreen.tsx**:
- Mostrar card con días restantes, fecha de expiración, estado
- Botón "Cancelar suscripción"

### Flujo Completo de Pago
1. Usuario completa registro → frontend llama a `create-subscription`
2. Server guarda datos en `pending_registrations` (si es nuevo) y genera URL de MP
3. Usuario redirigido a MP → paga
4. MP redirige a `subscription-callback` → server crea usuario o actualiza perfil
5. MP envía webhook `subscription_preapproval` → server procesa async
6. App detecta `?payment=success` y recarga

### Flujo de Renovación
1. Usuario logueado con suscripción vencida ve `SubscriptionExpiredScreen`
2. Toca "Renovar Suscripción" → llama a `create-subscription` con su email
3. Server detecta usuario existente, usa `profile.id` como `external_reference`
4. Redirige a MP → paga → callback/webhook actualiza perfil existente

### Decisiones Técnicas (MP)
- Redirect checkout en vez de CardPayment Brick (sandbox de MP rechaza tokens con `"Card token service not found"`)
- `back_url` dinámico: usa `req.headers.origin` → si es localhost, fallback a `VITE_API_URL`
- `getOrCreateAnnualPlan()` cachea el plan en memoria con detección de cambio de monto
- `express.json()` sin opciones especiales (no confiar en `curl.exe` para tests, usar `Invoke-WebRequest`)
- Webhook en MP Dashboard configurado con evento "Planes y suscripciones"

### Lecciones Críticas (no repetir errores de v1)
1. **NO usar `payer_email`** en `PreApproval.create` — MP forza login con ese email exacto
2. **NO confiar en `&external_reference=` en plan.initPoint** — MP lo ignora. Usar `back_url` + `PreApproval.update`
3. **NO usar CardPayment Brick** — sandbox rechaza tokens. Usar redirect checkout siempre
4. **NO usar `req.query` en callback** — MP concatena con `?` en vez de `&`. Usar regex sobre `req.url`
5. **Siempre responder 200 en webhooks** — MP reintenta si ve error
6. **Usar `express.json()` sin opciones** — funciona bien, ignorar falsos 400 de curl.exe

### Checklist de Implementación (pasos de v1)
1. Agregar `mercadopago` a package.json
2. En server.ts: importar SDK, inicializar mpClient, crear endpoints (create-subscription, callback, webhook, cancel-subscription) + función getOrCreateAnnualPlan
3. En AuthScreen.tsx: cambiar registro a POST create-subscription → redirect a init_point
4. En App.tsx: SubscriptionExpiredScreen + manejo `?payment=success|error` + reset password overlay
5. En HomeScreen/LibroScreen: cards de estado de suscripción
6. En Supabase: agregar columnas a profiles, crear pending_registrations, crear app_config
7. En Render: agregar MP_ACCESS_TOKEN, VITE_API_URL, SUPABASE_SERVICE_ROLE_KEY
8. - [ ] Configurar webhook en MP Dashboard → "Planes y suscripciones" → URL: `https://.../api/mercadopago/webhook`
- [ ] Probar flujo completo: registro → MP → pago real → callback → Supabase actualizado
- [ ] Agregar columna `mp_payer_email TEXT` a `profiles` y poblar en cada callback/webhook para vincular pagos de MP con usuarios de la app
- [ ] Cartel de pago exitoso/fallido premium: Reemplazar los `alert` nativos del navegador por un modal overlay animado estilizado con la estética de la app (azul `#1152d4`, soporte oscuro/claro y animaciones fluidas vía `framer-motion`).

- [x] Usar URL exacta de Supabase en service worker en vez de `hostname.includes('supabase.co')` (`sw.js:45`)

---

## 7. Plan de Seguridad (Auditoria 23-Jun-2026)

### 🔴 Critico
- [ ] Rotar `SUPABASE_SERVICE_ROLE_KEY` en Supabase dashboard y actualizar en Render. Agregar `.env` a `.gitignore`.
- [ ] Dejar de persistir credenciales ARMS en `localStorage` (`ArmsRosterScreen.tsx:1198-1199`). Usar solo estado en memoria. Evaluar `navigator.credentials.store()` si se necesita "recordar".

### 🟠 Alto
- [ ] Cifrar o eliminar el cacheo de PII en `localStorage` (`App.tsx:1072-1108`): DNI, licencia, nombre, email, registros de vuelo en texto plano.

### 🟡 Medio
- [x] Agregar middleware `helmet` en `server.ts` (CSP, X-Frame-Options, etc.) — solo en producción, CSP condicional
- [x] Restringir CORS a lista blanca explicita (`server.ts:44-64`) — 5 orígenes conocidos
- [x] Agregar `arms_debug_*.html` a `.gitignore` y eliminar del repo
- [ ] Auditar y aplicar middleware de auth a endpoints sensibles de `/api/*`
- [x] Agregar `scripts/` al `.gitignore` (contiene `add_mp_payer_email.sql`, `add_calendar_token.sql`)

### 🔵 Bajo
- [x] ~~Eliminar inyeccion de `window.VITE_SUPABASE_ANON_KEY` y `window.VITE_SUPABASE_URL` del servidor~~ — No aplica: Render no expone `VITE_*` en build time
