import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ArmsDayEntry, ArmsFlightLeg } from '../types';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const COL_WIDTH = '14.28%';

const BLUE = '#1a5fb4';
const WEEKEND_BG = '#f7f7f7';

const DEFAULT_EVENT_H = 54;

const styles = StyleSheet.create({
  page: {
    padding: 18,
    backgroundColor: '#fff',
    fontFamily: 'Helvetica',
  },
  headerBar: {
    backgroundColor: BLUE,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 3,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  dayHeaderCell: {
    width: COL_WIDTH,
    paddingVertical: 5,
    paddingHorizontal: 3,
    backgroundColor: '#f0f0f0',
    borderWidth: 0.5,
    borderColor: '#bbb',
  },
  dayHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayNumCell: {
    width: COL_WIDTH,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderWidth: 0.5,
    borderColor: '#bbb',
    borderBottomWidth: 0,
  },
  dayNumCellEmpty: {
    width: COL_WIDTH,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderBottomWidth: 0,
    backgroundColor: '#fafafa',
  },
  dayNumText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  dayNumTextGray: {
    fontSize: 9,
    color: '#ccc',
  },
  eventCell: {
    width: COL_WIDTH,
    padding: 3,
    borderWidth: 0.5,
    borderColor: '#bbb',
    minHeight: DEFAULT_EVENT_H,
  },
  eventCellEmpty: {
    width: COL_WIDTH,
    padding: 3,
    borderWidth: 0.5,
    borderColor: '#ddd',
    minHeight: DEFAULT_EVENT_H,
    backgroundColor: '#fafafa',
  },
  eventCellWeekend: {
    width: COL_WIDTH,
    padding: 3,
    borderWidth: 0.5,
    borderColor: '#ddd',
    minHeight: DEFAULT_EVENT_H,
    backgroundColor: WEEKEND_BG,
  },
  lineBold: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.5,
    color: '#111',
  },
  lineNormal: {
    fontSize: 8,
    lineHeight: 1.5,
    color: '#222',
  },
  lineSmall: {
    fontSize: 7,
    lineHeight: 1.4,
    color: '#555',
  },
  lineOff: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.5,
    color: '#999',
  },
  lineSpacer: {
    fontSize: 5,
    lineHeight: 1.2,
    color: '#eee',
  },
  footer: {
    marginTop: 10,
    paddingTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: '#bbb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#888',
  },
});

interface CalendarCell {
  dayNumber: number | null;
  entry: ArmsDayEntry | null;
}

interface EventLine {
  text: string;
  bold?: boolean;
  small?: boolean;
}

function buildMonthGrid(
  entries: ArmsDayEntry[],
  month: number,
  year: number
): CalendarCell[][] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  let startCol = firstDay.getDay() - 1;
  if (startCol < 0) startCol = 6;

  const totalCells = Math.ceil((startCol + daysInMonth) / 7) * 7;
  const flat: CalendarCell[] = [];

  for (let i = 0; i < totalCells; i++) {
    if (i >= startCol && i < startCol + daysInMonth) {
      const day = i - startCol + 1;
      const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const entry = entries.find(e => e.dateISO === dateISO) || null;
      flat.push({ dayNumber: day, entry });
    } else {
      flat.push({ dayNumber: null, entry: null });
    }
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    weeks.push(flat.slice(i, i + 7));
  }
  return weeks;
}

