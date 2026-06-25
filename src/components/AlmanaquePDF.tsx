import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import type { ArmsDayEntry, ArmsFlightLeg } from '../types';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const COL_WIDTH = '14.28%';

const ACCENT_BLUE = '#1152d4';
const BORDER_COLOR = '#cbd5e1';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = '#64748b';
const WEEKEND_BG = '#f8fafc';
const CELL_HEIGHT = 65;

const styles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: '#fff',
    fontFamily: 'Helvetica',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: ACCENT_BLUE,
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerTitle: {
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: TEXT_MUTED,
    fontSize: 9,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    width: COL_WIDTH,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginHorizontal: 1,
  },
  dayHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#334155',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayCell: {
    width: COL_WIDTH,
    minHeight: CELL_HEIGHT,
    padding: 4,
    borderWidth: 0.5,
    borderColor: BORDER_COLOR,
    borderRadius: 4,
    marginHorizontal: 1,
    backgroundColor: '#ffffff',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  dayCellEmpty: {
    width: COL_WIDTH,
    minHeight: CELL_HEIGHT,
    backgroundColor: '#f8fafc',
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    marginHorizontal: 1,
    opacity: 0.4,
  },
  dayCellWeekend: {
    backgroundColor: WEEKEND_BG,
    borderColor: '#cbd5e1',
  },
  dayNumRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  dayNumText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
  },
  eventContent: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    marginTop: 2,
  },
  lineBold: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.3,
    color: TEXT_DARK,
  },
  lineNormal: {
    fontSize: 7.5,
    lineHeight: 1.3,
    color: '#334155',
  },
  lineSmall: {
    fontSize: 6.5,
    lineHeight: 1.25,
    color: TEXT_MUTED,
  },
  lineOff: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.3,
    color: '#10b981', // green for OFF
  },
  lineLeave: {
    fontSize: 8,
    fontWeight: 'bold',
    lineHeight: 1.3,
    color: '#ef4444', // red for LEAVE
  },
  lineSpacer: {
    height: 2,
  },
  footer: {
    marginTop: 15,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7.5,
    color: TEXT_MUTED,
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
  styleType?: 'bold' | 'normal' | 'small' | 'off' | 'leave';
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
      const isCompact = entry.legs.length > 2;

      if (isCompact && entry.legs[0]?.reportTimeLoc) {
        lines.push({ text: `Pres: ${entry.legs[0].reportTimeLoc}`, styleType: 'small' });
      }

      for (let i = 0; i < entry.legs.length; i++) {
        const leg = entry.legs[i];
        const prefix = isDH ? '(DH) ' : '';
        if (isCompact) {
          lines.push({ 
            text: `${leg.origin}-${leg.destination} ${leg.departureTimeLoc}-${leg.arrivalTimeLoc} ${prefix}${leg.flightNumber}`, 
            styleType: 'small' 
          });
        } else {
          if (i > 0) lines.push({ text: '' });
          lines.push({ text: `${leg.origin}-${leg.destination}`, styleType: 'bold' });
          if (i === 0 && leg.reportTimeLoc) {
            lines.push({ text: `Pres: ${leg.reportTimeLoc}`, styleType: 'small' });
          }
          lines.push({ text: `${leg.departureTimeLoc}-${leg.arrivalTimeLoc} ${prefix}${leg.flightNumber}`, styleType: 'small' });
        }
      }
      return lines;
    }
    case 'STANDBY': {
      const raw = (entry.rawTask || '').trim();
      const from = (entry.startTimeLoc || '').trim();
      const to = (entry.endTimeLoc || '').trim();
      const lines: EventLine[] = [{ text: 'Guardia', styleType: 'bold' }];
      if (from && to) lines.push({ text: `${from} - ${to}`, styleType: 'small' });
      else if (from) lines.push({ text: `Desde: ${from}`, styleType: 'small' });
      else if (to) lines.push({ text: `Hasta: ${to}`, styleType: 'small' });
      if (raw && from && to) lines.push({ text: raw, styleType: 'small' });
      else if (raw && !from && !to) lines.push({ text: raw, styleType: 'small' });
      return lines;
    }
    case 'GTR': {
      const raw = (entry.rawTask || '').trim();
      const times = `${entry.startTimeLoc || ''} ${entry.endTimeLoc || ''}`.trim();
      const lines: EventLine[] = [{ text: 'Curso / GTR', styleType: 'bold' }];
      if (raw && times) lines.push({ text: `${times} ${raw}`, styleType: 'small' });
      else if (raw) lines.push({ text: raw, styleType: 'small' });
      else if (times) lines.push({ text: times, styleType: 'small' });
      return lines;
    }
    case 'LAYOVER': {
      const lines: EventLine[] = [{ text: `Layover ${entry.layoverAirport || ''}`, styleType: 'bold' }];
      if (entry.layoverDuration) lines.push({ text: entry.layoverDuration, styleType: 'small' });
      return lines;
    }
    case 'OFF':
      return [{ text: 'DÍA LIBRE (OFF)', styleType: 'off' }];
    case 'LEAVE':
      return [{ text: entry.rawTask || 'Licencia', styleType: 'leave' }];
    case 'NDA':
      return [{ text: 'NDA', styleType: 'bold' }];
    default:
      return [{ text: entry.rawTask || '', styleType: 'normal' }];
  }
}

