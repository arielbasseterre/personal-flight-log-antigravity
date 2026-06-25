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

function addMinutesToUtcTime(dateISO: string, timeUTC: string, minutes: number): string {
  if (!timeUTC) return '';
  const [h, m] = timeUTC.split(':').map(Number);
  const date = new Date(Date.UTC(
    parseInt(dateISO.substring(0, 4)),
    parseInt(dateISO.substring(5, 7)) - 1,
    parseInt(dateISO.substring(8, 10)),
    h,
    m,
    0
  ));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function isLeaveEntry(entry: ArmsDayEntry): boolean {
  return entry.eventType === 'LEAVE' || entry.rawTask?.toUpperCase().startsWith('LEAVE') || (entry.eventType === 'NDA' && entry.rawTask?.toUpperCase().includes('LEAVE'));
}

export function generateRosterICS(
  entries: ArmsDayEntry[],
  month: number,
  year: number,
  customSettings?: any
): string {
  const now = nowUTC();

  const defaultSettings = {
    exportTodayOnwards: false,
    excludeDeadhead: false,
    excludeStandby: false,
    excludeDayOff: false,
    excludeReport: false,
    excludeSimulator: false,
    excludeDebrief: false,
    excludeLayover: false,
    layover30MinOnly: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    flightTitleFormat: "route_flight",
    flightLocationFormat: "times_flight",
    flightDescriptionFormat: "city_icao",
    reportTitleFormat: "type_info",
    reportLocationFormat: "time_utc",
    reportDescriptionFormat: "crew_info"
  };

  const settings = { ...defaultSettings, ...customSettings };
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal Flight Log//ARMS Roster//ES',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:flightlog Roster`,
  ];

  for (const entry of entries) {
    // Temporal Filter: exportTodayOnwards
    if (settings.exportTodayOnwards) {
      const todayStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().substring(0, 10);
      if (entry.dateISO < todayStr) continue;
    }

    const isDH = entry.eventType === 'FLIGHT_DH';
    const isFlight = entry.eventType === 'FLIGHT_OP' || isDH;
    const isStandby = entry.eventType === 'STANDBY';
    const isDayOff = entry.eventType === 'OFF';
    const isGtr = entry.eventType === 'GTR';
    const isLayover = entry.eventType === 'LAYOVER';
    const isLeave = isLeaveEntry(entry);

    // Filtering
    if (isDH && settings.excludeDeadhead) continue;
    if (isStandby && settings.excludeStandby) continue;
    if (isDayOff && settings.excludeDayOff) continue;
    if (isLayover && settings.excludeLayover) continue;

    if (isGtr) {
      const taskLower = (entry.rawTask || '').toLowerCase();
      const isSim = taskLower.includes('sim') || taskLower.includes('simulator') || (entry.eventType as string) === 'SIMULATOR';
      const isReportEvent = taskLower.includes('report') || taskLower.includes('firma') || taskLower.includes('present');
      const isDebriefEvent = taskLower.includes('debrief');

      if (isSim && settings.excludeSimulator) continue;
      if (isReportEvent && settings.excludeReport) continue;
      if (isDebriefEvent && settings.excludeDebrief) continue;
    }

    if (isFlight) {
      const legs = entry.legs || [];
      if (legs.length === 0) continue;

      if (settings.aggregateFlights) {
        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];
        if (!firstLeg.departureTimeUtc || !lastLeg.arrivalTimeUtc) continue;

        const suffix = isDH ? ' (DH)' : '';
        const flightNumbers = legs.map(l => l.flightNumber).join('-');

        let summary = '';
        if (settings.flightTitleFormat === 'route_flight') {
          summary = `${firstLeg.origin} - ${lastLeg.destination} / ${flightNumbers}${suffix}`;
        } else if (settings.flightTitleFormat === 'flight_route') {
          summary = `${flightNumbers} / ${firstLeg.origin} - ${lastLeg.destination}${suffix}`;
        } else {
          summary = `${flightNumbers}${suffix}`;
        }

        let location = '';
        if (settings.flightLocationFormat === 'times_flight') {
          location = `${firstLeg.departureTimeLoc || ''} - ${lastLeg.arrivalTimeLoc || ''}`;
        } else if (settings.flightLocationFormat === 'route_only') {
          location = `${firstLeg.origin} - ${lastLeg.destination}`;
        } else {
          location = `${firstLeg.origin || ''} / ${lastLeg.destination || ''}`;
        }

        const descParts: string[] = [];
        legs.forEach((leg, idx) => {
          descParts.push(`--- Tramo ${idx + 1}: ${leg.origin} - ${leg.destination} (${leg.flightNumber}) ---`);
          if (leg.reportTimeLoc && !settings.excludeReport) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          descParts.push(
            `Salida: ${leg.departureTimeLoc || ''} local`,
            `Llegada: ${leg.arrivalTimeLoc || ''} local`,
            `Block: ${leg.blockTime || ''}`
          );
          const crew = formatCrewForLeg(leg);
          if (crew) {
            descParts.push(`Tripulación:\n${crew}`);
          }
          if (leg.remarks?.trim()) {
            descParts.push(`Remarks: ${leg.remarks.trim()}`);
          }
        });

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:arms-${entry.dateISO}-aggregate@flightlog`);
        lines.push(`DTSTAMP:${now}`);
        lines.push(`DTSTART:${toICSDatetime(entry.dateISO, firstLeg.departureTimeUtc)}`);
        const dtEnd = settings.postFlightMinutes > 0
          ? addMinutesToUtcTime(entry.dateISO, lastLeg.arrivalTimeUtc || '', settings.postFlightMinutes)
          : toICSDatetime(entry.dateISO, lastLeg.arrivalTimeUtc);
        lines.push(`DTEND:${dtEnd}`);
        lines.push(`SUMMARY:${escapeICS(summary)}`);
        lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
        lines.push(`LOCATION:${escapeICS(location)}`);
        lines.push('END:VEVENT');

      } else {
        legs.forEach((leg, idx) => {
          if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) return;

          const suffix = isDH ? ' (DH)' : '';
          let summary = '';
          if (settings.flightTitleFormat === 'route_flight') {
            summary = `${leg.origin} - ${leg.destination} / ${leg.flightNumber}${suffix}`;
          } else if (settings.flightTitleFormat === 'flight_route') {
            summary = `${leg.flightNumber} / ${leg.origin} - ${leg.destination}${suffix}`;
          } else {
            summary = `${leg.flightNumber}${suffix}`;
          }

          let location = '';
          if (settings.flightLocationFormat === 'times_flight') {
            location = `${leg.departureTimeLoc || ''} - ${leg.arrivalTimeLoc || ''}`;
          } else if (settings.flightLocationFormat === 'route_only') {
            location = `${leg.origin} - ${leg.destination}`;
          } else {
            location = `${leg.origin || ''} / ${leg.destination || ''}`;
          }

          const descParts: string[] = [
            `Vuelo: ${leg.flightNumber}${suffix}`,
            `Ruta: ${leg.origin} - ${leg.destination}`
          ];
          if (leg.reportTimeLoc && !settings.excludeReport) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          descParts.push(
            `Salida: ${leg.departureTimeLoc || ''} local`,
            `Llegada: ${leg.arrivalTimeLoc || ''} local`,
            `Block: ${leg.blockTime || ''}`
          );
          const crew = formatCrewForLeg(leg);
          if (crew) {
            descParts.push(`Tripulación:\n${crew}`);
          }
          if (leg.remarks?.trim()) {
            descParts.push(`Remarks: ${leg.remarks.trim()}`);
          }

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:arms-${entry.dateISO}-${leg.flightNumber}-${idx}@flightlog`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART:${toICSDatetime(entry.dateISO, leg.departureTimeUtc)}`);
          const isLastLeg = idx === legs.length - 1;
          const dtEnd = (isLastLeg && settings.postFlightMinutes > 0)
            ? addMinutesToUtcTime(entry.dateISO, leg.arrivalTimeUtc || '', settings.postFlightMinutes)
            : toICSDatetime(entry.dateISO, leg.arrivalTimeUtc);
          lines.push(`DTEND:${dtEnd}`);
          lines.push(`SUMMARY:${escapeICS(summary)}`);
          lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
          lines.push(`LOCATION:${escapeICS(location)}`);
          lines.push('END:VEVENT');
        });
      }
    } else if (isStandby) {
      const uid = `arms-${entry.dateISO}-standby@flightlog`;
      let title = settings.reportTitleFormat === 'type_only' ? 'Guardia' : `Guardia (STB) - ${entry.rawTask || ''}`;
      let description = settings.reportDescriptionFormat === 'crew_info' ? (entry.rawTask || 'Guardia de Roster') : '';
      let location = settings.reportLocationFormat === 'time_utc' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      if (entry.startTimeUtc && entry.endTimeUtc) {
        lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
        lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
        lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      }
      lines.push(`SUMMARY:${escapeICS(title)}`);
      if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
      if (location) lines.push(`LOCATION:${escapeICS(location)}`);
      lines.push('END:VEVENT');
    } else if (isGtr) {
      const uid = `arms-${entry.dateISO}-gtr@flightlog`;
      const isSim = (entry.rawTask || '').toLowerCase().includes('sim') || (entry.eventType as string) === 'SIMULATOR';
      let title = isSim
        ? (settings.reportTitleFormat === 'type_only' ? 'Simulador' : `Simulador - ${entry.rawTask || ''}`)
        : (settings.reportTitleFormat === 'type_only' ? 'Curso' : `GTR - ${entry.rawTask || 'Entrenamiento Terrestre'}`);
      let description = settings.reportDescriptionFormat === 'crew_info' ? (entry.rawTask || '') : '';
      let location = settings.reportLocationFormat === 'time_utc' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      if (entry.startTimeUtc && entry.endTimeUtc) {
        lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
        lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
        lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      }
      lines.push(`SUMMARY:${escapeICS(title)}`);
      if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
      if (location) lines.push(`LOCATION:${escapeICS(location)}`);
      lines.push('END:VEVENT');
    } else if (isLayover) {
      const uid = `arms-${entry.dateISO}-layover-${entry.layoverAirport || 'NA'}@flightlog`;
      let title = `Escala - ${entry.layoverAirport || ''}`;
      let description = `Duración en destino: ${entry.layoverDuration || ''}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);

      if (settings.layover30MinOnly) {
        const startUtc = "12:00";
        const endUtc = "12:30";
        lines.push(`DTSTART:${toICSDatetime(entry.dateISO, startUtc)}`);
        lines.push(`DTEND:${toICSDatetime(entry.dateISO, endUtc)}`);
      } else {
        lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
        lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      }

      lines.push(`SUMMARY:${escapeICS(title)}`);
      lines.push(`DESCRIPTION:${escapeICS(description)}`);
      lines.push('END:VEVENT');
    } else if (isDayOff) {
      const uid = `arms-${entry.dateISO}-off@flightlog`;
      let title = settings.reportTitleFormat === 'type_only' ? 'Libre' : 'Libre (OFF)';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      lines.push('END:VEVENT');
    } else if (isLeave || entry.eventType === 'NDA') {
      const uid = `arms-${entry.dateISO}-nda@flightlog`;
      let title = isLeave ? `Licencia: ${entry.rawTask || ''}` : `Actividad (NDA) - ${entry.rawTask || ''}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
      lines.push('END:VEVENT');
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
