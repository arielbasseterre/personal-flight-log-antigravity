import React from 'react';
import { 
  Page, 
  Text, 
  View, 
  Document, 
  StyleSheet, 
  Font 
} from '@react-pdf/renderer';
import { FlightLog, Profile } from '@/src/types';

// OACI / ANAC 290/2012 Exact Format
const styles = StyleSheet.create({
  page: {
    padding: 30, // Increase padding to avoid bleed
    backgroundColor: '#fff',
    fontFamily: 'Helvetica',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#777',
  },
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    width: '100%',
    paddingHorizontal: 2,
    marginTop: 0, // Adjusted because of topBar
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  headerValue: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1.5,
    borderColor: '#000',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: '#000',
    minHeight: 14,
  },
  cell: {
    borderRightWidth: 0.5,
    borderColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 1,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  cellText: {
    fontSize: 6,
    textAlign: 'center',
    lineHeight: 1.2,
  },
  headerTitle: {
    fontSize: 6.5,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  verticalTextContainer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalText: {
    fontWeight: 'bold',
    transform: 'rotate(-90deg)',
    textAlign: 'center',
  },
  footer: {
    marginTop: 15,
    paddingHorizontal: 10,
    width: '100%',
  },
  footerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  footerText: {
    fontSize: 7,
    color: '#000',
  },
  footerNote: {
    fontSize: 6.5,
    marginTop: 4,
    width: 350,
    fontStyle: 'italic',
  },
  signatureSection: {
    marginTop: 20,
    alignItems: 'flex-end',
    width: '100%',
  },
  signatureBox: {
    width: 180,
    borderTopWidth: 1,
    borderColor: '#000',
    paddingTop: 5,
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 8,
    fontWeight: 'bold',
  }
});

interface Props {
  logs: FlightLog[];
  profile?: Profile;
}

const FLIGHT_PURPOSES = [
  { key: "47", value: "ACROBACIA", sigla: "ACR" },
  { key: "46", value: "ADAPTACIÓN", sigla: "ADAP" },
  { key: "61", value: "AEROPLICADOR", sigla: "AER" },
  { key: "62", value: "COMBATE CONTRA INCENDIOS DE BOSQUES Y CAMPOS", sigla: "CI" },
  { key: "63", value: "ENTRENAMIENTO", sigla: "ENT" },
  { key: "64", value: "EXAMEN", sigla: "EXA" },
  { key: "65", value: "VUELO EN FORMACIÓN", sigla: "FOR" },
  { key: "66", value: "FOTOGRAFÍA", sigla: "FOTO" },
  { key: "67", value: "INSTRUCTOR", sigla: "I" },
  { key: "68", value: "INSTRUCCIÓN", sigla: "INST" },
  { key: "69", value: "INSPECTOR", sigla: "IP" },
  { key: "70", value: "LANZAMIENTO DE PARACAIDISTAS", sigla: "LP" },
  { key: "71", value: "VUELO NO REGULAR", sigla: "N" },
  { key: "72", value: "PRUEBA DE AERONAVES", sigla: "PA" },
  { key: "73", value: "READAPTACIÓN", sigla: "READ" },
  { key: "74", value: "REMOLQUE DE PLANEADOR", sigla: "RP" },
  { key: "75", value: "SANITARIO", sigla: "SAN" },
  { key: "76", value: "TRABAJO AÉREO", sigla: "TA" },
  { key: "77", value: "VUELO OFICIAL", sigla: "VO" },
  { key: "78", value: "VUELO PRIVADO", sigla: "VP" },
  { key: "79", value: "LINEA AEREA", sigla: "LA" },
  { key: "80", value: "INSPECTOR (TCP)", sigla: "IP" },
  { key: "81", value: "TRIPULANTE DE CABINA DE PASAJEROS EN INSTRUCCION", sigla: "TCPI" }
];

export const FlightLogPDF = ({ logs, profile }: Props) => {
  // Sort logs by date ascending for the PDF (Chronological order)
  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.fechaHoraSalida).getTime();
    const dateB = new Date(b.fechaHoraSalida).getTime();
    
    if (dateA !== dateB) {
      return dateA - dateB;
    }
    
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const rowsPerPage = 15;
  const pages = [];
  
  for (let i = 0; i < sortedLogs.length; i += rowsPerPage) {
    pages.push(sortedLogs.slice(i, i + rowsPerPage));
  }

  // Column width definitions tuned for 35.5cm (1006pt) landscape
  const col = {
    dia: 20,
    mes: 20,
    salida: 35,
    desdeh: 110,
    llegada: 35,
    finalidad: 25,
    marca: 60,
    matr: 45,
    pot: 40,
    clase: 48,
    vueloP: 22, // individual pilot/copilot subcols
    vueloC: 22,
    aterr: 22,
    inst: 25,
    multi: 25,
    jet: 25,
    turb: 25,
    ag: 25,
    ifr: 22,
    sim: 25,
    cert: 165,
  };

  const renderHeader = () => {
    const bodyHeight = 45 + 12; // Combined height of sub-header rows

    // Column spans Row 2 + Row 3 with a horizontal divider at specific height
    const renderSplitColumn = (width: number, topText: string, bottomText: string = '', topHeight: number = 45, rightWidth: number = 0.5) => (
      <View style={{ width, flexDirection: 'column', borderRightWidth: rightWidth, borderColor: '#000' }}>
        <View style={[styles.cell, { width: '100%', height: topHeight, borderRightWidth: 0, paddingHorizontal: 1, borderBottomWidth: 0.5 }]}>
          <Text style={[styles.cellText, { fontSize: 5 }]}>{topText}</Text>
        </View>
        <View style={[styles.cell, { width: '100%', height: bodyHeight - topHeight, borderRightWidth: 0, borderBottomWidth: 0, paddingHorizontal: 1 }]}>
          <Text style={styles.cellText}>{bottomText}</Text>
        </View>
      </View>
    );

    // Column spans Row 2 + Row 3 without any internal horizontal line
    const renderDeepColumn = (width: number, label: string | string[], isVertical = true, fontSize = 5, rightWidth: number = 0.5) => (
      <View style={[styles.cell, { width, height: bodyHeight, borderRightWidth: rightWidth, borderColor: '#000', padding: 0 }]}>
        {isVertical ? (
          <View style={styles.verticalTextContainer}>
            <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: bodyHeight }}>
               {Array.isArray(label) ? label.map((line, idx) => (
                 <Text key={idx} style={{ fontSize, fontWeight: 'bold', textAlign: 'center' }}>{line}</Text>
               )) : (
                 <Text style={{ fontSize, fontWeight: 'bold', textAlign: 'center' }}>{label}</Text>
               )}
            </View>
          </View>
        ) : (
          <Text style={[styles.cellText, { fontSize, textAlign: 'center' }]}>{Array.isArray(label) ? label.join(' ') : label}</Text>
        )}
      </View>
    );

    return (
      <View fixed>
        {/* Row 1: Main Category Groups */}
        <View style={[styles.headerRow, { height: 25 }]}>
          <View style={[styles.cell, { width: col.dia + col.mes, borderRightWidth: 1.5 }]}>
            <Text style={styles.headerTitle}>AÑO{"\n"}{logs[0] ? new Date(logs[0].fechaHoraSalida).getUTCFullYear() : 2026}</Text>
          </View>
          <View style={[styles.cell, { width: col.salida + col.desdeh + col.llegada, borderRightWidth: 1.5 }]}><Text style={styles.headerTitle}>ITINERARIO</Text></View>
          <View style={[styles.cell, { width: col.finalidad, borderRightWidth: 1.5 }]}></View>
          <View style={[styles.cell, { width: col.marca + col.matr + col.pot + col.clase, borderRightWidth: 1.5 }]}><Text style={styles.headerTitle}>AERONAVES UTILIZADAS</Text></View>
          <View style={[styles.cell, { width: col.vueloP * 8, borderRightWidth: 1.5 }]}><Text style={styles.headerTitle}>TIEMPOS DE VUELO</Text></View>
          <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}></View>
          <View style={[styles.cell, { width: col.inst + col.multi + col.jet + col.turb + col.ag + (col.ifr * 3), borderRightWidth: 1.5 }]}><Text style={[styles.headerTitle, { fontSize: 6 }]}>DISCRIMINACION DE TIEMPOS DE VUELO</Text></View>
          <View style={[styles.cell, { width: col.sim * 2, borderRightWidth: 1.5 }]}><Text style={[styles.headerTitle, { fontSize: 4.5 }]}>ADIESTRADOR TERRESTRE / SIMULADOR</Text></View>
          <View style={[styles.cell, { width: col.cert, borderRightWidth: 0 }]}><Text style={styles.headerTitle}>CERTIFICACIONES</Text></View>
        </View>

        {/* Row 2/3 Body: Sub-headers as individual columns to allow spanning */}
        <View style={[styles.headerRow, { height: bodyHeight, borderBottomWidth: 1.5 }]}>
          {renderDeepColumn(col.dia, 'DIA', false, 6, 0.5)}
          {renderDeepColumn(col.mes, 'MES', false, 6, 1.5)}
          {renderSplitColumn(col.salida, 'HORA DE SALIDA UTC', '', 45, 0.5)}
          {renderSplitColumn(col.desdeh, 'DESDE - HASTA', '', 45, 0.5)}
          {renderSplitColumn(col.llegada, 'HORA DE LLEGADA UTC', '', 45, 1.5)}
          
          {renderDeepColumn(col.finalidad, ['FINALIDAD', 'DEL VUELO'], true, 5, 1.5)}
          
          {renderSplitColumn(col.marca, 'MARCA / MODELO', '', 45, 0.5)}
          {renderSplitColumn(col.matr, 'MATRICULA', '', 45, 0.5)}
          {renderSplitColumn(col.pot, 'POTENC. IA', '', 45, 0.5)}
          {renderSplitColumn(col.clase, 'CLASE', '', 45, 1.5)}

          {/* Tiempos de Vuelo Hierarchical Column */}
          <View style={{ width: col.vueloP * 8, flexDirection: 'column', borderRightWidth: 1.5, borderColor: '#000' }}>
            <View style={{ height: 22.5, flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#000' }}>
               <View style={[styles.cell, { width: '50%', borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>SOBRE AERÓDROMO</Text></View>
               <View style={[styles.cell, { width: '50%', borderRightWidth: 0 }]}><Text style={styles.cellText}>TRAVESIA</Text></View>
            </View>
            <View style={{ height: 22.5, flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#000' }}>
               <View style={[styles.cell, { width: '25%', borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>DE DIA</Text></View>
               <View style={[styles.cell, { width: '25%', borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>DE NOCHE</Text></View>
               <View style={[styles.cell, { width: '25%', borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>DE DIA</Text></View>
               <View style={[styles.cell, { width: '25%', borderRightWidth: 0 }]}><Text style={styles.cellText}>DE NOCHE</Text></View>
            </View>
            <View style={{ height: 12, flexDirection: 'row' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <React.Fragment key={i}>
                  <View style={[styles.cell, { width: col.vueloP, borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>Piloto</Text></View>
                  <View style={[styles.cell, { width: col.vueloC, borderRightWidth: i === 3 ? 0 : 0.5, borderColor: '#000' }]}><Text style={styles.cellText}>Copiloto</Text></View>
                </React.Fragment>
              ))}
            </View>
          </View>

          {renderDeepColumn(col.aterr, 'ATERRIZAJES', true, 5, 1.5)}

          {renderDeepColumn(col.inst, ['INSTRUCTOR', 'DE VUELO'], true, 5, 0.5)}
          {renderDeepColumn(col.multi, 'MULTI MOTOR', true, 5, 0.5)}
          {renderDeepColumn(col.jet, 'REACTOR', true, 5, 0.5)}
          {renderDeepColumn(col.turb, 'TURBO HELICE', true, 5, 0.5)}
          {renderDeepColumn(col.ag, 'AEROAPLICADOR', true, 4, 1.5)}

          {/* IFR Hierarchical Column */}
          <View style={{ width: col.ifr * 3, flexDirection: 'column', borderRightWidth: 1.5, borderColor: '#000' }}>
            <View style={[styles.cell, { height: 22.5, width: '100%', borderRightWidth: 0, borderBottomWidth: 0.5, borderColor: '#000' }]}><Text style={[styles.cellText, { fontSize: 4.5 }]}>VUELO POR INSTRUMENTOS</Text></View>
            <View style={{ height: 34.5, flexDirection: 'row' }}>
              <View style={{ width: col.ifr * 2, flexDirection: 'column', borderRightWidth: 0.5, borderColor: '#000' }}>
                <View style={[styles.cell, { height: 22.5, width: '100%', borderRightWidth: 0, padding: 1, borderBottomWidth: 0 }]}><View style={styles.verticalTextContainer}><Text style={[styles.verticalText, { fontSize: 4, width: 40 }]}>REAL</Text></View></View>
                <View style={{ height: 12, flexDirection: 'row', borderTopWidth: 0.5, borderColor: '#000' }}>
                  <View style={[styles.cell, { width: col.ifr, borderRightWidth: 0.5, borderColor: '#000' }]}><Text style={[styles.cellText, { fontSize: 4 }]}>PILOTO</Text></View>
                  <View style={[styles.cell, { width: col.ifr, borderRightWidth: 0 }]}><Text style={[styles.cellText, { fontSize: 4 }]}>COPILOTO</Text></View>
                </View>
              </View>
              <View style={{ width: col.ifr, flexDirection: 'column' }}>
                <View style={[styles.cell, { height: 22.5, borderRightWidth: 0, padding: 1, borderBottomWidth: 0 }]}><View style={styles.verticalTextContainer}><Text style={[styles.verticalText, { fontSize: 4, width: 40 }]}>CAPOTA</Text></View></View>
                <View style={[styles.cell, { height: 12, borderTopWidth: 0.5, borderRightWidth: 0, borderColor: '#000' }]}></View>
              </View>
            </View>
          </View>

          {/* SIM Hierarchical Column */}
          <View style={{ width: col.sim * 2, flexDirection: 'column', borderRightWidth: 1.5, borderColor: '#000' }}>
            <View style={[styles.cell, { height: 22.5, borderRightWidth: 0, borderBottomWidth: 0.5, borderColor: '#000' }]}></View>
            <View style={{ height: 34.5, flexDirection: 'row' }}>
              <View style={[styles.cell, { width: col.sim, borderRightWidth: 0.5, borderColor: '#000', padding: 1 }]}>
                <View style={styles.verticalTextContainer}>
                  <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: 34.5 }}>
                    <Text style={{ fontSize: 4, fontWeight: 'bold', textAlign: 'center' }}>INSTRUCTOR</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.cell, { width: col.sim, borderRightWidth: 0, padding: 1 }]}>
                <View style={styles.verticalTextContainer}>
                  <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: 34.5 }}>
                    <Text style={{ fontSize: 4, fontWeight: 'bold', textAlign: 'center' }}>PILOTO EN</Text>
                    <Text style={{ fontSize: 4, fontWeight: 'bold', textAlign: 'center' }}>INSTRUCCIÓN</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {renderDeepColumn(col.cert, '', false, 5, 0)}
        </View>
      </View>
    );
  };

  return (
    <Document>
      {pages.map((pageLogs, pageIndex) => {
        // Initial totals from profile
        const initialTotals = {
          airfield_day_pilot: profile?.total_airfield_day_pilot || 0,
          airfield_day_copilot: profile?.total_airfield_day_copilot || 0,
          airfield_night_pilot: profile?.total_airfield_night_pilot || 0,
          airfield_night_copilot: profile?.total_airfield_night_copilot || 0,
          cross_country_day_pilot: profile?.total_cross_country_day_pilot || 0,
          cross_country_day_copilot: profile?.total_cross_country_day_copilot || 0,
          cross_country_night_pilot: profile?.total_cross_country_night_pilot || 0,
          cross_country_night_copilot: profile?.total_cross_country_night_copilot || 0,
          landings: profile?.total_landings || 0,
          instruction_time: profile?.total_instruction_time || 0,
          multi_engine: profile?.total_multi_engine || 0,
          jet: profile?.total_jet || 0,
          turboprop: profile?.total_turboprop || 0,
          ag_application: profile?.total_ag_application || 0,
          ifr_real_pilot: profile?.total_ifr_real_pilot || 0,
          ifr_real_copilot: profile?.total_ifr_real_copilot || 0,
          ifr_hood: profile?.total_ifr_hood || 0,
          sim_instructor: profile?.total_sim_instructor || 0,
          sim_student: profile?.total_sim_student || 0,
          grand_total_hours: 0,
        };

        // Ensure grand total matches the sum of the 8 starting fields exactly
        initialTotals.grand_total_hours = (
          initialTotals.airfield_day_pilot +
          initialTotals.airfield_day_copilot +
          initialTotals.airfield_night_pilot +
          initialTotals.airfield_night_copilot +
          initialTotals.cross_country_day_pilot +
          initialTotals.cross_country_day_copilot +
          initialTotals.cross_country_night_pilot +
          initialTotals.cross_country_night_copilot
        );

        // Accumulate totals from all PREVIOUS pages
        const getPreviousPageTotals = (upToPageIndex: number) => {
          const totals = { 
            ...initialTotals,
            airfield_day_pilot: initialTotals.airfield_day_pilot,
            airfield_day_copilot: initialTotals.airfield_day_copilot,
            airfield_night_pilot: initialTotals.airfield_night_pilot,
            airfield_night_copilot: initialTotals.airfield_night_copilot,
            cross_country_day_pilot: initialTotals.cross_country_day_pilot,
            cross_country_day_copilot: initialTotals.cross_country_day_copilot,
            cross_country_night_pilot: initialTotals.cross_country_night_pilot,
            cross_country_night_copilot: initialTotals.cross_country_night_copilot,
            landings: initialTotals.landings,
            multi_engine: initialTotals.multi_engine,
            grand_total_hours: initialTotals.grand_total_hours,
            instruction_time: initialTotals.instruction_time,
            jet: initialTotals.jet,
            turboprop: initialTotals.turboprop,
            ag_application: initialTotals.ag_application,
            ifr_real_pilot: initialTotals.ifr_real_pilot,
            ifr_real_copilot: initialTotals.ifr_real_copilot,
            ifr_hood: initialTotals.ifr_hood,
            sim_instructor: initialTotals.sim_instructor,
            sim_student: initialTotals.sim_student,
          };
          for (let p = 0; p < upToPageIndex; p++) {
            const pLogs = pages[p];
            pLogs.forEach(log => {
              const hDia = parseFloat(log.horasDia || '0');
              const hNoche = parseFloat(log.horasNoche || '0');
              const isLocal = log.tipoVueloID === "1";
              const isCargo1 = log.cargoID === "1";

              if (isLocal) {
                if (isCargo1) {
                  totals.airfield_day_pilot += hDia;
                  totals.airfield_night_pilot += hNoche;
                } else {
                  totals.airfield_day_copilot += hDia;
                  totals.airfield_night_copilot += hNoche;
                }
              } else {
                if (isCargo1) {
                  totals.cross_country_day_pilot += hDia;
                  totals.cross_country_night_pilot += hNoche;
                } else {
                  totals.cross_country_day_copilot += hDia;
                  totals.cross_country_night_copilot += hNoche;
                }
              }

              totals.landings += Number(log.aterrizajes || 0);
              totals.grand_total_hours += (hDia + hNoche);
              totals.multi_engine += Number((log as any).multi_engine || (log.clase?.includes('MULT') ? (hDia + hNoche) : 0));
              totals.jet += Number((log as any).jet || 0);
              totals.turboprop += Number((log as any).turboprop || 0);
              totals.ag_application += Number((log as any).ag_application || 0);
              totals.ifr_real_pilot += Number((log as any).ifr_real_pilot || 0);
              totals.ifr_real_copilot += Number((log as any).ifr_real_copilot || 0);
              totals.ifr_hood += Number((log as any).ifr_hood || (log as any).ifr_instrument || 0);
              totals.sim_instructor += Number((log as any).sim_instructor || 0);
              totals.sim_student += Number((log as any).sim_student || 0);
              totals.instruction_time += Number((log as any).instruction_time || (log as any).instruccion || 0);
            });
          }
          return totals;
        };

        const anterior = getPreviousPageTotals(pageIndex);
        const siguiente = getPreviousPageTotals(pageIndex + 1);

        const calculatePageOnlyTotal = (key: string) => {
          return pageLogs.reduce((acc, log) => acc + (Number((log as any)[key]) || 0), 0);
        };

        return (
          <Page key={pageIndex} size="LEGAL" style={styles.page} orientation="landscape">
            {/* Grey Top Bar like in the image */}
            <View style={styles.topBar} />

            {/* Header Info */}
            <View style={styles.topHeaderContainer}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={styles.headerLabel}>APELLIDO Y NOMBRE: </Text>
                <Text style={styles.headerValue}>{profile?.last_name || ''}{profile?.first_name ? `, ${profile.first_name}` : ''}</Text>
              </View>
              
              <View style={{ flexDirection: 'row', gap: 30 }}>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>LICENCIA: </Text>
                  <Text style={styles.headerValue}>{profile?.license || ''}</Text>
                </View>
                
                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>Nº </Text>
                  <Text style={styles.headerValue}>{profile?.dni || ''}</Text>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>LEGAJO Nº </Text>
                  <Text style={styles.headerValue}>{profile?.legajo || ''}</Text>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>FOLIO Nº </Text>
                  <Text style={styles.headerValue}>{(profile?.initial_folio_number || sortedLogs[0]?.folio_number || 1) + pageIndex}</Text>
                </View>
              </View>
            </View>

            <View style={styles.table}>
              {renderHeader()}
              <View style={[styles.row, { height: 14 }]}>
                <View style={{ 
                  width: col.dia + col.mes + col.salida + col.desdeh + col.llegada + col.finalidad + col.marca + col.matr + col.pot + col.clase, 
                  borderRightWidth: 1.5, 
                  borderBottomWidth: 0.5, 
                  borderColor: '#000',
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end', 
                  paddingRight: 5,
                  backgroundColor: '#fff' 
                }}>
                  <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 7 }]}>TOTALES PAGINA ANTERIOR ------------------------------------------------------------------------------------------------{'>'}</Text>
                </View>
                
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{anterior.airfield_day_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{anterior.airfield_day_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{anterior.airfield_night_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{anterior.airfield_night_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{anterior.cross_country_day_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{anterior.cross_country_day_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{anterior.cross_country_night_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.cross_country_night_copilot.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.landings}</Text></View>
                
                <View style={[styles.cell, { width: col.inst }]}><Text style={styles.cellText}>{anterior.instruction_time.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.multi }]}><Text style={styles.cellText}>{anterior.multi_engine.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.jet }]}><Text style={styles.cellText}>{anterior.jet.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.turb }]}><Text style={styles.cellText}>{anterior.turboprop.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ag, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.ag_application.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{anterior.ifr_real_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{anterior.ifr_real_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ifr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.ifr_hood.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.sim }]}><Text style={styles.cellText}>{anterior.sim_instructor.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.sim, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.sim_student.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4 }]}>
                   <View style={{ minWidth: 35, height: 11, justifyContent: 'center', alignItems: 'flex-end', marginRight: 5 }}>
                      <Text style={[styles.cellText, { fontWeight: 'bold' }]}>{anterior.grand_total_hours.toFixed(1)}</Text>
                   </View>
                   <Text style={[styles.cellText, { fontSize: 4.5, textAlign: 'left' }]}>Total horas de vuelo de la pagina anterior</Text>
                </View>
              </View>

              {/* Data Rows */}
              {Array.from({ length: rowsPerPage }).map((_, idx) => {
                const log = pageLogs[idx];
                const depDate = log ? new Date(log.fechaHoraSalida) : null;
                const isLocal = log ? log.tipoVueloID === "1" : false;
                const isCargo1 = log ? log.cargoID === "1" : false;
                const hDia = log ? parseFloat(log.horasDia || '0') : 0;
                const hNoche = log ? parseFloat(log.horasNoche || '0') : 0;

                const formatTime = (isoStr: string) => {
                  if (!isoStr) return "";
                  try {
                    const d = new Date(isoStr);
                    const h = String(d.getUTCHours()).padStart(2, '0');
                    const m = String(d.getUTCMinutes()).padStart(2, '0');
                    return `${h}:${m}`;
                  } catch (e) {
                    return isoStr.slice(11, 16);
                  }
                };

                return (
                  <View key={idx} style={[styles.row, { height: 14 }]}>
                    <View style={[styles.cell, { width: col.dia }]}><Text style={styles.cellText}>{depDate ? depDate.getUTCDate() : ''}</Text></View>
                    <View style={[styles.cell, { width: col.mes, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{depDate ? depDate.getUTCMonth() + 1 : ''}</Text></View>
                    <View style={[styles.cell, { width: col.salida }]}><Text style={styles.cellText}>{log ? formatTime(log.fechaHoraSalida) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.desdeh }]}><Text style={styles.cellText}>{log ? `${log.origenID} - ${log.destinoID}` : ''}</Text></View>
                    <View style={[styles.cell, { width: col.llegada, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log ? formatTime(log.fechaHoraLlegada) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.finalidad, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{FLIGHT_PURPOSES.find(f => f.key === log?.finalidadID)?.sigla || log?.finalidadID || ''}</Text></View>
                    <View style={[styles.cell, { width: col.marca }]}><Text style={styles.cellText}>{log?.Marca_Modelo || ''}</Text></View>
                    <View style={[styles.cell, { width: col.matr }]}><Text style={styles.cellText}>{log?.matriculaAvion || ''}</Text></View>
                    <View style={[styles.cell, { width: col.pot }]}><Text style={styles.cellText}>{log?.potencia || ''}</Text></View>
                    <View style={[styles.cell, { width: col.clase, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log?.clase || ''}</Text></View>

                    <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{log && isLocal && isCargo1 ? hDia.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{log && isLocal && !isCargo1 ? hDia.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{log && isLocal && isCargo1 ? hNoche.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{log && isLocal && !isCargo1 ? hNoche.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{log && !isLocal && isCargo1 ? hDia.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{log && !isLocal && !isCargo1 ? hDia.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{log && !isLocal && isCargo1 ? hNoche.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.vueloC, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log && !isLocal && !isCargo1 ? hNoche.toFixed(1) : ''}</Text></View>

                    <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log?.aterrizajes || ''}</Text></View>
                    
                    <View style={[styles.cell, { width: col.inst }]}><Text style={styles.cellText}>{log?.instruction_time ? log.instruction_time.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.multi }]}><Text style={styles.cellText}>{log?.multi_engine ? log.multi_engine.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.jet }]}><Text style={styles.cellText}>{log?.jet ? log.jet.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.turb }]}><Text style={styles.cellText}>{log?.turboprop ? log.turboprop.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.ag, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log?.ag_application ? log.ag_application.toFixed(1) : ''}</Text></View>
                    
                    <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{log?.ifr_real_pilot ? log.ifr_real_pilot.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{log?.ifr_real_copilot ? log.ifr_real_copilot.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.ifr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log?.ifr_hood ? log.ifr_hood.toFixed(1) : ''}</Text></View>
                    
                    <View style={[styles.cell, { width: col.sim }]}><Text style={styles.cellText}>{log?.sim_instructor ? log.sim_instructor.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.sim, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{log?.sim_student ? log.sim_student.toFixed(1) : ''}</Text></View>
                    
                    <View style={[styles.cell, { width: col.cert, borderRightWidth: 0 }]}><Text style={[styles.cellText, { fontSize: 4 }]}>{idx === 0 ? 'CERTIFICO ACTIVIDAD SEGUN REGISTROS' : ''}</Text></View>
                  </View>
                );
              })}

              {/* Totales Pagina Siguiente Row */}
              <View style={[styles.row, { height: 18, borderBottomWidth: 0 }]}>
                <View style={{ 
                  width: col.dia + col.mes + col.salida + col.desdeh + col.llegada + col.finalidad + col.marca + col.matr + col.pot + col.clase, 
                  borderRightWidth: 1.5, 
                  borderBottomWidth: 0, 
                  borderColor: '#000',
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  justifyContent: 'flex-end', 
                  paddingRight: 5,
                  backgroundColor: '#fff' 
                }}>
                  <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 7 }]}>TOTALES A LA PAGINA SIGUIENTE ------------------------------------------------------------------------------------------{'>'}</Text>
                </View>
                
                {/* Calculated cumulative totals */}
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{siguiente.airfield_day_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{siguiente.airfield_day_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{siguiente.airfield_night_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{siguiente.airfield_night_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{siguiente.cross_country_day_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC }]}><Text style={styles.cellText}>{siguiente.cross_country_day_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloP }]}><Text style={styles.cellText}>{siguiente.cross_country_night_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.vueloC, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{siguiente.cross_country_night_copilot.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{siguiente.landings}</Text></View>
                
                <View style={[styles.cell, { width: col.inst }]}><Text style={styles.cellText}>{siguiente.instruction_time.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.multi }]}><Text style={styles.cellText}>{siguiente.multi_engine.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.jet }]}><Text style={styles.cellText}>{siguiente.jet.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.turb }]}><Text style={styles.cellText}>{siguiente.turboprop.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ag, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{siguiente.ag_application.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{siguiente.ifr_real_pilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ifr }]}><Text style={styles.cellText}>{siguiente.ifr_real_copilot.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.ifr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{siguiente.ifr_hood.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.sim }]}><Text style={styles.cellText}>{siguiente.sim_instructor.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.sim, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{siguiente.sim_student.toFixed(1)}</Text></View>
                
                <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, borderBottomWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4 }]}>
                   <View style={{ minWidth: 35, height: 11, justifyContent: 'center', alignItems: 'flex-end', marginRight: 5 }}>
                      <Text style={[styles.cellText, { fontWeight: 'bold' }]}>{siguiente.grand_total_hours.toFixed(1)}</Text>
                   </View>
                   <Text style={[styles.cellText, { fontSize: 4.5, textAlign: 'left' }]}>Total horas de vuelo de la pagina siguiente</Text>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <View style={{ gap: 2 }}>
                <Text style={styles.footerText}>HOJA DE LIBRO DE VUELO DE PILOTOS RESOLUCION ANAC 290/2012 del 15/05/2012 - MEDIDAS 35.5 cm X 16.5 cm</Text>
              </View>
              <View style={styles.signatureSection}>
                  <Text style={styles.signatureText}>FIRMA DEL TITULAR</Text>
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};
