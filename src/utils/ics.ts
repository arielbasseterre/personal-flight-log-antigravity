import type { ArmsDayEntry, ArmsFlightLeg } from '../types';

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function nowUTC(): string {
  const d = new Date();
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function toICSDatetime(dateISO: string, timeUTC: string | undefined): string {
  if (!timeUTC) return '';
  const [h, m] = timeUTC.split(':');
  return `${dateISO.replace(/-/g, '')}T${h}${m}00Z`;
}

function toICSDate(dateISO: string): string {
  return dateISO.replace(/-/g, '');
}

function formatCrewForLeg(leg: ArmsFlightLeg): string {
  if (!leg.crewComplement || leg.crewComplement.length === 0) return '';
  const roles: Record<string, string> = {
    CPT: 'Comandante',
    FO: 'Primer Oficial',
    CC: 'TCP',
    PU: 'Purser',
    OTHER: 'Tripulante',
  };
  return leg.crewComplement
    .map(c => `${roles[c.role] || c.role}: ${c.name.trim()}`)
    .join('\n');
}

export function generateRosterICS(
  entries: ArmsDayEntry[],
  month: number,
  year: number
): string {
  const now = nowUTC();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Flight Log//ARMS Roster//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:gringosoft roster`,
  ];

  for (const entry of entries) {
    const isDH = entry.eventType === 'FLIGHT_DH';

    switch (entry.eventType) {
      case 'FLIGHT_OP':
      case 'FLIGHT_DH': {
        for (let i = 0; i < entry.legs.length; i++) {
          const leg = entry.legs[i];
          if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) continue;

          const suffix = isDH ? ' (DH)' : '';
          const descParts: string[] = [
            `Vuelo: ${leg.flightNumber}${suffix}`,
            `Ruta: ${leg.origin} - ${leg.destination}`,
          ];
          if (i === 0 && leg.reportTimeLoc) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          descParts.push(
            `Salida: ${leg.departureTimeLoc} local`,
            `Llegada: ${leg.arrivalTimeLoc} local`,
            `Block: ${leg.blockTime}`,
          );

          const crew = formatCrewForLeg(leg);
          if (crew) descParts.push(`Tripulación:\n${crew}`);

          if (leg.remarks?.trim()) descParts.push(`Remarks: ${leg.remarks.trim()}`);

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:arms-${entry.dateISO}-${leg.flightNumber}-${i}@flightlog`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART:${toICSDatetime(entry.dateISO, leg.departureTimeUtc)}`);
          lines.push(`DTEND:${toICSDatetime(entry.dateISO, leg.arrivalTimeUtc)}`);
          lines.push(`SUMMARY:${escapeICS(`${leg.origin} - ${leg.destination} / ${leg.flightNumber}${suffix}`)}`);
          lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
          lines.push(`LOCATION:${escapeICS(`${leg.origin} - ${leg.destination}`)}`);
          lines.push('END:VEVENT');
        }
        break;
      }

      case 'STANDBY': {
        const uid = `arms-${entry.dateISO}-standby@flightlog`;
        if (entry.startTimeUtc && entry.endTimeUtc) {
          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
          lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
          lines.push('SUMMARY:Guardia (STB)');
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        } else {
          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push('SUMMARY:Guardia');
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        }
        break;
      }

      case 'GTR': {
        const uid = `arms-${entry.dateISO}-gtr@flightlog`;
        const title = `GTR - ${entry.rawTask || 'Entrenamiento Terrestre'}`;
        if (entry.startTimeUtc && entry.endTimeUtc) {
          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
          lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        } else {
          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          lines.push('END:VEVENT');
        }
        break;
      }

      case 'LAYOVER': {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:arms-${entry.dateISO}-layover-${entry.layoverAirport || 'NA'}@flightlog`);
        lines.push(`DTSTAMP:${now}`);
        lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
        lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
        lines.push(`SUMMARY:${escapeICS(`Escala - ${entry.layoverAirport || ''}`)}`);
        if (entry.layoverDuration) {
          lines.push(`DESCRIPTION:Duración en destino: ${entry.layoverDuration}`);
        }
        lines.push('END:VEVENT');
        break;
      }

      default:
        break;
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
