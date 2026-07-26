# Libro de Vuelo TCP — Plan de Implementación Ultra-Detallado

> **Objetivo**: Este documento contiene TODA la información que un modelo de IA necesita para implementar el Libro de Vuelo TCP sin preguntas adicionales. Cada paso incluye archivos afectados, código de referencia, y reglas inquebrantables.

---

## 1. CONTEXTO DEL PROYECTO

### Stack
- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Express 4 + tsx (TypeScript runtime, `server.ts` monolítico ~2357 líneas)
- **DB**: Supabase (PostgreSQL), tabla `flight_logs` y `profiles`
- **Navegación**: Sin router — estado `screen` en `App.tsx` con renderizado condicional
- **PDF**: `@react-pdf/renderer`
- **Excel**: `exceljs` + `file-saver`

### Archivos clave existentes (NO MODIFICAR excepto donde se indica)

| Archivo | Descripción | ¿Modificar? |
|---|---|---|
| `src/components/LibroScreen.tsx` (3998 líneas) | Libro de vuelo para pilotos | ❌ **NO TOCAR** |
| `src/components/FlightLogPDF.tsx` (684 líneas) | PDF de pilotos formato OACI | ❌ **NO TOCAR** |
| `src/components/AnacAuth.tsx` (174 líneas) | Login ANAC (reutilizable) | ❌ **NO TOCAR** |
| `server.ts` (~2357 líneas) | Backend Express | ✅ AGREGAR 2 endpoints al final |
| `src/App.tsx` (~2064 líneas) | Componente principal | ✅ 5 ediciones quirúrgicas |
| `src/types.ts` (234 líneas) | Interfaces TypeScript | ❌ **NO TOCAR** (ya tiene todo) |
| `planilla modelo tcp.xlsx` | Formato oficial ANAC para TCP | 📄 Solo referencia |

### Roles de usuario
- `piloto_fb` → Ve el `LibroScreen` actual (pilotos)
- `tcp_fb` → Actualmente NO ve el Libro. **Objetivo: que vea `LibroTcpScreen`**

### Base de datos — SIN CAMBIOS
La tabla `flight_logs` existente tiene TODAS las columnas necesarias para TCP. Los logs TCP simplemente usan `cargoID = "5"` y dejan las columnas de discriminación de pilotos en `0` (default).

---

## 2. ANÁLISIS EXACTO DE DIFERENCIAS: PAYLOAD PILOTO vs TCP

### 2.1 Payload TCP (capturado del portal ANAC — FORMATO EXACTO A REPLICAR)

```json
{
    "Discriminaciones": [],
    "discriminaciones": [],
    "horasDia": "1",
    "horasNoche": "1",
    "cargoID": 5,
    "origenID": "AER",
    "destinoID": "CBA",
    "origenPersonalizado": "",
    "destinoPersonalizado": "",
    "fechaHoraSalida": "2026-07-24T00:00:00.000Z",
    "fechaHoraLlegada": "2026-07-24T02:00:00.000Z",
    "aterrizajes": 1,
    "autoridadCertificanteID": "15",
    "observaciones": "Matias Miret",
    "matriculaAvion": "LV-KCE",
    "finalidadID": "79"
}
```

### 2.2 Payload PILOTO (actual en server.ts, para comparación)

```json
{
    "Discriminaciones": [{"tipoDiscriminacionID": 3, "horas": "1.0"}],
    "aterrizajes": 1,
    "autoridadCertificanteID": 15,
    "cargoID": 1,
    "clase": "MULT-T",
    "destinoID": "CBA",
    "destinoPersonalizado": "",
    "discriminaciones": [],
    "fechaHoraLlegada": "2026-07-24T02:00:00.000Z",
    "fechaHoraSalida": "2026-07-24T00:00:00.000Z",
    "finalidadID": 79,
    "horasDia": 1.0,
    "horasNoche": 0,
    "marcaModeloID": 302371,
    "matriculaAvion": "LV-KCE",
    "observaciones": "Nombre certificante",
    "origenID": "AER",
    "origenPersonalizado": "",
    "potencia": 26000,
    "tipoVueloID": 2,
    "vueloTripulanteID": 0,
    "vueloTripulanteIDs": null
}
```

