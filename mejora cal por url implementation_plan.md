# Plan de Implementación: Personalización de Exportación de Calendario WebCal (URL)

Este plan describe los cambios necesarios para que los usuarios puedan personalizar cómo se exportan sus eventos de roster a su calendario por suscripción (WebCal) a partir de los diseños de las fotos provistas (Filtros, Agrupación de Vuelos, Formatos de Reportes/Vuelos y Minutos de post-bloque).

---

## Cambios Propuestos

### 1. Base de Datos (Supabase)

#### [NEW] [add_calendar_settings.sql](file:///c:/Users/Ariel/Downloads/personal-flight-log/scripts/add_calendar_settings.sql)
Crear una migración para agregar la columna `calendar_settings` a la tabla `profiles`:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calendar_settings JSONB DEFAULT '{
  "exportTodayOnwards": false,
  "excludeDeadhead": false,
  "excludeStandby": false,
  "excludeDayOff": false,
  "excludeReport": false,
  "excludeSimulator": false,
  "excludeDebrief": false,
  "excludeLayover": false,
  "layover30MinOnly": false,
  "aggregateFlights": false,
  "postFlightMinutes": 0,
  "flightTitleFormat": "route_flight",
  "flightLocationFormat": "times_flight",
  "flightDescriptionFormat": "city_icao",
  "reportTitleFormat": "type_info",
  "reportLocationFormat": "time_utc",
  "reportDescriptionFormat": "crew_info"
}'::jsonb;
```

---

### 2. Backend (Server)

#### [MODIFY] [server.ts](file:///c:/Users/Ariel/Downloads/personal-flight-log/server.ts)
*   **Consulta del Perfil**: Modificar el endpoint `/api/roster/calendar/:token` para obtener `calendar_settings` de la tabla `profiles`.
*   **Lógica de Generación de ICS (`generateRosterICSForUser`)**:
    *   Pasar `calendar_settings` como parámetro.
    *   **Filtros de Actividades**: Excluir eventos según los switches (`excludeDeadhead`, `excludeStandby`, `excludeDayOff`, etc.).
    *   **Filtro Temporal**: Si `exportTodayOnwards` es `true`, ignorar eventos anteriores a la fecha actual.
    *   **Unificación de Vuelos (`aggregateFlights`)**:
        *   Si es `true`, agrupar todos los tramos (`legs`) del día en un único `VEVENT`.
        *   La fecha/hora de inicio será la de salida (`departureTimeUtc`) del primer leg.
        *   La fecha/hora de fin será la de llegada (`arrivalTimeUtc`) del último leg, más los minutos adicionales definidos en `postFlightMinutes`.
        *   El título, ubicación y descripción se formatearán según las plantillas seleccionadas.
    *   **Minutos Post-Bloque (`postFlightMinutes`)**:
        *   Función auxiliar para sumar minutos a la hora UTC y formatearla para el estándar ICS.
        *   Se aplicará al final del último tramo del día.

---

### 3. Frontend (UI de Configuración)

#### [MODIFY] [ArmsRosterScreen.tsx](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/components/ArmsRosterScreen.tsx)
*   **Modal de Configuración de Calendario**:
    *   Expandir el modal de suscripción actual para incluir un panel de opciones organizado en secciones (imitando las imágenes de referencia 1, 2 y 3).
    *   **Filtros de Calendario (Toggles)**:
        *   Export Today Onwards
        *   Deadhead Flight
        *   StandBy Duty
        *   Day Off
        *   Report
        *   Simulator
        *   Debrief
        *   Layover and Hotel
        *   Show Layover & Hotel for 30 minutes only
    *   **Formato de Reportes (Dropdowns)**:
        *   Título, Ubicación y Descripción.
    *   **Formato de Vuelos**:
        *   Toggle de **Aggregate Flights** ("Unificar todos los vuelos del día").
        *   Input numérico / selector para **Minutos Post-Bloque** ("Minutos extras posteriores al último bloque").
        *   Dropdowns para Título, Ubicación y Descripción de los vuelos.
*   **Persistencia**:
    *   Guardar automáticamente (auto-save) los cambios en la base de datos haciendo un `update` a la tabla `profiles` en el campo `calendar_settings` a medida que el usuario cambia o interactúa con cada opción.
    *   Cargar las configuraciones guardadas de forma asíncrona al abrir el modal para poblar el estado inicial.

#### [MODIFY] [ics.ts](file:///c:/Users/Ariel/Downloads/personal-flight-log/src/utils/ics.ts)
*   Actualizar la función de generación del frontend `generateRosterICS` para que opcionalmente reciba y aplique las mismas reglas de personalización y minutos post-bloque cuando el usuario descargue el archivo `.ics` de forma directa.

---

## Plan de Verificación

### Pruebas Manuales
1.  **Guardado de Configuración**: Modificar opciones en la interfaz y confirmar que se persistan en el perfil del usuario en Supabase.
2.  **Suscripción WebCal**:
    *   Verificar que al suscribirse por URL, los eventos aparezcan de forma individual o unificada según esté configurado.
    *   Verificar que al configurar "30 minutos de post-bloque", la hora de finalización del evento en el calendario sea exactamente 30 minutos posterior a la hora real de llegada del último vuelo.
    *   Verificar que los filtros excluyan correctamente los tipos de actividad desmarcados (por ejemplo, ocultar las guardias/Standby si el toggle está activo).
