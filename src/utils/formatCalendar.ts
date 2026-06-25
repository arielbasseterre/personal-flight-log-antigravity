export const FLIGHT_EVENT_FORMATS = [
  { value: 'route_flight_times', label: 'Ruta / Vuelo + horarios (AEP-MDZ / FO5140)' },
  { value: 'flight_route_times', label: 'Vuelo / Ruta + horarios (FO5140 / AEP-MDZ)' },
  { value: 'route_times', label: 'Solo ruta + horarios (AEP-MDZ)' },
  { value: 'flight_only', label: 'Solo vuelo (FO5140)' },
] as const;

export const REPORT_EVENT_FORMATS = [
  { value: 'type_info', label: 'Detallado (Guardia STB - AEP 0800-1600)' },
  { value: 'type_only', label: 'Solo tipo (Guardia / Libre / Curso)' },
] as const;

export type FlightEventFormat = typeof FLIGHT_EVENT_FORMATS[number]['value'];
export type ReportEventFormat = typeof REPORT_EVENT_FORMATS[number]['value'];

interface FlightPreview {
  summary: string;
  location: string;
  description: string;
}

export function formatFlightPreview(flightEventFormat: string): FlightPreview {
  const origin = 'AEP';
  const dest = 'MDZ';
  const flight = 'FO5140';
  const depTimeLoc = '12:00';
  const arrTimeLoc = '14:00';
  const depIcao = 'SABE';
  const arrIcao = 'SAME';
  const aircraft = 'B738';
  const block = '2:05';

  switch (flightEventFormat) {
    case 'route_flight_times':
      return {
        summary: `${origin}-${dest} / ${flight}`,
        location: `${depTimeLoc} - ${arrTimeLoc}`,
        description: `${depIcao}→${arrIcao} • ${aircraft} • ${block}`,
      };
    case 'flight_route_times':
      return {
        summary: `${flight} / ${origin}-${dest}`,
        location: `${depTimeLoc} - ${arrTimeLoc}`,
        description: `${depIcao}→${arrIcao} • ${aircraft} • ${block}`,
      };
    case 'route_times':
      return {
        summary: `${origin}-${dest}`,
        location: `${depTimeLoc} - ${arrTimeLoc}`,
        description: `${depIcao}→${arrIcao} • ${aircraft} • ${block}`,
      };
    case 'flight_only':
      return {
        summary: flight,
        location: '',
        description: `${origin}-${dest} • ${aircraft} • ${block}`,
      };
    default:
      return { summary: '', location: '', description: '' };
  }
}

export function formatReportPreview(reportEventFormat: string): FlightPreview {
  switch (reportEventFormat) {
    case 'type_info':
      return {
        summary: 'Guardia (STB) - AEP 0800-1600',
        location: '08:00 - 16:00 UTC',
        description: 'Guardia en Ezeiza',
      };
    case 'type_only':
      return {
        summary: 'Guardia',
        location: '',
        description: '',
      };
    default:
      return { summary: 'Guardia', location: '', description: '' };
  }
}
