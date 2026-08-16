# Instrucciones Personalizadas para el Agente

## ⚠️ Regla de Oro — Base de Datos Supabase

**Bajo ningún concepto** el agente debe ejecutar acciones destructivas en la base de datos de Supabase (DROP, DELETE, ALTER que elimine columnas, TRUNCATE, etc.).

El agente **NUNCA** debe ejecutar SQL contra Supabase. El usuario es el **único responsable** de copiar el código SQL propuesto y ejecutarlo manualmente en el SQL Editor del portal de Supabase.

**Siempre** que el agente proponga SQL que pueda provocar pérdida de datos (modificar schema, eliminar registros, cambiar tipos de columnas, etc.), debe:
1. Informar explícitamente al usuario del riesgo
2. Indicar claramente qué acciones del SQL son potencialmente destructivas
3. Esperar confirmación explícita del usuario antes de considerar el código como finalizado

## Reglas Generales

- **Actualización del Changelog:** No realices cambios automáticos en la constante `CHANGELOG_DATA` en `src/App.tsx`. Antes de incorporar cualquier registro de cambios al historial, debes preguntar explícitamente al usuario si desea incluir los cambios realizados en dicha sección.

## ⚠️ Modo plan por defecto (SIMULADO)

- Por defecto, **siempre** comportate como si estuvieras en **modo plan**: solo investigar, analizar y proponer planes. **NO hacer ningún cambio** (ni archivos, ni git, ni comandos que modifiquen) sin autorización explícita.
- **Única excepción**: cuando el usuario diga textualmente **"sal de modo plan y procede"**, deja de simular plan y ejecuta los cambios solicitados.
- Después de ejecutar, vuelve a la conducta por defecto (simular plan) salvo que el usuario indique otra cosa.
- El usuario usa **opencode web**; no asumas que el modo del sistema es visible para él. La garantía de "no cambios" la da esta regla, no el indicador de la UI.

## ⚠️ FEATURE TEMPORAL — Renovación automática de prueba (SOLO V2)

**Contexto:** usuarios de la V2 con dificultades económicas temporales. Período de gracia: cuando la suscripción de **prueba** de un usuario está **vencida** (`subscription_end_date <= now`), al abrir la app se renueva automáticamente por **+30 días** (modo trial) y se muestra un banner. **Solo V2 — la V1 NO recibe estos cambios.**

### Archivos modificados (V2)
- `server.ts`: endpoint `POST /api/trial/auto-renew` (marcado `// ⚠️ TEMPORAL V2`).
- `src/App.tsx`:
  - Estado `trialRenewalBanner`.
  - Effect `refreshSub`: si es trial vencida → llama al endpoint, actualiza el perfil y muestra el banner.
  - Gating del screen de vencido: `if (user && !isSubscriptionActive && !appIsTrial)` → los trial nunca ven la pantalla de vencido (los pagos vencidos sí).
  - Banner descartable renderizado tras `{content}`.

### Cómo removerlo (cuando el usuario lo pida)
Frase disparadora: **"remové el feature temporal de renovación automática de prueba"**.
1. En `server.ts`: eliminar el endpoint `app.post("/api/trial/auto-renew", ...)` completo (buscar `TRIAL_AUTO_RENEW`).
2. En `src/App.tsx`:
   - Eliminar el estado `trialRenewalBanner`.
   - Eliminar el bloque `// ⚠️ TEMPORAL V2` dentro del effect `refreshSub` (la llamada a `/api/trial/auto-renew` y `setTrialRenewalBanner(true)`).
   - Eliminar `appIsTrial` y restaurar el gating original: `if (user && !isSubscriptionActive)`.
   - Eliminar el banner descartable renderizado tras `{content}`.
3. Quitar la importación de `getApiUrl` si quedó sin uso.
4. Build + commit + push de la **V2**. NO tocar la V1.

## API Keys

Las API keys no están documentadas en texto plano por seguridad.
Están seteadas en:
- **Render Dashboard** → Environment → cada servicio tiene sus variables de entorno
- **Local**: en `.env` (gitignored)

Si como modelo necesitás una key para proponer un cambio, indicá que el usuario debe copiarla desde Render Dashboard o el `.env` local. **Nunca** sugerir hardcodear keys en el código.

## Referencia Técnica del Proyecto

Para entender la arquitectura, stack, estructura de directorios, cuentas de servicios externos y decisiones técnicas de esta app, consultar:

- `info_para_modelos_IA/AGENTS.md` — Resumen técnico ultra-condensado para IA
- `info_para_modelos_IA/DECISIONES_TECNICAS.md` — Por qué se tomó cada decisión de diseño
- `info_para_modelos_IA/ERRORES_CONOCIDOS.md` — Problemas conocidos y soluciones documentadas
- `Manual_de_la_app_flightlog.md` — Guía completa de arquitectura y funcionamiento

