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
server.ts              → Servidor Express (~3326 líneas V2 y V1)
src/App.tsx            → Componente principal (navegación por estado)
src/components/        → 12 screens (V2) / 8 screens (V1)
api/arms-scraper.ts    → Scraper ARMS (Playwright)
api/sync-anac.ts       → Helper sincronización ANAC
airports.csv           → FUENTE ÚNICA de aeropuertos (64, embebido via ?raw)
supabase/schema.sql    → Schema BD consolidado (V2)
Dockerfile             → mcr.microsoft.com/playwright:v1.59.1-jammy
src/utils/anacMappings.ts  → Mappings ANAC centralizados + getAnacCode()
src/utils/airports.ts      → Cache O(1) lazy-load airports.csv + resolveAirportCode()
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
- `ANAC_MAPPINGS` centralizado en **`src/utils/anacMappings.ts`** (single source of truth, exporta `ANAC_MAPPINGS` + `getAnacCode()`). Usado por `server.ts`, `api/sync-anac.ts`, `api/arms-scraper.ts`.
- `ANAC_TO_IATA` (import de roster): `ECA→FTE` (se eliminó `CAL→FTE`).
- **Código canónico guardado = IATA** (`resolveToAnac` en LibroScreen/LibroTcpScreen devuelve `iata_code`; FTE queda FTE). La conversión a código ANAC ocurre SOLO en el sync (`mapAirportCode` en LibroScreen + `ANAC_MAPPINGS` en server).
- **Cache O(1) lazy-load** en **`src/utils/airports.ts`**: carga `airports.csv` una vez al primer uso, construye `Map<string, Airport>` indexado por IATA/ICAO/ANAC/nombre/ciudad (276 keys). Exporta `ensureAirportsLoaded()`, `resolveAirportCode()`, `getAllAirports()`. `server.ts` y `api/sync-anac.ts` usan `resolveAirportCode()` (O(1) vs O(n) anterior). Validación import masivo idéntica.
- **Validación en import masivo**: `BulkImportModal.tsx` y `validateImportLog` (server.ts) normalizan origen/destino → IATA matcheando por IATA/OACI/ANAC/nombre/ciudad (sin acentos). Si no resuelve → error `Origen desconocido: "X"` / `Destino desconocido: "X"` y la fila queda deseleccionada. El server lee `airports.csv` con `fs/promises` (cache en `AIRPORT_MAP` via `ensureAirportsLoaded()`).