### 2.3 Tabla de diferencias exactas

| Campo | Piloto | TCP | Nota |
|---|---|---|---|
| `horasDia` | `number` (ej: `1.0`) | `string` (ej: `"1"`) | **TIPO DIFERENTE** |
| `horasNoche` | `number` (ej: `0`) | `string` (ej: `"1"`) | **TIPO DIFERENTE** |
| `cargoID` | `number` (`1` piloto, `2` copiloto) | `number` (`5` = TCP) | **SIEMPRE 5** |
| `autoridadCertificanteID` | `number` (ej: `15`) | `string` (ej: `"15"`) | **TIPO DIFERENTE** |
| `finalidadID` | `number` (ej: `79`) | `string` (ej: `"79"`) | **TIPO DIFERENTE** |
| `Discriminaciones` | Array con datos | `[]` siempre vacío | TCP no tiene discriminaciones |
| `clase` | `"MULT-T"` | ❌ **NO ENVIAR** | Campo ausente en TCP |
| `marcaModeloID` | `302371` | ❌ **NO ENVIAR** | Campo ausente en TCP |
| `potencia` | `26000` | ❌ **NO ENVIAR** | Campo ausente en TCP |
| `tipoVueloID` | `2` | ❌ **NO ENVIAR** | Campo ausente en TCP |
| `vueloTripulanteID` | `0` | ❌ **NO ENVIAR** | Campo ausente en TCP |
| `vueloTripulanteIDs` | `null` | ❌ **NO ENVIAR** | Campo ausente en TCP |

### 2.4 URLs y Headers

| Operación | URL | Referer |
|---|---|---|
| **Create TCP** | `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create` | `https://cad.anac.gob.ar/vuelotripulantetcp/create` |
| **Create Piloto** | `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create` | `https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Create` |
| **GetPagedList TCP** | `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/GetPagedList?...&tipoTrip=TCP&...` | — |
| **GetPagedList Piloto** | `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/GetPagedList?...&tipoTrip=TM&...` | — |

> **CRÍTICO**: La URL de Create es IDÉNTICA. La diferencia está en el Referer y en el payload.

### 2.5 Autenticación ANAC
El login ANAC es IDÉNTICO para pilotos y TCP. El sistema ANAC detecta automáticamente si el usuario es piloto o TCP basándose en las credenciales. Se reutiliza el componente `AnacAuth.tsx` y el endpoint `POST /api/auth-anac` existentes sin ningún cambio.

---

## 3. FORMATO OFICIAL PDF TCP (extraído de `planilla modelo tcp.xlsx`)

### Estructura de columnas de la planilla oficial

La planilla tiene las siguientes columnas (fila de encabezado multi-nivel):

**Fila 1 — Encabezado del documento:**
```
APELLIDO Y NOMBRE: [nombre]    CERTIFICADO DE COMPETENCIA: TCP    LEGAJO: [legajo]    FOLIO N: [folio]
```

**Fila 2 — Categorías principales:**
```
| AÑO | ITINERARIO | FINALIDAD DEL VUELO | AERONAVES UTILIZADAS | TIEMPOS DE VUELO | ATERRIZAJES | DISCRIMINACIÓN DE TIEMPO | CERTIFICACIONES |
```

**Fila 3-5 — Sub-encabezados:**
```
| DÍA | MES | HORA DE SALIDA | DESDE - HASTA | HORA DE LLEGADA | FINALIDAD | MARCA | MATRÍCULA | FOLIO RVA | DE DÍA | NOCHE | ATERRIZAJES | INSTRUCTOR DE TCP | TIPO DE AERONAVE | CERTIFICACIONES (col combinada) |
```

### Columnas finales del PDF TCP (17 columnas):

