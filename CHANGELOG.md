# Changelog

## [1.4.4] — 23 de Junio, 2026
- **Roster ARMS**: ahora podés exportar tu roster en dos formatos — archivo .ICS para importar en Google Calendar o Apple Calendar, y Almanaque PDF con calendario mensual imprimible.
- **Almanaque PDF**: calendario mensual en hoja A4 apaisada con rutas, horarios de presentación, números de vuelo y tipo de actividad. Los días de guardia muestran el rango horario. Todo en una sola página.
- **Corrección ICS**: los eventos exportados a Google Calendar ahora se importan correctamente (DTSTAMP requerido por RFC 5545, UIDs determinísticos).

## [1.4.2] — 10 de Junio, 2026
- **Libro de Vuelo**: ahora podés guardar vuelos sin conexión a internet. Se sincronizan automáticamente cuando recuperes la conexión. Los vuelos pendientes se ven con un ícono de reloj en el historial.
- **Roster ARMS**: la sincronización ahora detecta si estás desconectado y muestra un aviso claro sin borrar tus credenciales guardadas. Si no hay cambios en el roster, te lo notificamos. Todos los carteles tienen cuenta regresiva y se cierran solos.

## [1.4.1] — 5 de Junio, 2026
- Correcciones de seguridad: se ocultaron las trazas de error en producción, se escapó la inyección HTML, se agregó limitación de velocidad en los endpoints y se restringió CORS.
- Se agregaron políticas de seguridad (RLS) en la base de datos de Supabase.

## [1.4.0] — 1 de Junio, 2026
- Nueva pantalla **Roster ARMS**: calendario mensual sincronizado con el portal ARMS, con detalle de vuelos por día y horarios locales/UTC.
- Tripulación dividida por roles (Vuelo y Cabina) con ordenamiento prioritario.
- El roster se guarda automáticamente y está disponible sin conexión.

## [1.3.1] — 14 de Mayo, 2026
- Sincronización ANAC más rápida: optimizamos el inicio de sesión automático reduciendo los tiempos de espera.

## [1.3.0] — 11 de Mayo, 2026
- Nueva función **"Restablecer registros"**: consolidá tus horas en el perfil y limpiá la base de datos para empezar de cero.
- Carga más rápida: los campos IFR se autocompletan y los campos con cero se limpian solos al enfocar.
- La app te avisa cuando estás por llegar al límite de 150 registros.

## [1.2.1] — 4 de Mayo, 2026
- Mejoras en el PDF del libro de vuelo: líneas de corte punteadas, márgenes optimizados para impresión y foliado manual.

## [1.2.0] — 1 de Mayo, 2026
- Sincronización manual con el portal ANAC: subí tus vuelos al sistema oficial de forma controlada.
- Traductor inteligente de aeropuertos (ej. AEP → AER) con caché local para funcionar sin conexión.
- Ventana de revisión de vuelos pendientes antes de sincronizar.

## [1.1.0] — 27 de Abril, 2026
- Dashboard renovado: mostramos horas diurnas y nocturnas por separado con colores distintivos.
- Mejoras en carga de vuelos: auto-limpieza de ceros, validación de ruta antes de habilitar tiempos, y nombre de archivo PDF con rango de folios.

## [1.0.9] — 27 de Abril, 2026
- El número de folio ahora se incluye en la exportación a Excel.
- Ajustes visuales en el PDF: columnas consolidadas, totales alineados a la derecha.

## [1.0.8] — 20 de Abril, 2026
- Rediseño del PDF del libro de vuelo para cumplir con las dimensiones oficiales ANAC (35.5cm x 16.5cm).
- Cálculos acumulativos automáticos de totales entre páginas.

## [1.0.7] — 18 de Abril, 2026
- Solucionado el problema de carga de imágenes en producción (Vercel).
- Mejora en la memoria caché del Service Worker para evitar errores sin conexión.