function getEntryLines(entry: ArmsDayEntry): EventLine[] {
  switch (entry.eventType) {
    case 'FLIGHT_OP':
    case 'FLIGHT_DH': {
      const lines: EventLine[] = [];
      const isDH = entry.eventType === 'FLIGHT_DH';
      for (let i = 0; i < entry.legs.length; i++) {
        const leg = entry.legs[i];
        if (i > 0) lines.push({ text: '' });
        const prefix = isDH ? '(DH) ' : '';
        lines.push({ text: `${leg.origin}-${leg.destination}`, bold: true });
        if (i === 0 && leg.reportTimeLoc) {
          lines.push({ text: `Presentación: ${leg.reportTimeLoc}`, small: true });
        }
        lines.push({ text: `${leg.departureTimeLoc}-${leg.arrivalTimeLoc} ${prefix}${leg.flightNumber}`, small: true });
      }
      return lines;
    }
    case 'STANDBY': {
      const raw = (entry.rawTask || '').trim();
      const from = (entry.startTimeLoc || '').trim();
      const to = (entry.endTimeLoc || '').trim();
      const lines: EventLine[] = [{ text: 'Guardia', bold: true }];
      if (from && to) lines.push({ text: `${from} - ${to}`, small: true });
      else if (from) lines.push({ text: `Desde: ${from}`, small: true });
      else if (to) lines.push({ text: `Hasta: ${to}`, small: true });
      if (raw && from && to) lines.push({ text: raw, small: true });
      else if (raw && !from && !to) lines.push({ text: raw, small: true });
      return lines;
    }
    case 'GTR': {
      const raw = (entry.rawTask || '').trim();
      const times = `${entry.startTimeLoc || ''} ${entry.endTimeLoc || ''}`.trim();
      const lines: EventLine[] = [{ text: 'GTR', bold: true }];
      if (raw && times) lines.push({ text: `${times} ${raw}`, small: true });
      else if (raw) lines.push({ text: raw, small: true });
      else if (times) lines.push({ text: times, small: true });
      return lines;
    }
    case 'LAYOVER': {
      const lines: EventLine[] = [{ text: `Escala ${entry.layoverAirport || ''}`, bold: true }];
      if (entry.layoverDuration) lines.push({ text: entry.layoverDuration, small: true });
      return lines;
    }
    case 'OFF':
      return [{ text: 'OFF', bold: true }];
    case 'LEAVE':
      return [{ text: entry.rawTask || 'Licencia', bold: true }];
    case 'NDA':
      return [{ text: 'NDA', bold: true }];
    default:
      return [{ text: entry.rawTask || '' }];
  }
}

function DayNumCell({
  cell,
  isWeekend,
  isEmpty,
}: {
  cell: CalendarCell;
  isWeekend: boolean;
  isEmpty: boolean;
}) {
  if (isEmpty || cell.dayNumber === null) {
    return <View style={styles.dayNumCellEmpty}><Text style={styles.dayNumTextGray}>{' '}</Text></View>;
  }
  return (
    <View style={[styles.dayNumCell, isWeekend && { backgroundColor: WEEKEND_BG }]}>
      <Text style={styles.dayNumText}>{cell.dayNumber}</Text>
    </View>
  );
}

function EventCell({
  cell,
  isEmpty,
  isWeekend,
}: {
  cell: CalendarCell;
  isEmpty: boolean;
  isWeekend: boolean;
}) {
  if (isEmpty || cell.dayNumber === null) {
    return <View style={styles.eventCellEmpty}><Text>{' '}</Text></View>;
  }

  if (!cell.entry) {
    const cellStyle = isWeekend ? styles.eventCellWeekend : { ...styles.eventCell, borderColor: '#ddd' };
    return <View style={cellStyle}><Text>{' '}</Text></View>;
  }

  const lines = getEntryLines(cell.entry);
  const isOff = cell.entry.eventType === 'OFF' || cell.entry.eventType === 'LEAVE';

  return (
    <View style={[styles.eventCell, isWeekend && { backgroundColor: WEEKEND_BG }]}>
      {lines.map((line, i) => {
        if (!line.text) {
          return <Text key={i} style={styles.lineSpacer}>{' '}</Text>;
        }
        const textStyle = isOff
          ? styles.lineOff
          : line.bold
          ? styles.lineBold
          : line.small
          ? styles.lineSmall
          : styles.lineNormal;
        return <Text key={i} style={textStyle}>{line.text}</Text>;
      })}
    </View>
  );
}

export function AlmanaquePDF({
  entries,
  month,
  year,
  userName,
}: {
  entries: ArmsDayEntry[];
  month: number;
  year: number;
  userName?: string;
}) {
  const weeks = buildMonthGrid(entries, month, year);
  const monthName = MONTHS[month - 1] || '';

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>
            {monthName} {year}{userName ? ` — ${userName}` : ''}
          </Text>
        </View>

        <View style={styles.dayHeaderRow}>
          {DAYS_LABEL.map(d => (
            <View key={d} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi}>
            <View style={styles.weekRow}>
              {week.map((cell, ci) => (
                <DayNumCell
                  key={`n-${wi}-${ci}`}
                  cell={cell}
                  isWeekend={ci >= 5}
                  isEmpty={cell.dayNumber === null}
                />
              ))}
            </View>
            <View style={styles.weekRow}>
              {week.map((cell, ci) => (
                <EventCell
                  key={`e-${wi}-${ci}`}
                  cell={cell}
                  isWeekend={ci >= 5}
                  isEmpty={cell.dayNumber === null}
                />
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Zona horaria: America/Argentina/Buenos_Aires</Text>
          <Text style={styles.footerText}>Roster ARMS — Verifique con su roster oficial</Text>
        </View>
      </Page>
    </Document>
  );
}