1. **DÍA** — Día del mes
2. **MES** — Mes numérico
3. **HORA DE SALIDA** — UTC HH:MM
4. **DESDE** — Código aeropuerto origen
5. **HASTA** — Código aeropuerto destino
6. **HORA DE LLEGADA** — UTC HH:MM
7. **FINALIDAD DEL VUELO** — Sigla (ej: LA, TCPI)
8. **MARCA** — Marca/modelo avión (ej: "BO 737-8Q8 30720")
9. **MATRÍCULA** — Registro aeronave (ej: LV-KCE)
10. **FOLIO RVA** — Número de folio
11. **DE DÍA** — Horas diurnas
12. **NOCHE** — Horas nocturnas
13. **ATERRIZAJES** — Cantidad
14. **INSTRUCTOR DE TCP** — Horas de instrucción TCP (si aplica)
15. **TIPO DE AERONAVE** — Tipo avión
16. **CERTIFICACIONES** — Autoridad certificante + nombre (columna combinada)
17. **TOTAL HORAS** — Total de la página (footer)

> El PDF debe ser **landscape** para acomodar todas las columnas, similar al `FlightLogPDF.tsx` de pilotos.

---

## 4. PASOS DE IMPLEMENTACIÓN

---

### PASO 1: Backend — Agregar 2 endpoints TCP en `server.ts`

**Archivo**: `server.ts`
**Ubicación**: Insertar DESPUÉS de la línea 696 (cierre del endpoint `get-anac-logs`), ANTES de la línea 698 (comentario ARMS ROSTER).
**Impacto en pilotos**: NINGUNO — son endpoints nuevos.

#### 1.1 — Rate limiters (agregar junto a los existentes, línea ~84)

Insertar después de la línea 85 (`app.use("/api/arms/sync-roster", authLimiter);`):

```typescript
app.use("/api/sync-anac-tcp", syncLimiter);
app.use("/api/get-anac-logs-tcp", syncLimiter);
```

#### 1.2 — Endpoint `POST /api/sync-anac-tcp`

**Lógica**: Recibe logs TCP del frontend, construye el payload TCP exacto y los envía a ANAC.