function CalendarDay({
  cell,
  isWeekend,
  isEmpty,
}: {
  cell: CalendarCell;
  isWeekend: boolean;
  isEmpty: boolean;
  key?: string;
}) {
  if (isEmpty || cell.dayNumber === null) {
    return <View style={styles.dayCellEmpty} />;
  }

  const hasEntry = !!cell.entry;
  const lines = cell.entry ? getEntryLines(cell.entry) : [];

  return (
    <View style={[
      styles.dayCell,
      isWeekend && styles.dayCellWeekend,
      hasEntry && cell.entry?.eventType === 'OFF' && { backgroundColor: '#f0fdf4', borderColor: '#a7f3d0' },
      hasEntry && cell.entry?.eventType === 'LEAVE' && { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
    ]}>
      {/* Nro del Día */}
      <View style={styles.dayNumRow}>
        <Text style={[
          styles.dayNumText,
          hasEntry && cell.entry?.eventType === 'OFF' && { color: '#047857' },
          hasEntry && cell.entry?.eventType === 'LEAVE' && { color: '#b91c1c' }
        ]}>
          {cell.dayNumber}
        </Text>
      </View>

      {/* Contenido / Evento */}
      <View style={styles.eventContent}>
        {lines.map((line, i) => {
          if (!line.text) {
            return <View key={i} style={styles.lineSpacer} />;
          }
          
          let textStyle = styles.lineNormal;
          if (line.styleType === 'bold') textStyle = styles.lineBold;
          else if (line.styleType === 'small') textStyle = styles.lineSmall;
          else if (line.styleType === 'off') textStyle = styles.lineOff;
          else if (line.styleType === 'leave') textStyle = styles.lineLeave;

          return (
            <Text key={i} style={textStyle} numberOfLines={1}>
              {line.text}
            </Text>
          );
        })}
      </View>
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
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>
            {monthName} {year}
          </Text>
          <Text style={styles.headerSubtitle}>
            {userName ? `Tripulante: ${userName}  |  ` : ''}Roster Mensual ARMS
          </Text>
        </View>

        {/* Nombres de los Días */}
        <View style={styles.dayHeaderRow}>
          {DAYS_LABEL.map(d => (
            <View key={d} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grilla del Calendario */}
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((cell, ci) => (
              <CalendarDay
                key={`c-${wi}-${ci}`}
                cell={cell}
                isWeekend={ci >= 5}
                isEmpty={cell.dayNumber === null}
              />
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Zona horaria: America/Argentina/Buenos_Aires</Text>
          <Text style={styles.footerText}>Generado por Personal Flight Log • Verifique con su programación oficial</Text>
        </View>
      </Page>
    </Document>
  );
}