## Sync ANAC — Edición de vuelos (detalles críticos)
- **Columna `flight_logs.anac_vuelo_id` (BIGINT)**: `vueloTripulanteID` vigente de ANAC por vuelo. Es la clave anti-duplicados.
- **ANAC "Edit" = borrar + crear** (ID nuevo cada vez) y responde solo `true` → tras un Edit hay que **re-resolver el ID** (client post-sync: match fecha+matrícula+ruta contra `GetPagedList`) y persistirlo.
- **Endpoints nuevos**: `POST /api/edit-anac` y `/api/edit-anac-tcp` (usan **`axios.put`** a `VueloTripulante/Edit` — POST da "The requested resource does not support http method 'POST'"; fallback `cadam.anac.gob.ar/Cadam/api/VueloTripulante/Edit`); `POST /api/get-anac-log-detail` (GET `VueloTripulante/Get?id=X`).
- **`GetPagedList` NO expone `horasDia/Noche`, `observaciones`, `autoridadCertificante`** (undefined) → esos campos se comparan con el **detalle `Get?id=`** (concurrencia 5, `mergeAnacDetail`). Solo se pide el detalle para vuelos matcheados que el listado no marcó.
- **`listFlightDiffs`**: horas/aterrizajes solo si ANAC trae valor (epsilon 0.01); fechas 16 chars; matrícula; ruta contra desc (trae el ICAO "SAZS" → `localAirportCodes` IATA/OACI/ANAC); observaciones (ambos no vacíos); clase/potencia (ambos con valor); autoridadCertificante (por `autoridadCertificanteID` del detalle, o rol reconocido — si ANAC devuelve persona, no marca); finalidad por nombre (siglas ≥3). **NUNCA comparar `marcaModelo`** (ANAC lo llena por su cuenta).
- **TCP: NOMBRE CERTIFICANTE = `observaciones`** (`certifier_name` → `observaciones`); ROL (`certifier_role_id`) → `autoridadCertificanteID`.
- **`handleSyncANAC`**: FASE 1 crea (lotes 50) → FASE 2 edita. Modal con "Nuevos (a crear)" + "Modificados (a actualizar)". Mensaje "X nuevos, Y actualizados, Z con error".
- Comparación TCP anti-duplicados: match matrícula tolerante a vacío (igual que pilotos).
- Aviso al editar: "Recuerda volver a sincronizar con ANAC para enviar los cambios realizados en este vuelo."

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
- `src/components/LibroTcpScreen.tsx` — Full TCP screen (~2749 líneas): Excel, ANAC sync, historial, reset
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
7. **ANAC sync TCP payload**: tipos numéricos (`horasDia`, `horasNoche`, `autoridadCertificanteID`, `finalidadID`), `origenPersonalizado`/`destinoPersonalizado` = null, incluir `vueloTripulanteID` (se descubre antes del loop vía `VueloTripulante/GetPagedList` con **`tipoTrip=TCP`**) y `vueloTripulanteIDs: null`. Sync en lotes de 50 + reintentos + barra de progreso.
8. **Límite 500 registros/usuario** (aviso amber a 420): aplica en guardado manual (piloto + TCP, cuenta `logs.length` total) e import masivo (cliente + server).
9. **Horas OACI**: tabla ANAC exacta (`minutesToOACI`/`elapsedToOACI`/`rawToOACI`): 0-2→0.0, 3-8→0.1, 9-14→0.2, 15-20→0.3, 21-26→0.4, 27-33→0.5, 34-39→0.6, 40-45→0.7, 46-51→0.8, 52-57→0.9, 58-60→1.0.
10. **Matrícula**: estricto `XX-XXX` (5 letras) — validación en manual + import; normalización `LVKCE`→`LV-KCE`.
11. **Suscripción**: `refreshSub` en App.tsx siempre fetchea sin caché; suscripción vencida → modal rojo estilizado.
12. **Calendario ICS**: incluir `NAME:` (RFC 7986) además de `X-WR-CALNAME` (Google no muestra nombre sin NAME).
13. **server.ts creció mucho**: ~3383 líneas — considerar dividir en módulos si sigue creciendo.
14. **ANAC Edit = PUT**: `VueloTripulante/Edit` NO acepta POST ("does not support http method 'POST'"). Usar `axios.put` en `/api/edit-anac*`.
15. **ANAC Edit borra+crea**: cada edit genera un `vueloTripulanteID` nuevo y responde `true` (sin ID). Tras sync, re-resolver el ID (fecha+matrícula+ruta) y persistirlo, o el vuelo vuelve a aparecer como "Modificados" (loop de re-ediciones).
16. **`GetPagedList` omite horas/observaciones/autoridad**: para detectar cambios en esos campos usar `Get?id=` (detalle). `autoridadCertificante` del listado puede traer nombre de persona → comparar por `autoridadCertificanteID` del detalle.
17. **Falsos positivos de comparación**: no comparar `marcaModelo` (ANAC lo llena); horas/aterrizajes solo si ANAC trae valor; siglas de finalidad cortas ("I") son substrings de todo → comparar por nombre con sigla ≥3.
18. **Render detrás de proxy**: `app.set('trust proxy', true)` es obligatorio (Express) — Render agrega `X-Forwarded-For` y sin esto `express-rate-limit` lanza `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` (rompía syncs masivos en producción). Agregar manejador global de errores (`app.use((err, req, res, next) => ...)`) para que un error no tumbe el proceso a mitad de un sync largo.
19. **Regla de oro rol↔payload**: `profile.role` = `piloto_fb`/`tcp_fb`. El descubrimiento de `vueloTripulanteID` en `sync-anac-tcp` usa `tipoTrip=TCP` (NO `TM`, que agarraba el ID de piloto y desasociaba los vuelos TCP). Nunca enviar payloads del rol equivocado.
20. **Roster ARMS scraper (`api/arms-scraper.ts`, solo V2)**: setear el rango con la API del jQuery Datepicker (no `input.value` directo → ARMS usa rango por defecto → tabla vacía); tras VIEW, **polling** hasta que el grid tenga >1 fila (AJAX); regex de fecha con día `\d{1,2}` y escanear hasta 6 celdas.
21. **`page.evaluate` y esbuild/tsx (`__name`)**: en los callbacks NO definir **funciones con nombre** internas (`const setDate = ...` → esbuild inyecta `__name` que no existe en el browser → `ReferenceError: __name is not defined`). Usar **arrows inline sin funciones nombradas** (los strings rompen el paso de argumentos). Afecta a `api/arms-scraper.ts` (corre con tsx).
22. **Dockerfile**: `DEBIAN_FRONTEND=noninteractive` + `TZ` ANTES de `apt-get install tzdata` — sin esto, tzdata cuelga el build con un prompt interactivo. Sincronizar reloj con `ntpdate` (ANAC rechaza "ajusta la hora de su sistema" por clock drift).