```typescript
// --- ANAC TCP Sincronización API ---
app.post("/api/sync-anac-tcp", async (req, res) => {
  const { user_id, anac_token, storageState, logs_to_sync } = req.body;

  if (!user_id || (!anac_token && !storageState)) {
    return res.status(400).json({ error: "user_id y sesión son requeridos" });
  }

  try {
    const results = [];
    const logs = logs_to_sync || [];
    
    // Construir Cookie Header completo (IDÉNTICO a sync-anac de pilotos)
    let cookieHeader = "";
    if (storageState && storageState.cookies) {
      cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
    } else {
      cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
    }

    console.log(`[SYNC_ANAC_TCP] Iniciando sincronización TCP con ${storageState ? 'sesión completa' : 'token simple'}`);

    // Ordenar cronológicamente (ANAC exige orden)
    const sortedLogs = [...logs].sort((a: any, b: any) => {
      return new Date(a.fechaHoraSalida || 0).getTime() - new Date(b.fechaHoraSalida || 0).getTime();
    });

    for (const log of sortedLogs) {
      try {
        // --- Mapeo de aeropuertos (REUTILIZAR la misma función mapAirportCode del endpoint de pilotos) ---
        const mapAirportCode = (code: string) => {
          const c = code.trim().toUpperCase();
          // COPIAR el diccionario ANAC_MAPPINGS completo de sync-anac (líneas 404-447 del server.ts)
          const ANAC_MAPPINGS: Record<string, string> = {
            "AEP": "AER", "SABE": "AER",
            "EZE": "EZE", "SAEZ": "EZE",
            "COR": "CBA", "SACO": "CBA",
            // ... (incluir TODOS los mappings del endpoint de pilotos)
          };
          return ANAC_MAPPINGS[c] || c;
        };

        const oriID = mapAirportCode(String(log.origenID || ""));
        const destID = mapAirportCode(String(log.destinoID || ""));

        let obs = log.observaciones || "";
        let authId = String(log.autoridadCertificanteID || "15");
        if (authId && isNaN(Number(authId))) {
          obs = authId + (obs ? " - " + obs : "");
          authId = "15";
        }

        // Ajuste de fechas (IDÉNTICO a pilotos)
        const dSalida = new Date(log.fechaHoraSalida);
        const dLlegada = new Date(log.fechaHoraLlegada);
        if (dLlegada < dSalida) {
          dLlegada.setDate(dLlegada.getDate() + 1);
        }

        // ╔═══════════════════════════════════════════════════════════════╗
        // ║  PAYLOAD TCP — FORMATO EXACTO CAPTURADO DEL PORTAL ANAC    ║
        // ║  DIFERENCIAS CLAVE:                                         ║
        // ║  - horasDia/horasNoche son STRING (no number)               ║
        // ║  - cargoID siempre 5                                        ║
        // ║  - autoridadCertificanteID es STRING                        ║
        // ║  - finalidadID es STRING                                    ║
        // ║  - NO incluye: clase, marcaModeloID, potencia, tipoVueloID ║
        // ║  - NO incluye: vueloTripulanteID, vueloTripulanteIDs       ║
        // ║  - Discriminaciones siempre vacías                          ║
        // ╚═══════════════════════════════════════════════════════════════╝
        const payload = {
          Discriminaciones: [],
          discriminaciones: [],
          horasDia: String(parseFloat(log.horasDia || "0")),
          horasNoche: String(parseFloat(log.horasNoche || "0")),
          cargoID: 5,
          origenID: oriID,
          destinoID: destID,
          origenPersonalizado: "",
          destinoPersonalizado: "",
          fechaHoraSalida: dSalida.toISOString(),
          fechaHoraLlegada: dLlegada.toISOString(),
          aterrizajes: parseInt(log.aterrizajes || "1"),
          autoridadCertificanteID: String(authId),
          observaciones: obs,
          matriculaAvion: log.matriculaAvion,
          finalidadID: String(log.finalidadID || "79")
        };

        console.log("[SYNC_ANAC_TCP] Payload:", JSON.stringify(payload));

        let anacResponse;
        try {
          anacResponse = await axios.post(
            "https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create",
            payload,
            {
              headers: {
                "Cookie": cookieHeader,
                "Content-Type": "application/json; charset=utf-8",
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://cad.anac.gob.ar",
                "Referer": "https://cad.anac.gob.ar/vuelotripulantetcp/create",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
              },
              timeout: 15000
            }
          );
        } catch (err: any) {
          // Fallback a cadam.anac.gob.ar (IDÉNTICO a pilotos)
          if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
            anacResponse = await axios.post(
              "https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/Create",
              payload,
              {
                headers: {
                  "Cookie": cookieHeader,
                  "Content-Type": "application/json; charset=utf-8",
                  "X-Requested-With": "XMLHttpRequest",
                  "Origin": "https://cadam.anac.gob.ar",
                  "Referer": "https://cadam.anac.gob.ar/Cadam/vuelotripulantetcp/create",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36"
                },
                timeout: 15000
              }
            );
          } else {
            throw err;
          }
        }

        results.push({ id: log.id, status: "success", data: anacResponse.data });
        await new Promise(resolve => setTimeout(resolve, 2000)); // delay seguridad
      } catch (itemError: any) {
        results.push({ id: log.id, status: "error", error: itemError.response?.data || itemError.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

#### 1.3 — Endpoint `POST /api/get-anac-logs-tcp`

```typescript
// --- ANAC TCP Get Logs API ---
app.post("/api/get-anac-logs-tcp", async (req, res) => {
  const { anac_token, storageState, pageNumber = 1, rowsPerPage = 50 } = req.body;

  if (!anac_token && !storageState) {
    return res.status(400).json({ error: "Sesión de ANAC es requerida" });
  }

  try {
    let cookieHeader = "";
    if (storageState && storageState.cookies) {
      cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
    } else {
      cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
    }

    console.log(`[GET_ANAC_LOGS_TCP] Solicitando página ${pageNumber} de ANAC TCP...`);

    // DIFERENCIA CLAVE: tipoTrip=TCP (no TM como pilotos)
    const url = `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/GetPagedList?descripcion=&tipoTrip=TCP&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}&mostrarIngresados=true&solicitudFoliadoId=null`;
    
    let anacResponse;
    try {
      anacResponse = await axios.get(url, {
        headers: {
          "Cookie": cookieHeader,
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json, text/plain, */*",
          "Origin": "https://cad.anac.gob.ar",
          "Referer": "https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Index",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
        },
        timeout: 15000
      });
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
        const fallbackUrl = `https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/GetPagedList?descripcion=&tipoTrip=TCP&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}&mostrarIngresados=true&solicitudFoliadoId=null`;
        anacResponse = await axios.get(fallbackUrl, {
          headers: {
            "Cookie": cookieHeader,
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36"
          },
          timeout: 15000
        });
      } else {
        throw err;
      }
    }

    res.json(anacResponse.data);
  } catch (error: any) {
    console.error("[GET_ANAC_LOGS_TCP] Error:", error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### PASO 2: Frontend — Crear `LibroTcpScreen.tsx`

**Archivo**: `src/components/LibroTcpScreen.tsx` (NUEVO)
**Tamaño estimado**: ~2000-2500 líneas
**Referencia de estilo**: Copiar estructura y estilos de `LibroScreen.tsx` pero simplificar significativamente.

#### 2.1 — Props (IDÉNTICAS a LibroScreen)

```typescript
interface LibroTcpScreenProps {
  logs: FlightLog[];
  setLogs: React.Dispatch<React.SetStateAction<FlightLog[]>>;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshData: () => Promise<Profile | null>;
  loading: boolean;
  userId: string;
  onGoToSuscripcion?: () => void;
}
```

#### 2.2 — Imports necesarios

```typescript
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, History, BarChart3, FileDown, Calendar as CalendarIcon, Clock, MapPin, PlaneTakeoff, Save, Trash2, ChevronRight, Info, Edit2, FileText, ArrowLeft, User, X, AlertTriangle, AlertCircle, CheckCircle2, Globe, RefreshCw, LogOut, WifiOff, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { FlightLog, Profile, AnacLog } from '@/src/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { FlightLogTcpPDF } from './FlightLogTcpPDF';
import { AnacAuth } from './AnacAuth';
import { supabase } from '@/src/utils/supabase/client';
import { getApiUrl } from '@/src/utils/api';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getQueue, addToQueue, removeFromQueue, pendingCount, PendingOp } from '@/src/utils/offlineQueue';
import airportsCsvRaw from '../../airports.csv?raw';
```

#### 2.3 — Constantes reutilizables (COPIAR de LibroScreen.tsx)

Copiar EXACTAMENTE estas constantes de `LibroScreen.tsx`:
- `FLIGHT_PURPOSES` (líneas 102-126) — lista completa de finalidades de vuelo
- `FLIGHT_TYPES` (líneas 128-132) — NO se usa en TCP pero incluir por si acaso
- `CERTIFIER_ROLES` (líneas 134-154) — lista de autoridades certificantes
- `IATA_AIRPORTS` (líneas 156-218) — diccionario de aeropuertos
- `IATA_LIST` (línea 220) — array derivado
- `DecimalInput` component (líneas 224-271) — input para decimales
- `parseAirportsCsv` function (líneas 273-297) — parser de CSV
- `localAirportsList` (línea 299) — lista local de aeropuertos
- `AirportAutocomplete` component (líneas 301-400+) — autocomplete de aeropuertos
- `resolveToAnac` function (líneas 690-728) — resolver código ANAC

#### 2.4 — Formulario TCP simplificado

El form state solo necesita estos campos:

```typescript
const getInitialFormState = () => ({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  day: new Date().getDate(),
  departure_time_utc: '',
  arrival_time_utc: '',
  origin_ad: '',
  destination_ad: '',
  registration: '',          // matrícula
  aircraft_model: '',        // marca/modelo (informativo, no se envía a ANAC)
  flight_purpose: localStorage.getItem('saved_tcp_flight_purpose') || '79',
  landings: 1,
  certifier_role_id: localStorage.getItem('saved_tcp_certifier_role_id') || '15',
  certifier_name: localStorage.getItem('saved_tcp_certifier_name') || '',
  folio_number: 1,
  // Horas se calculan automáticamente o se ingresan manualmente
  horas_dia: 0,
  horas_noche: 0,
});
```

**Campos que NO existen en el formulario TCP** (comparado con pilotos):
- ❌ `aircraft_class` (clase)
- ❌ `power_rating` (potencia)
- ❌ `airfield_day_pilot`, `airfield_day_copilot`, etc. (desglose piloto/copiloto)
- ❌ `cross_country_day_pilot`, etc.
- ❌ `ifr_real_pilot`, `ifr_real_copilot`, `ifr_hood`
- ❌ `instruction_time`, `multi_engine`, `jet`, `turboprop`, `ag_application`
- ❌ `sim_instructor`, `sim_student`
- ❌ Selector de simulador

#### 2.5 — Función `saveLog` TCP

Al guardar en Supabase, el `logToSave` debe tener esta estructura:

```typescript
const logToSave: any = {
  user_id: userId,
  fechaHoraSalida: checkSalida,       // ISO string
  fechaHoraLlegada: checkLlegada,     // ISO string
  origenID: resolvedOrigin,           // Código ANAC
  destinoID: resolvedDest,            // Código ANAC
  finalidadID: formData.flight_purpose || '79',
  clase: '',                          // Vacío para TCP
  matriculaAvion: (formData.registration || '').toUpperCase(),
  Marca_Modelo: formData.aircraft_model || '',
  potencia: 0,                        // No aplica para TCP
  aterrizajes: Number(formData.landings || 1),
  horasDia: String(formData.horas_dia || 0),
  horasNoche: String(formData.horas_noche || 0),
  tipoVueloID: '2',                  // Default travesía (no se envía a ANAC pero se guarda localmente)
  cargoID: '5',                       // ← SIEMPRE "5" para TCP
  autoridadCertificanteID: formData.certifier_role_id || '15',
  observaciones: formData.certifier_name || '',
  // Todos los campos de discriminación en 0
  ifr_instrument: 0,
  instruccion: 0,
  multi_engine: 0,
  jet: 0,
  turboprop: 0,
  ag_application: 0,
  folio_number: Number(formData.folio_number || 1),
  airfield_day_pilot: 0,
  airfield_day_copilot: 0,
  airfield_night_pilot: 0,
  airfield_night_copilot: 0,
  cross_country_day_pilot: 0,
  cross_country_day_copilot: 0,
  cross_country_night_pilot: 0,
  cross_country_night_copilot: 0,
  ifr_real_pilot: 0,
  ifr_real_copilot: 0,
  ifr_hood: 0,
  sim_instructor: 0,
  sim_student: 0,
};
```

#### 2.6 — Sincronización ANAC TCP

La función `handleSyncANAC` debe:
1. Usar endpoint `/api/sync-anac-tcp` (no `/api/sync-anac`)
2. Aplicar `mapAirportCode` igual que pilotos

```typescript
const response = await fetch(getApiUrl('/api/sync-anac-tcp'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: profile.id,
    anac_token: tokenToUse,
    storageState: sessionToUse,
    logs_to_sync: mappedLogsToSync
  })
});
```

#### 2.7 — Comparación con ANAC (fetchAnacLogs TCP)

Debe llamar a `/api/get-anac-logs-tcp`:

```typescript
const fetchAnacLogs = async (tokenOverride?: string, sessionOverride?: any) => {
  const tokenToUse = tokenOverride || anacToken;
  const sessionToUse = sessionOverride || anacSession;
  if (!tokenToUse && !sessionToUse) return [];
  try {
    const response = await fetch(getApiUrl('/api/get-anac-logs-tcp'), {  // ← TCP endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anac_token: tokenToUse, storageState: sessionToUse, rowsPerPage: 100 })
    });
    if (response.ok) {
      const data = await response.json();
      return data.dataSource as AnacLog[];
    }
    return [];
  } catch (err) {
    return [];
  }
};
```

#### 2.8 — Tabs del componente

```
TabsList: ['dashboard', 'nuevo', 'historial', 'sync', 'exportar']
```

- **dashboard**: Gráficos de barras (horas mensuales), cards de totales (horas día, noche, aterrizajes, vuelos)
- **nuevo**: Formulario simplificado (ver 2.4)
- **historial**: Tabla con columnas: Fecha, Origen→Destino, Matrícula, Hrs Día, Hrs Noche, Aterr., Finalidad + botones editar/eliminar
- **sync**: AnacAuth component + botón comparar + lista de pendientes + botón sincronizar
- **exportar**: Botones Excel y PDF

#### 2.9 — Exportación Excel TCP

Estructura simplificada del workbook Excel para TCP:

```typescript
// Columnas del Excel TCP (una por sheet/folio):
const headers = [
  'DÍA', 'MES', 'HORA SALIDA', 'DESDE', 'HASTA', 'HORA LLEGADA',
  'FINALIDAD', 'MARCA/MODELO', 'MATRÍCULA',
  'HORAS DÍA', 'HORAS NOCHE', 'ATERRIZAJES',
  'AUTORIDAD CERTIFICANTE', 'NOMBRE CERTIFICANTE'
];
```

---

### PASO 3: Frontend — Crear `FlightLogTcpPDF.tsx`

**Archivo**: `src/components/FlightLogTcpPDF.tsx` (NUEVO)
**Tamaño estimado**: ~300-400 líneas
**Referencia de estilo**: `FlightLogPDF.tsx` (mismos styles base, pero columnas diferentes)

#### 3.1 — Estructura del PDF

Usar `@react-pdf/renderer` con estas características:
- **Orientación**: Landscape (igual que pilotos)
- **Filas por página**: 15 (igual que pilotos)
- **Header fijo** en cada página con: Nombre, Legajo, Certificado: TCP, Folio N°

#### 3.2 — Columnas TCP

```typescript
const col = {
  dia: 25,       // DÍA
  mes: 25,       // MES
  salida: 45,    // HORA DE SALIDA
  desde: 60,     // DESDE
  hasta: 60,     // HASTA
  llegada: 45,   // HORA DE LLEGADA
  finalidad: 35, // FINALIDAD DEL VUELO
  marca: 90,     // MARCA
  matr: 55,      // MATRÍCULA
  folioRva: 40,  // FOLIO RVA
  dia_h: 35,     // DE DÍA (horas)
  noche: 35,     // NOCHE (horas)
  aterr: 30,     // ATERRIZAJES
  instTcp: 40,   // INSTRUCTOR DE TCP
  tipoAero: 50,  // TIPO DE AERONAVE
  cert: 160,     // CERTIFICACIONES
};
```

#### 3.3 — Props

```typescript
interface Props {
  logs: FlightLog[];
  profile?: Profile;
}
```

#### 3.4 — Implementación

Seguir exactamente el patrón de `FlightLogPDF.tsx`:
- Mismo `StyleSheet.create()` base
- Misma estructura `Document > Page > View` con headers fijos
- Misma lógica de paginación (15 filas por página)
- Misma fila de totales al final de cada página
- Misma sección de firma al final

---

### PASO 4: Frontend — Editar `App.tsx` (5 cambios quirúrgicos)

**Archivo**: `src/App.tsx`
**Impacto en pilotos**: NINGUNO — solo agrega rutas y elimina guards.

#### Edit 1 — Agregar import (línea ~53, después del import de AnacAuth)

```typescript
import { LibroTcpScreen } from './components/LibroTcpScreen';
```

#### Edit 2 — Mostrar botón Libro en BottomNav para TODOS (línea 175-180)

**ANTES** (líneas 175-180):
```tsx
      {role !== 'tcp_fb' && (
        <button onClick={() => setScreen('libro')} className={`nav-item ${currentScreen === 'libro' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
          <Plane size={24} className={currentScreen === 'libro' ? 'fill-[#1152d4]/20' : ''} />
          <span className="text-[10px] font-medium">Libro</span>
        </button>
      )}
```

**DESPUÉS**:
```tsx
      <button onClick={() => setScreen('libro')} className={`nav-item ${currentScreen === 'libro' ? 'text-[#1152d4]' : 'text-slate-500 dark:text-slate-400'}`}>
        <Plane size={24} className={currentScreen === 'libro' ? 'fill-[#1152d4]/20' : ''} />
        <span className="text-[10px] font-medium">Libro</span>
      </button>
```

#### Edit 3 — Mostrar card Libro en HomeScreen para TODOS (líneas 496-510)

**ANTES** (líneas 496-510):
```tsx
          {role !== 'tcp_fb' && (
            <button onClick={onGoToLibro} ...>
              ...
            </button>
          )}
```

**DESPUÉS**:
```tsx
          <button onClick={onGoToLibro} ...>
            ...
          </button>
```

#### Edit 4 — Remover guard de navegación (línea 1278)

**ANTES**:
```typescript
      if (s === 'libro' && profile?.role === 'tcp_fb') return prev;
```

**DESPUÉS** (eliminar la línea o comentarla):
```typescript
      // TCP now has its own LibroTcpScreen
```

#### Edit 5 — Renderizar LibroTcpScreen para TCP (líneas 1720-1729)

**ANTES** (líneas 1717-1730):
```tsx
              {!user ? (
                <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
              ) : (
                <LibroScreen
                  logs={logs}
                  setLogs={setLogs}
                  profile={profile}
                  setProfile={setProfile}
                  refreshData={() => fetchData(user.id)}
                  loading={dataLoading}
                  userId={user.id}
                  onGoToSuscripcion={() => setScreen('suscripcion')}
                />
              )}
```

**DESPUÉS**:
```tsx
              {!user ? (
                <AuthScreen onRegisterSuccess={() => setRegisterAlert({ show: true })} />
              ) : profile?.role === 'tcp_fb' ? (
                <LibroTcpScreen
                  logs={logs}
                  setLogs={setLogs}
                  profile={profile}
                  setProfile={setProfile}
                  refreshData={() => fetchData(user.id)}
                  loading={dataLoading}
                  userId={user.id}
                  onGoToSuscripcion={() => setScreen('suscripcion')}
                />
              ) : (
                <LibroScreen
                  logs={logs}
                  setLogs={setLogs}
                  profile={profile}
                  setProfile={setProfile}
                  refreshData={() => fetchData(user.id)}
                  loading={dataLoading}
                  userId={user.id}
                  onGoToSuscripcion={() => setScreen('suscripcion')}
                />
              )}
```

---

### PASO 5: Verificación

1. Ejecutar `npm run build` — debe compilar sin errores
2. Ejecutar `npm run dev` — verificar en localhost
3. **Como piloto**: verificar que NADA cambió en el libro de vuelo
4. **Como TCP**: verificar que el libro aparece y el formulario es simplificado
5. Crear un vuelo de prueba TCP y verificar que se guarda en Supabase con `cargoID = "5"`
6. Hacer login ANAC y verificar la comparación y sincronización

---

## 5. REGLAS INQUEBRANTABLES

1. **NO modificar `LibroScreen.tsx`** bajo ningún concepto
2. **NO modificar `FlightLogPDF.tsx`** bajo ningún concepto
3. **NO modificar los endpoints `sync-anac` ni `get-anac-logs` existentes**
4. **NO ejecutar SQL contra Supabase** — no hay cambios de schema
5. **NO modificar `CHANGELOG_DATA`** en App.tsx sin preguntar al usuario
6. **El payload TCP DEBE coincidir EXACTAMENTE** con el modelo capturado (sección 2.1)
7. **Las API keys NO deben hardcodearse** — usar env vars existentes
8. **NO subir a GitHub** — solo implementación local
9. **Copiar constantes** (FLIGHT_PURPOSES, CERTIFIER_ROLES, etc.) en lugar de importarlas desde LibroScreen para evitar dependencias cruzadas
10. **El `cargoID` para TCP es SIEMPRE `5`** — nunca `"5"` como string en el payload ANAC (es number en el JSON), pero se almacena como `"5"` string en Supabase ya que la columna `cargoID` es TEXT

---

## 6. RESUMEN DE ARCHIVOS FINALES

| Archivo | Acción | Líneas estimadas |
|---|---|---|
| `src/components/LibroTcpScreen.tsx` | **CREAR** | ~2000-2500 |
| `src/components/FlightLogTcpPDF.tsx` | **CREAR** | ~300-400 |
| `server.ts` | **AGREGAR** 2 endpoints + 2 rate limiters | +~120 líneas |
| `src/App.tsx` | **5 ediciones** quirúrgicas | ±10 líneas netas |