> El agente DEBE leer estos archivos antes de proponer cambios significativos en el proyecto.

## TCP Flight Log (Tripulante de Cabina de Pasajeros)

### Archivos clave
- `src/components/FlightLogTcpPDF.tsx` — PDF 16 columnas, A4 landscape, 15 registros/hoja con paginación
- `src/components/LibroTcpScreen.tsx` — Componente full (~2749 líneas): Excel export, ANAC sync, historial, reset
- `src/components/LibroScreen.tsx` — Versión pilotos (~4553 líneas, referencia para sync ANAC)

### Paginación (PDF y Excel)
- `rowsPerPage = 15`, `getCumulativeTotals(pageIndex)` para TOTALES PAGINA ANTERIOR
- `getCumulativeTotals(pageIndex + 1)` para TOTAL HORAS DE VUELO A LA PAGINA SIGUIENTE
- Excel: oculta fila TOTALES PAGINA ANTERIOR en página 1 (solo pageIndex > 0)
- PDF: siempre muestra TOTALES PAGINA ANTERIOR (initialDia en página 1, acumulado después)

### Excel layout
- Referencia: `planilla modelo tcp.xlsx` en raíz del proyecto (autoritativo)
- Col widths: `[5, null, 6.55, 6.22, 6.66, 7.55, 4.22, 15, 10, 7, null, null, 5, 8, null, 28]`
- Row heights: 1=15, 2=24.6, 3=52.8
- Merged: A1:H1, I1:M1, N1:O1, A2:B2, C2:F2, G2:G3, H2:J2, K2:L2, M2:M3, N2:O2, P2:P3
- Text rotation 90° solo en FINALIDAD DEL VUELO (G2:G3) y ATERRIZAJES (M2:M3)
- Top border row 2: medium (1.5pt) edge-to-edge en 16 columnas
- Total rows usan `parseFloat(...toFixed(1))` para valores numéricos (no strings)
- Firma del titular en última página

### Reglas críticas TCP
- Tab state: `useState('dashboard')` hardcodeado, sin localStorage
- Post-save redirect: `setActiveTab('historial')`
- FOLIO RVA: opcional, warning si vacío al guardar
- "Restablecer registros": verifica sync ANAC, suma tcp_total_dia/noche/hras_instructor/total_landings, incrementa initial_folio_number, elimina flight_logs con cargoID='5'
- Sync ANAC TCP: compara por fechaSalida + fechaLlegada + matricula

## Aeropuertos — Fuente única (IMPORTANTE)
- **`airports.csv` es la ÚNICA fuente de aeropuertos** (64, embebido con `?raw`). La tabla Supabase `airports` fue **ELIMINADA** (2026-07-31). NO usar `supabase.from('airports')`, `dbAirports` ni `airports_cache` (fueron removidos de los screens).
- **El Calafate = `ECA`** (`FTE,SAWC,ECA` en el CSV). `CAL` es OTRO aeropuerto (Campo Arenal) → nunca mapear FTE→CAL. En `ANAC_MAPPINGS` existe legacy `CAL→ECA` para que vuelos viejos sincronicen bien.
- **Código canónico guardado = IATA** (FTE queda FTE); la conversión a código ANAC ocurre solo en el sync (`mapAirportCode` + `ANAC_MAPPINGS`).
- **Import masivo valida aeropuertos**: normaliza origen/destino a IATA (match por IATA/OACI/ANAC/nombre/ciudad); si no resuelve → `Origen desconocido: "X"` / `Destino desconocido: "X"` y la fila queda deseleccionada (misma validación en cliente y server).

## Sync ANAC — Edición de vuelos ya sincronizados (IMPORTANTE)
- **Columna `flight_logs.anac_vuelo_id` (BIGINT)**: guarda el `vueloTripulanteID` vigente de ANAC por vuelo. **CLAVE** para no duplicar.
- **ANAC implementa el "Edit" como borrar el registro viejo + crear uno NUEVO** con otro `vueloTripulanteID`, y el endpoint responde solo `true` (no devuelve el ID nuevo). Por eso:
  - Tras cada Edit, el ID queda desactualizado → la app **re-resuelve el ID** post-sync matcheando fecha+matrícula+ruta contra `GetPagedList` y persiste el nuevo.
  - `persistAnacVueloId` en server persiste el ID de la respuesta del Create/Edit (best-effort).
- **Endpoints nuevos en `server.ts`**:
  - `POST /api/edit-anac` (pilotos) y `POST /api/edit-anac-tcp` (TCP): **`axios.put`** a `VueloTripulante/Edit` (NO POST → ANAC responde "does not support http method 'POST'"), fallback `cadam.anac.gob.ar/Cadam/api/VueloTripulante/Edit`, reintentos. Body `{ anac_token, storageState, edits: [{ log, vueloTripulanteID }] }`. Devuelve `results` con `newVueloTripulanteID`.
  - `POST /api/get-anac-log-detail`: GET `VueloTripulante/Get?id=X` — **`GetPagedList` NO expone `horasDia/Noche`, `observaciones` ni `autoridadCertificante`** (undefined) → el detalle es imprescindible para compararlos.
