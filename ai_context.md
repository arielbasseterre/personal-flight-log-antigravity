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
- **Fix login intermitente (15-Jun-2026)**: Se agregó `await supabase.auth.signOut({ scope: 'local' })` antes de `signInWithPassword` en `AuthScreen.tsx` para limpiar sesión stale de localStorage que causaba falsos "Invalid login credentials" en usuarios existentes.
- **Pendiente**: Probar y verificar el funcionamiento del fix de login en v2 (confirmar que no rompe registro existente con `signUp`).

---

## 5. Features a Desarrollar

### ✅ Completado — Mercado Pago (Suscripciones)
Sistema de pagos por suscripción anual implementado con redirect checkout de MP. Copiar referencia de implementación desde v1 (`D:\app Antigravity\personal-flight-log sin roster\server.ts`).

**Referencia de implementación en v1:** Ver sección "Lecciones Aprendidas" y "Decisiones Técnicas" más abajo para evitar errores conocidos.

- [x] Fix login intermitente (15-Jun-2026): `signOut({ scope: 'local' })` antes de `signInWithPassword` en AuthScreen

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

### 🟡 Media Prioridad
- [ ] Monitorear la estabilidad de la sincronización con los endpoints de la ANAC (usando el fallback de `cadam.anac.gob.ar` cuando `cad.anac.gob.ar` falle).
- [ ] Probar la persistencia y refresco de sesiones de autenticación para ARMS y ANAC almacenadas en Supabase (`arms_sessions` y `user_remote_sessions`).
- [ ] Validar el correcto flujo de envío de notificaciones push (FCM) registradas en la tabla `push_tokens`.

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
8. Configurar webhook en MP Dashboard → "Planes y suscripciones" → URL: `https://.../api/mercadopago/webhook`
9. Probar flujo completo: registro → MP → pago real → callback → Supabase actualizado
10. Agregar columna `mp_payer_email TEXT` a `profiles` y poblar en cada callback/webhook para vincular pagos de MP con usuarios de la app
