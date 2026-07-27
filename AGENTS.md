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
- `src/components/LibroTcpScreen.tsx` — Componente full (~1947 líneas): Excel export, ANAC sync, historial, reset
- `src/components/LibroScreen.tsx` — Versión pilotos (~3997 líneas, referencia para sync ANAC)

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
