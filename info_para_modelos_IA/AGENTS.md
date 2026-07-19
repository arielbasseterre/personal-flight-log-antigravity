# AGENTS.md — Personal Flight Log

## Stack
- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tsx (TypeScript runtime, single `server.ts`)
- **DB**: Supabase (PostgreSQL + Auth + Storage)
- **Pagos**: Mercado Pago SDK (`mercadopago` 3.x)
- **Email**: Brevo API (ex Sendinblue)
- **Scraping**: Playwright 1.59 (Chromium headless)
- **Mobile**: Capacitor 6 (Android + PWA iOS)
- **Hosting**: Render (Docker, Playwright image)
- **PDF**: @react-pdf/renderer + PDF.js

## Estructura raíz
```
server.ts              → Servidor Express (~2356 líneas V2, ~1711 V1)
src/App.tsx            → Componente principal (navegación por estado)
src/components/        → 12 screens (V2) / 8 screens (V1)
api/arms-scraper.ts    → Scraper ARMS (Playwright)
api/sync-anac.ts       → Helper sincronización ANAC
supabase/schema.sql    → Schema BD consolidado (V2)
Dockerfile             → mcr.microsoft.com/playwright:v1.59.1-jammy
```

## Dos versiones activas
| | V2 (con roster) | V1 (sin roster) |
|---|---|---|
| URL | `personal-flight-log-antigravity-render.onrender.com` | `flightlog-sin-roster.onrender.com` |
| Repo | `arielbasseterre/personal-flight-log-antigravity` | `GRINGOSOFTtv-creator/FLIGHTLOG-SIN-ROSTER` |
| Roster | ✅ Completo + ICS/WebCal | ❌ No tiene |
| CORS | ✅ Restringido | ❌ Abierto |
| Helmet | ✅ Sí | ❌ No |

## Convenciones de código
- **Navegación**: Sin router — estado `screen` en App.tsx + renderizado condicional
- **Estilos**: Tailwind CSS v4 + clases utilitarias `cn()` de `tailwind-merge`
- **API calls**: `fetch` nativo en frontend, `axios` en backend
- **Env vars**: `process.env.VAR` en server.ts, `import.meta.env.VITE_VAR` en frontend
- **Logging**: `console.log("[ETIQUETA] mensaje")` con etiquetas tipo `[TRIAL]`, `[NOTIFY]`, `[REPORT]`, `[MP_CALLBACK]`
- **Emails**: Brevo API via helpers `sendBrevoEmail()` y `notifyNewUser()` en server.ts

## Comandos
```bash
npm run dev              # Servidor + Vite hot-reload
npm run build            # Build producción
npm run lint             # tsc --noEmit
```

## API Keys

Las API keys no están documentadas en texto plano por seguridad.
Están seteadas en:
- **Render Dashboard** → Environment → cada servicio tiene sus variables de entorno
- **Local**: en `.env` (gitignored)

Si como modelo necesitás una key para proponer un cambio, indicá que el usuario debe copiarla desde Render Dashboard o el `.env` local. **Nunca** sugerir hardcodear keys en el código.

## Reglas de seguridad
- NO hardcodear tokens en el código (usar env vars)
- NO commitear `.env`
- Supabase `SUPABASE_SERVICE_ROLE_KEY` bypasea RLS — usarla solo en server.ts
- CORS restringido en V2, abierto en V1
- Siempre validar inputs del cliente en server.ts

## Servicios externos y cuentas
| Servicio | Cuenta/Key |
|---|---|
| Supabase | `mexnmpbpqtccaulekupo.supabase.co` |
| Brevo | `(ver BREVO_API_KEY en Render Dashboard)` |
| MP token | `(ver MP_ACCESS_TOKEN en Render Dashboard)` |
| Gemini | `(ver GEMINI_API_KEY en Render Dashboard)` |
| Render V2 | `personal-flight-log-antigravity-render.onrender.com` |
| Render V1 | `flightlog-sin-roster.onrender.com` |
| Admin email | `gringo.soft.ar@gmail.com` |

## Detalles críticos para evitar errores recurrentes
1. **MP callback**: MP concatena `?preapproval_id=X` con `?` en vez de `&` — usar regex sobre `req.url`, no `req.query`
2. **Brevo IP**: Render IP `74.220.48.29` debe estar autorizada en Brevo → Security → Authorised IPs
3. **Playwright**: Usar `ignoreHTTPSErrors: true` en Render por clock drift
4. **Webhooks MP**: Siempre responder 200 aunque haya error (MP reintenta si ve error)
5. **Trial**: Solo V1 tiene trial. V2 requiere pago directo.
6. **server.ts creció mucho**: V2 ~2356 líneas — considerar dividir en módulos si sigue creciendo.
