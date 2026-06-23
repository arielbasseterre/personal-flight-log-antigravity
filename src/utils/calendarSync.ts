import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import type { ArmsDayEntry, ArmsFlightLeg } from '../types';

const CALENDAR_NAME = 'gringosoft roster';
const EVENT_TITLE_PREFIX = '[FL]';

function toUTC(dateISO: string, timeUTC: string | undefined): number {
  if (!timeUTC) return Date.now();
  const [h, m] = timeUTC.split(':');
  return Date.UTC(
    parseInt(dateISO.slice(0, 4)),
    parseInt(dateISO.slice(5, 7)) - 1,
    parseInt(dateISO.slice(8, 10)),
    parseInt(h),
    parseInt(m),
  );
}

const ROLE_LABELS: Record<string, string> = {
  CPT: 'Comandante', FO: 'Primer Oficial',
  CC: 'Jefe de Cabina', PU: 'Tripulante',
};

function formatCrewText(leg: ArmsFlightLeg): string {
  if (!leg.crewComplement?.length) return '';
  return leg.crewComplement
    .map(m => `  - ${m.name} (${ROLE_LABELS[m.role] || m.role})`)
    .join('\n');
}

function buildEvents(entries: ArmsDayEntry[]): Array<{
  title: string;
  location: string;
  notes: string;
  startDate: number;
  endDate: number;
}> {
  const events: Array<{
    title: string;
    location: string;
    notes: string;
    startDate: number;
    endDate: number;
  }> = [];

  for (const entry of entries) {
    switch (entry.eventType) {
      case 'FLIGHT_OP':
      case 'FLIGHT_DH': {
        const isDH = entry.eventType === 'FLIGHT_DH';
        const suffix = isDH ? ' (DH)' : '';
        for (let i = 0; i < entry.legs.length; i++) {
          const leg = entry.legs[i];
          if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) continue;

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

          const crew = formatCrewText(leg);
          if (crew) descParts.push(`Tripulación:\n${crew}`);
          if (leg.remarks?.trim()) descParts.push(`Remarks: ${leg.remarks.trim()}`);

          events.push({
            title: `${leg.origin} - ${leg.destination} / ${leg.flightNumber}${suffix}`,
            location: `${leg.origin} - ${leg.destination}`,
            notes: descParts.join('\n'),
            startDate: toUTC(entry.dateISO, leg.departureTimeUtc),
            endDate: toUTC(entry.dateISO, leg.arrivalTimeUtc),
          });
        }
        break;
      }
      case 'STANDBY': {
        events.push({
          title: 'Guardia',
          location: '',
          notes: 'Guardia',
          startDate: toUTC(entry.dateISO, entry.startTimeUtc || '00:00'),
          endDate: toUTC(entry.dateISO, entry.endTimeUtc || '23:59'),
        });
        break;
      }
      case 'GTR': {
        events.push({
          title: 'Entrenamiento',
          location: '',
          notes: `Ground Training Recurrent\n${entry.rawTask || ''}`.trimEnd(),
          startDate: toUTC(entry.dateISO, entry.startTimeUtc || '00:00'),
          endDate: toUTC(entry.dateISO, entry.endTimeUtc || '23:59'),
        });
        break;
      }
    }
  }

  return events;
}

export async function syncRosterToCalendar(
  entries: ArmsDayEntry[],
  month: number,
  year: number,
): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, count: 0, error: 'native_only' };
  }

  try {
    const permResult = await CapacitorCalendar.requestFullCalendarAccess();
    if (permResult.result !== 'granted') {
      return { ok: false, count: 0, error: 'Permiso de calendario denegado. Activá el acceso en Configuración.' };
    }

    let calendarId: string | null = null;
    const { result: calendars } = await CapacitorCalendar.listCalendars();
    const existing = calendars.find(c => c.title === CALENDAR_NAME);
    if (existing) {
      calendarId = existing.id;
    } else {
      try {
        const { result: newId } = await CapacitorCalendar.createCalendar({
          title: CALENDAR_NAME,
          color: '#1152d4',
        });
        calendarId = newId;
      } catch {
        const { result: defaultCal } = await CapacitorCalendar.getDefaultCalendar();
        calendarId = defaultCal?.id ?? null;
      }
    }

    if (!calendarId) {
      return { ok: false, count: 0, error: 'No se pudo obtener o crear el calendario.' };
    }

    const monthStart = Date.UTC(year, month - 1, 1);
    const monthEnd = Date.UTC(year, month, 0, 23, 59, 59, 999);

    const { result: existingEvents } = await CapacitorCalendar.listEventsInRange({
      startDate: monthStart,
      endDate: monthEnd,
    });

    const oldEventIds = existingEvents
      .filter(e => e.calendarId === calendarId && e.title?.startsWith(EVENT_TITLE_PREFIX))
      .map(e => e.id);

    if (oldEventIds.length > 0) {
      await CapacitorCalendar.deleteEventsById({ ids: oldEventIds });
    }

    const newEvents = buildEvents(entries);
    let createdCount = 0;
    for (const ev of newEvents) {
      try {
        await CapacitorCalendar.createEvent({
          title: `${EVENT_TITLE_PREFIX} ${ev.title}`,
          calendarId,
          location: ev.location,
          notes: ev.notes,
          startDate: ev.startDate,
          endDate: ev.endDate,
        });
        createdCount++;
      } catch {
        continue;
      }
    }

    return { ok: true, count: createdCount };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, count: 0, error: msg };
  }
}
