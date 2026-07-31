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
server.ts              → Servidor Express (~2899 líneas V2 y V1)
src/App.tsx            → Componente principal (navegación por estado)
src/components/        → 12 screens (V2) / 8 screens (V1)
api/arms-scraper.ts    → Scraper ARMS (Playwright)
api/sync-anac.ts       → Helper sincronización ANAC
airports.csv           → FUENTE ÚNICA de aeropuertos (64, embebido via ?raw)
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

## Aeropuertos (fuente única: airports.csv)
- **`airports.csv` es la ÚNICA fuente** (64 aeropuertos, importado con `?raw`). La tabla Supabase `airports` fue **ELIMINADA** (2026-07-31). Prohibido reintroducir `dbAirports`, `airports_cache` o `supabase.from('airports')`.
- Eliminados: `AIRPORTS.MD` (dump ANAC), `seed_airports.ts`, `src/lib/airports.ts`.
- Columnas: `iata_code,icao_code,anac_code,name,city` → `key_code = anac_code || iata_code`.
- **El Calafate = `ECA`**: CSV `FTE,SAWC,ECA`. `CAL` es OTRO aeropuerto (Campo Arenal) → NUNCA mapear FTE→CAL.
- `ANAC_MAPPINGS` (server.ts ×2 + api/sync-anac.ts): `FTE→ECA`, `SAWC→ECA`, legacy `CAL→ECA` (vuelos viejos guardados con CAL sincronizan como ECA).
- `ANAC_TO_IATA` (import de roster): `ECA→FTE` (se eliminó `CAL→FTE`).
- **Código canónico guardado = IATA** (`resolveToAnac` en LibroScreen/LibroTcpScreen devuelve `iata_code`; FTE queda FTE). La conversión a código ANAC ocurre SOLO en el sync (`mapAirportCode` en LibroScreen + `ANAC_MAPPINGS` en server).
- **Validación en import masivo**: `BulkImportModal.tsx` y `validateImportLog` (server.ts) normalizan origen/destino → IATA matcheando por IATA/OACI/ANAC/nombre/ciudad (sin acentos). Si no resuelve → error `Origen desconocido: "X"` / `Destino desconocido: "X"` y la fila queda deseleccionada. El server lee `airports.csv` con `fs/promises` (caché en `airportsCsvList`, se carga con `ensureAirportsLoaded()`).

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

## TCP Flight Log (Tripulante de Cabina de Pasajeros)
- `src/components/FlightLogTcpPDF.tsx` — PDF 16 col, A4 landscape, 15 reg/pág, paginación con acumulación
- `src/components/LibroTcpScreen.tsx` — Full TCP screen (~2343 líneas): Excel, ANAC sync, historial, reset
- `LibroScreen.tsx` es referencia para lógica de sync ANAC y paginación
- `rowsPerPage = 15`, `getCumulativeTotals(pageIndex)` para totales acumulados
- Excel layout referenciado de `planilla modelo tcp.xlsx` (merged cells, row heights, borders, textRotation 90° solo FINALIDAD/ATERRIZAJES)
- Total rows: `parseFloat(...toFixed(1))` (número, no string)
- Top border row 2: medium edge-to-edge 16 cols
- Post-save → `setActiveTab('historial')`, tab state hardcodeado, sin localStorage
- FOLIO RVA opcional con warning; reset registros suma totales e incrementa folio
- **exportExcel types**: usar `vertical:'middle'` (exceljs NO acepta 'center') y `style: undefined` (no `''`) para lados sin borde (BorderStyle)

## Detalles críticos para evitar errores recurrentes
1. **MP callback**: MP concatena `?preapproval_id=X` con `?` en vez de `&` — usar regex sobre `req.url`, no `req.query`
2. **Brevo IP**: Render IP `74.220.48.29` + 7 rangos CIDR de Render deben estar autorizados en Brevo → Security → Authorised IPs. Los CIDR se agregan manualmente (la importación CSV solo acepta IPs individuales). Ver rangos en `ERRORES_CONOCIDOS.md` sección 1.
3. **Playwright**: Usar `ignoreHTTPSErrors: true` en Render por clock drift
4. **Webhooks MP**: Siempre responder 200 aunque haya error (MP reintenta si ve error)
5. **Trial**: Solo V1 tiene trial. V2 requiere pago directo.
6. **MP PreApprovalPlan**: usar `back_url` (singular, string) en el body, NO `back_urls`. Nunca concatenar `&back_url=` al `init_point` (rompe el checkout).
7. **ANAC sync TCP payload**: tipos numéricos (`horasDia`, `horasNoche`, `autoridadCertificanteID`, `finalidadID`), `origenPersonalizado`/`destinoPersonalizado` = null, incluir `vueloTripulanteID` (se descubre antes del loop vía `VueloTripulante/GetPagedList`) y `vueloTripulanteIDs: null`. Sync en lotes de 50 + reintentos + barra de progreso.
8. **Límite 500 registros/usuario** (aviso amber a 420): aplica en guardado manual (piloto + TCP, cuenta `logs.length` total) e import masivo (cliente + server).
9. **Horas OACI**: tabla ANAC exacta (`minutesToOACI`/`elapsedToOACI`/`rawToOACI`): 0-2→0.0, 3-8→0.1, 9-14→0.2, 15-20→0.3, 21-26→0.4, 27-33→0.5, 34-39→0.6, 40-45→0.7, 46-51→0.8, 52-57→0.9, 58-60→1.0.
10. **Matrícula**: estricto `XX-XXX` (5 letras) — validación en manual + import; normalización `LVKCE`→`LV-KCE`.
11. **Suscripción**: `refreshSub` en App.tsx siempre fetchea sin caché; suscripción vencida → modal rojo estilizado.
12. **Calendario ICS**: incluir `NAME:` (RFC 7986) además de `X-WR-CALNAME` (Google no muestra nombre sin NAME).
13. **server.ts creció mucho**: ~2899 líneas — considerar dividir en módulos si sigue creciendo.
