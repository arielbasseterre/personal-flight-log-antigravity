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

function adjustLocalTime(timeStr: string, minutes: number): string {
  if (!timeStr || minutes <= 0) return timeStr;
  const cleaned = timeStr.replace(':', '');
  if (cleaned.length < 4) return timeStr;
  const h = parseInt(cleaned.substring(0, 2), 10);
  const m = parseInt(cleaned.substring(2, 4), 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const totalMinutes = (h * 60 + m + minutes) % 1440;
  const nh = Math.floor(totalMinutes / 60);
  const nm = totalMinutes % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

function toFloatingDatetime(dateISO: string, timeLoc: string): string {
  if (!timeLoc) return '';
  const cleaned = timeLoc.replace(':', '');
  return `${dateISO.replace(/-/g, '')}T${cleaned.substring(0, 4)}00`;
}

function addDays(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().substring(0, 10);
}

function getUtcForLoc(leg: ArmsFlightLeg, locTime: string): string {
  if (locTime && locTime === leg.reportTimeLoc && leg.reportTimeUtc) return leg.reportTimeUtc;
  if (locTime && locTime === leg.departureTimeLoc && leg.departureTimeUtc) return leg.departureTimeUtc;
  // Si reportTimeUtc falta, estimarlo desde el offset del departure
  if (locTime && leg.departureTimeLoc && leg.departureTimeUtc) {
    const offset = (timeToMinutes(leg.departureTimeUtc) - timeToMinutes(leg.departureTimeLoc) + 1440) % 1440;
    const utcMin = (timeToMinutes(locTime) + offset + 1440) % 1440;
    return `${String(Math.floor(utcMin / 60)).padStart(2, '0')}:${String(utcMin % 60).padStart(2, '0')}`;
  }
  return leg.departureTimeUtc || locTime;
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
    excludeStandby: false,
    excludeDayOff: false,
    excludeLayover: false,
    excludeLeave: false,
    excludeNDA: false,
    excludeGTR: false,
    excludeOTH: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    excludeCrew: false,
    flightEventFormat: "route_flight_times",
    reportEventFormat: "type_info",
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
    const isNDA = entry.eventType === 'NDA';
    const isOther = entry.eventType === 'UNKNOWN';

    // Filtering
    if (isStandby && settings.excludeStandby) continue;
    if (isDayOff && settings.excludeDayOff) continue;
    if (isLayover && settings.excludeLayover) continue;
    if (isLeave && settings.excludeLeave) continue;
    if (isNDA && settings.excludeNDA) continue;
    if (isOther && settings.excludeOTH) continue;
    if (isGtr && settings.excludeGTR) continue;

    if (isFlight) {
      const legs = entry.legs || [];
      if (legs.length === 0) continue;

      if (settings.aggregateFlights) {
        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];
        if (!firstLeg.departureTimeUtc || !lastLeg.arrivalTimeUtc) continue;

        const suffix = isDH ? ' (DH)' : '';
        const flightNumbers = legs.map(l => l.flightNumber).join('-');

        const routeStr = [...legs.map(l => l.origin), lastLeg.destination].join('-');

        let summary = '';
        const location = '';
        if (settings.flightEventFormat === 'route_flight_times') {
          summary = `${routeStr} / ${flightNumbers}${suffix}`;
        } else if (settings.flightEventFormat === 'flight_route_times') {
          summary = `${flightNumbers} / ${routeStr}${suffix}`;
        } else if (settings.flightEventFormat === 'route_times') {
          summary = `${routeStr}${suffix}`;
        } else {
          summary = `${flightNumbers}${suffix}`;
        }
        summary = `✈️ ${summary}`;

        const descParts: string[] = [];
        legs.forEach((leg, idx) => {
          const isLastLeg = idx === legs.length - 1;
          descParts.push(`--- Tramo ${idx + 1}: ${leg.origin} - ${leg.destination} (${leg.flightNumber}) ---`);
          if (leg.reportTimeLoc) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          const depLoc = leg.departureTimeLoc || '';
          const arrLoc = leg.arrivalTimeLoc || '';
          const adjArrLoc = isLastLeg && settings.postFlightMinutes > 0
            ? adjustLocalTime(arrLoc, settings.postFlightMinutes)
            : arrLoc;
          descParts.push(
            `Horario: ${leg.origin} ${depLoc} → ${leg.destination} ${adjArrLoc} local${isLastLeg && settings.postFlightMinutes > 0 ? ` (+${settings.postFlightMinutes} min)` : ''}`,
            `Block: ${leg.blockTime || ''}`
          );
          const crew = formatCrewForLeg(leg);
          if (crew && !settings.excludeCrew) {
            descParts.push(`Tripulación:\n${crew}`);
          }
          if (leg.remarks?.trim()) {
            descParts.push(`Remarks: ${leg.remarks.trim()}`);
          }
        });

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:arms-${entry.dateISO}-aggregate@flightlog`);
        lines.push(`DTSTAMP:${now}`);
        const startLoc = firstLeg.reportTimeLoc || firstLeg.departureTimeLoc;
        const startUtc = getUtcForLoc(firstLeg, startLoc);
        const startDayShift = timeToMinutes(startUtc) < timeToMinutes(startLoc) ? 1 : 0;
        const dtStartDate = addDays(entry.dateISO, startDayShift);

        const adjArrUtc = settings.postFlightMinutes > 0
          ? adjustLocalTime(lastLeg.arrivalTimeUtc, settings.postFlightMinutes)
          : lastLeg.arrivalTimeUtc;
        const arrDayShift = timeToMinutes(adjArrUtc) < timeToMinutes(startUtc) ? 1 : 0;
        const dtEndDate = addDays(dtStartDate, arrDayShift);

        lines.push(`DTSTART:${toICSDatetime(dtStartDate, startUtc)}`);
        lines.push(`DTEND:${toICSDatetime(dtEndDate, adjArrUtc)}`);
        lines.push(`SUMMARY:${escapeICS(summary)}`);
        lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
        lines.push(`LOCATION:${escapeICS(location)}`);
        lines.push('END:VEVENT');

      } else {
        legs.forEach((leg, idx) => {
          if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) return;

          const suffix = isDH ? ' (DH)' : '';
          const routeStr = `${leg.origin} - ${leg.destination}`;

          let summary = '';
          const location = '';
          if (settings.flightEventFormat === 'route_flight_times') {
            summary = `${routeStr} / ${leg.flightNumber}${suffix}`;
          } else if (settings.flightEventFormat === 'flight_route_times') {
            summary = `${leg.flightNumber} / ${routeStr}${suffix}`;
          } else if (settings.flightEventFormat === 'route_times') {
            summary = `${routeStr}${suffix}`;
          } else {
            summary = `${leg.flightNumber}${suffix}`;
          }
          summary = `✈️ ${summary}`;

          const descParts: string[] = [
            `Vuelo: ${leg.flightNumber}${suffix}`,
            `Ruta: ${leg.origin} - ${leg.destination}`
          ];
          if (leg.reportTimeLoc) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          const isLastLeg = idx === legs.length - 1;
          const depLoc = leg.departureTimeLoc || '';
          const arrLoc = leg.arrivalTimeLoc || '';
          const adjArrLoc = isLastLeg && settings.postFlightMinutes > 0
            ? adjustLocalTime(arrLoc, settings.postFlightMinutes)
            : arrLoc;
          descParts.push(
            `Horario: ${leg.origin} ${depLoc} → ${leg.destination} ${adjArrLoc} local${isLastLeg && settings.postFlightMinutes > 0 ? ` (+${settings.postFlightMinutes} min)` : ''}`,
            `Block: ${leg.blockTime || ''}`
          );
          const crew = formatCrewForLeg(leg);
          if (crew && !settings.excludeCrew) {
            descParts.push(`Tripulación:\n${crew}`);
          }
          if (leg.remarks?.trim()) {
            descParts.push(`Remarks: ${leg.remarks.trim()}`);
          }

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:arms-${entry.dateISO}-${leg.flightNumber}-${idx}@flightlog`);
          lines.push(`DTSTAMP:${now}`);
          const startLoc = leg.reportTimeLoc || leg.departureTimeLoc;
          const startUtc = getUtcForLoc(leg, startLoc);
          const startDayShift = timeToMinutes(startUtc) < timeToMinutes(startLoc) ? 1 : 0;
          const dtStartDate = addDays(entry.dateISO, startDayShift);

          const adjArrUtc = isLastLeg && settings.postFlightMinutes > 0
            ? adjustLocalTime(leg.arrivalTimeUtc, settings.postFlightMinutes)
            : leg.arrivalTimeUtc;
          const arrDayShift = timeToMinutes(adjArrUtc) < timeToMinutes(startUtc) ? 1 : 0;
          const dtEndDate = addDays(dtStartDate, arrDayShift);

          lines.push(`DTSTART:${toICSDatetime(dtStartDate, startUtc)}`);
          lines.push(`DTEND:${toICSDatetime(dtEndDate, adjArrUtc)}`);
          lines.push(`SUMMARY:${escapeICS(summary)}`);
          lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
          lines.push(`LOCATION:${escapeICS(location)}`);
          lines.push('END:VEVENT');
        });
      }
    } else if (isStandby) {
      const uid = `arms-${entry.dateISO}-standby@flightlog`;
      let title = settings.reportEventFormat === 'type_only' ? 'Guardia' : `Guardia (STB) - ${entry.rawTask || ''}`;
      let description = settings.reportEventFormat === 'type_info' ? (entry.rawTask || 'Guardia de Roster') : '';
      let location = settings.reportEventFormat === 'type_info' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

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
        ? (settings.reportEventFormat === 'type_only' ? 'Simulador' : `Simulador - ${entry.rawTask || ''}`)
        : (settings.reportEventFormat === 'type_only' ? 'Curso' : `GTR - ${entry.rawTask || 'Entrenamiento Terrestre'}`);
      let description = settings.reportEventFormat === 'type_info' ? (entry.rawTask || '') : '';
      let location = settings.reportEventFormat === 'type_info' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

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
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      lines.push(`DESCRIPTION:${escapeICS(description)}`);
      lines.push('END:VEVENT');
    } else if (isDayOff) {
      const uid = `arms-${entry.dateISO}-off@flightlog`;
      let title = settings.reportEventFormat === 'type_only' ? 'Libre' : 'Libre (OFF)';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      lines.push('END:VEVENT');
    } else if (isLeave) {
      const uid = `arms-${entry.dateISO}-leave@flightlog`;
      let title = `Licencia: ${entry.rawTask || ''}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
      lines.push('END:VEVENT');
    } else if (isNDA) {
      const uid = `arms-${entry.dateISO}-nda@flightlog`;
      let title = `Actividad (NDA) - ${entry.rawTask || ''}`;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
      lines.push(`SUMMARY:${escapeICS(title)}`);
      if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
      lines.push('END:VEVENT');
    } else if (isOther) {
      const uid = `arms-${entry.dateISO}-oth@flightlog`;
      let title = `Otro: ${entry.rawTask || ''}`;

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