- **`compareWithAnac`** (ambos screens) clasifica en 3: matchea por `anac_vuelo_id` primero, luego por fecha+matrícula (tolerante), luego match secundario (matrícula ±2 días, 1 candidato). Produce `pendingLogs` (nuevos) + `pendingUpdates` (modificados) + **backfill** de `anac_vuelo_id`.
- **Detección de cambios (`listFlightDiffs`)**: horas/aterrizajes SOLO si ANAC trae valor (epsilon 0.01), fechas (16 chars), matrícula, ruta (desc de ANAC trae el **ICAO** tipo "SAZS" → match por `localAirportCodes` IATA/OACI/ANAC), observaciones (ambos no vacíos), clase/potencia (ambos con valor), autoridadCertificante (por `autoridadCertificanteID` del detalle, o rol reconocido), finalidad (por nombre; siglas ≥3 para evitar falsos). **NO comparar `marcaModelo`** (ANAC lo completa por su cuenta).
- **Pasada de detalle**: para vuelos matcheados no marcados por el listado, pide `Get?id=` (concurrencia 5) y compara horas/observaciones/autoridad con `mergeAnacDetail`.
- **`handleSyncANAC`**: FASE 1 crea (lotes 50, sin cambios) → FASE 2 actualiza (Edit). Modal con secciones "Nuevos (a crear)" y "Modificados (a actualizar)". Mensaje "X nuevos, Y actualizados, Z con error".
- **TCP: NOMBRE CERTIFICANTE se guarda como `observaciones`** (`certifier_name` → `observaciones`); el ROL (`certifier_role_id`) → `autoridadCertificanteID`. Cambios en ambos se detectan vía el detalle.
- **Aviso al editar** (ambos screens): "Recuerda volver a sincronizar con ANAC para enviar los cambios realizados en este vuelo."

## Regla de oro — Rol del perfil ↔ Payload (IMPORTANTE)
- `profile.role` = **`piloto_fb`** o **`tcp_fb`** (se setea en el registro). Si el perfil es TCP, **NUNCA** enviar payloads de piloto; si es piloto, **NUNCA** de TCP.
- **`sync-anac-tcp` descubre el `vueloTripulanteID` con `tipoTrip=TCP`** (¡NO `TM`! Antes usaba TM → agarraba el ID de piloto → los vuelos TCP quedaban asociados al rol equivocado y no aparecían en el portal).
- Pilotos usan `vueloTripulanteID: 0` en el Create (funciona). El guard server-side por rol está **pendiente** (diferido).

## Producción / Render (IMPORTANTE)
- **`app.set('trust proxy', true)`** es OBLIGATORIO en Express: Render agrega `X-Forwarded-For` y sin `trust proxy`, `express-rate-limit` lanza `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` → rompía el sync masivo en producción (a local no lo afecta).
- **Manejador global de errores** al final del server (`app.use((err, req, res, next) => ...)`): evita que un error no manejado **tumbe el proceso** a mitad de un sync largo (se veía un reinicio "Detected service running on port 10000").
- Diagnóstico de reloj: `[SERVER] Hora del servidor:` al arrancar + `/api/test-connectivity` devuelve `serverTime`/`serverTimeLocal`/`tz` (para verificar clock drift sin Render Shell). Dockerfile sincroniza reloj con `ntpdate` + `TZ=America/Argentina/Buenos_Aires` + `DEBIAN_FRONTEND=noninteractive` (sin esto, `apt-get install tzdata` cuelga el build con un prompt).

## Roster ARMS (`api/arms-scraper.ts` — SOLO V2)
- **Setear el rango con la API del jQuery UI Datepicker** (`$('#txtFromDate').datepicker('setDate', new Date(...))`), NO asignar `input.value` directo (el datepicker readonly mantiene su valor interno → ARMS usaba el rango por defecto → tabla vacía).
- **Tras clickear VIEW, esperar a que el grid tenga >1 fila** (polling ~15s): ARMS llena la tabla vía AJAX; capturar antes = tabla vacía (HTML ~1600 chars, 0 tramos).
- **Parser**: regex de fecha con día `\d{1,2}` (ARMS puede renderizar "1-Aug-2026") + escanear hasta 6 celdas.
- **GOTCHA esbuild/tsx**: en `page.evaluate`, **NO definir funciones con nombre** adentro (`const setDate = ...` → esbuild inyecta `__name` que no existe en el browser → `ReferenceError: __name is not defined`). Usar **arrows inline sin funciones nombradas internas**. (Los strings rompen el paso de argumentos.)
- El checkbox de Crew Complement no se toca (solo muestra/oculta nombres de tripulación).