23. **Nuevos m�dulos compartidos (Ago-2026)**:
   - **src/utils/anacMappings.ts**: Single source of truth para ANAC_MAPPINGS + getAnacCode(). Usado por server.ts, api/sync-anac.ts, api/arms-scraper.ts. Elimina duplicaci�n de 80+ l�neas.
   - **src/utils/airports.ts**: Cache O(1) lazy-load del airports.csv. Carga una vez, construye Map (276 keys por IATA/ICAO/ANAC/nombre/ciudad). Exporta ensureAirportsLoaded(), resolveAirportCode(), getAllAirports(). Reemplaza resolveAirportCodeServer en server.ts y mapAirportCode en api/sync-anac.ts (O(n) a O(1)).
   - **telegram/index.ts � Pool browser cron ARMS**: 1 chromium.launch() + browser.newContext({ storageState }) por usuario (contexts aislados). Ahorro: ~70% RAM, ~50% tiempo cron, ~70% minutos GitHub Actions.
   - **Fix arms_password_enc upsert en server.ts**: Solo actualiza arms_password_enc si hay password nuevo (primera vez o cambio credenciales). Evita borrar la contrase�a cifrada al hacer sync usando sesi�n guardada.
2 4 .   * * U I / U X   f i x e s   ( A g o - 2 0 2 6 ) * * :  
       -   * * A r m s R o s t e r S c r e e n   h e a d e r   r e s t r u c t u r e * * :   E l i m i n a d o s   " R o s t e r   A R M S "   y   " M i   C a l e n d a r i o "   d e l   h e a d e r   s t i c k y .   B o t o n e s   ( E x p o r t a r ,   T e l e g r a m ,   S i n c r o n i z a r )   c e n t r a d o s   h o r i z o n t a l m e n t e   ( ` f l e x   i t e m s - c e n t e r   j u s t i f y - c e n t e r   g a p - 2   f l e x - w r a p ` ) .   S u b t � � t u l o   " C a l e n d a r i o "   ( 1 4 p x ,   b l a n c o ,   m t - 6 )   m o v i d o   d e b a j o   d e   l o s   b o t o n e s   d e n t r o   d e l   f l e x - c o l .  
       -   * * H e a d e r   s p a c i n g   f i x   ( t o d a s   l a s   p a n t a l l a s   c o n   H e a d e r   c o m p a r t i d o ) * * :   ` p t - 1 6 `   ( 6 4 p x )   e n   H e a d e r   +   ` m t - 4 `   ( 1 6 p x )   e n   ` < h 1 > `   t � � t u l o   �      ~ 8 0 p x   s e p a r a c i � � n   d e l   b o r d e   s u p e r i o r .   A f e c t a :   P i l o t o s ,   T C P ,   L i b r o   T C P ,   L i b r o   P i l o t o ,   R o s t e r ,   C h a n g e l o g .  
       -   * * F l e c h a s   r e t r o c e s o   r e m o v i d a s * * :   E l i m i n a d o   ` o n B a c k `   d e l   H e a d e r   e n   P i l o t o s ,   T C P ,   L i b r o   ( T C P   y   P i l o t o ) ,   R o s t e r .   N a v e g a c i � � n   s o l o   v � � a   b a r r a   i n f e r i o r .   C o m p o n e n t e   H e a d e r   y a   m a n e j a   c a s o   s i n   ` o n B a c k `   ( e s p a c i a d o r   ` w - 1 0 `   p a r a   m a n t e n e r   c e n t r a d o ) .  
       -   * * E s p a c i a d o   c o n t e n i d o * * :   ` p t - 4 `   a g r e g a d o   a   c o n t e n e d o r e s   ` f l e x - 1   o v e r f l o w - y - a u t o `   e n   P i l o t o s ,   T C P ,   R o s t e r ,   L i b r o   ( T C P   y   P i l o t o ) .  
  
 2 5 .   * * S u p a b a s e   p e r f o r m a n c e   i s s u e s   d o c u m e n t a d o s   ( A g o - 2 0 2 6 ) * * :  
       -   ` f e t c h D a t a `   e n   A p p . t s x :   5   q u e r i e s   s e c u e n c i a l e s   ( a u t h   �      l o g s   �      f a l l b a c k   l o g s   �      p r o f i l e   �      f a l l b a c k   e m a i l )   s i n   l � � m i t e   n i   p a r a l e l i s m o  
       -   Q u e r y   ` f l i g h t _ l o g s `   s i n   L I M I T   �      t r a e   T O D O S   l o s   l o g s   d e l   u s u a r i o  
       -   S i n   A b o r t C o n t r o l l e r / t i m e o u t   �      q u e r i e s   p u e d e n   c o l g a r s e   i n d e f i n i d a m e n t e   ( e x p l i c a   " S i n c r o n i z a n d o . . . "   i n f i n i t o )  
       -   ` s u p a b a s e ! `   f o r c e   u n w r a p   e n   ` h a n d l e L o g o u t `   ( A p p . t s x : 1 6 9 2 )   �      r o m p e   s i   c l i e n t   e s   n u l l  
       -   C a t c h   s i l e n c i o s o   e n   ` r e f r e s h S u b `   ( l � � n e a   1 5 7 3 )   o c u l t a   e r r o r e s   r e a l e s  
       -   F i x e s   r e c o m e n d a d o s :   L I M I T   5 0 ,   P r o m i s e . a l l   p a r a   p a r a l e l i z a r ,   A b o r t C o n t r o l l e r   1 5 s ,   o p t i o n a l   c h a i n i n g ,   l o g g i n g   d e   e r r o r e s  
 2 6 .   * * O f f l i n e   p u l l - t o - r e f r e s h   l o g o u t   f i x   ( A g o - 2 0 2 6 ) * * :  
       -   * * P r o b l e m a * * :   E n   A n d r o i d   P W A ,   p u l l - t o - r e f r e s h   n a t i v o   o f f l i n e   c a u s a b a   r e l o a d   - >   g e t S e s s i o n   f a l l a b a   - >   l o g o u t   +   i m p o s i b i l i d a d   d e   r e - l o g i n   s i n   i n t e r n e t .  
       -   * * F i x   1   -   C S S * * :   ` o v e r s c r o l l - b e h a v i o r :   n o n e ;   o v e r s c r o l l - b e h a v i o r - y :   n o n e `   e n   ` s r c / i n d e x . c s s `   ( h t m l ,   b o d y ,   # r o o t )   - >   d e s h a b i l i t a   p u l l - t o - r e f r e s h   n a t i v o   c o m p l e t a m e n t e .  
       -   * * F i x   2   -   A u t h   o f f l i n e - a w a r e * * :   ` g e t S e s s i o n `   y   ` o n A u t h S t a t e C h a n g e `   e n   ` A p p . t s x `   a h o r a   d e t e c t a n   ` ! n a v i g a t o r . o n L i n e `   y   r e c u p e r a n   u s u a r i o   d e   ` l o c a l S t o r a g e [ ' c a c h e d _ u s e r ' ] `   e n   l u g a r   d e   l i m p i a r   s e s i o n .  
       -   * * F i x   3   -   U s e r   c a c h e * * :   N u e v a   f u n c i o n   ` c a c h e U s e r ( ) `   p e r s i s t e   u s u a r i o   e n   ` l o c a l S t o r a g e [ ' c a c h e d _ u s e r ' ] `   e n   l o g i n / l o g o u t ;   h a n d l e r s   r e c u p e r a n   d e   c a c h e   s i   o f f l i n e .  
       -   * * D e c i s i o n * * :   P u l l - t o - r e f r e s h   n a t i v o   * * d e s h a b i l i t a d o   i n t e n c i o n a l m e n t e * *   ( c o m p o r t a m i e n t o   a c t u a l ) .   S i   s e   d e s e a   r e s t a u r a r   e n   e l   f u t u r o ,   i m p l e m e n t a r   p u l l - t o - r e f r e s h   p e r s o n a l i z a d o   q u e   v e r i f i q u e   ` n a v i g a t o r . o n L i n e `   a n t e s   d e   r e c a r g a r .  
 