import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';
import { FlightLog, Profile } from '@/src/types';

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingLeft: 50,
    paddingRight: 35,
    backgroundColor: '#fff',
    fontFamily: 'Helvetica',
  },
  cuttingLineTop: {
    marginBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'dashed',
    width: '100%',
  },
  topHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    width: '100%',
    paddingHorizontal: 2,
    marginTop: 0,
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
  footer: {
    marginTop: 15,
    paddingHorizontal: 10,
    width: '100%',
  },
  footerText: {
    fontSize: 7,
    color: '#000',
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
  },
  cuttingLine: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'dashed',
    width: '100%',
  },
});

const col = {
  dia: 25,
  mes: 25,
  salida: 48,
  desde: 50,
  hasta: 50,
  llegada: 48,
  finalidad: 32,
  marca: 80,
  matr: 50,
  folioRav: 33,
  dia_h: 30,
  noche: 30,
  aterr: 24,
  instTcp: 35,
  tipoAero: 45,
  cert: 145,
};

const ROW_TOTAL = Object.values(col).reduce((a, b) => a + b, 0);

const FLIGHT_PURPOSES: Record<string, string> = {
  "47": "ACR", "46": "ADAP", "61": "AER", "62": "CI", "63": "ENT",
  "64": "EXA", "65": "FOR", "66": "FOTO", "67": "I", "68": "INST",
  "69": "IP", "70": "LP", "71": "N", "72": "PA", "73": "READ",
  "74": "RP", "75": "SAN", "76": "TA", "77": "VO", "78": "VP",
  "79": "LA", "80": "IP", "81": "TCPI"
};

const renderHeader = (pageYear: number) => {
  const bodyHeight = 45 + 12;
  const finalidadLeft = col.dia + col.mes + col.salida + col.desde + col.hasta + col.llegada;
  const aterrizajesLeft = finalidadLeft + col.finalidad + col.marca + col.matr + col.folioRav + col.dia_h + col.noche;
  const certLeft = aterrizajesLeft + col.aterr + col.instTcp + col.tipoAero;
  const renderDeepColumn = (width: number, label: string | string[], fontSize = 5, rightWidth = 0.5) => (
    <View style={[styles.cell, { width, height: bodyHeight, borderRightWidth: rightWidth, borderColor: '#000', padding: 0 }]}>
      <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: bodyHeight }}>
        {Array.isArray(label) ? label.map((line, idx) => (
          <Text key={idx} style={{ fontSize, fontWeight: 'bold', textAlign: 'center' }}>{line}</Text>
        )) : (
          <Text style={{ fontSize, fontWeight: 'bold', textAlign: 'center' }}>{label}</Text>
        )}
      </View>
    </View>
  );

  return (
    <View fixed style={{ position: 'relative' }}>
      <View style={[styles.headerRow, { height: 25, borderBottomWidth: 0 }]}>
        <View style={{ width: col.dia + col.mes, height: 25, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { fontSize: 6 }]}>AÑO</Text>
          <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 5 }]}>{pageYear}</Text>
        </View>
        <View style={[styles.cell, { width: col.salida + col.desde + col.hasta + col.llegada, borderRightWidth: 1.5, borderBottomWidth: 1.5 }]}>
          <Text style={styles.headerTitle}>ITINERARIO</Text>
        </View>
        <View style={[styles.cell, { width: col.finalidad, borderRightWidth: 1.5, borderBottomWidth: 0 }]} />
        <View style={[styles.cell, { width: col.marca + col.matr + col.folioRav, borderRightWidth: 1.5, borderBottomWidth: 1.5 }]}>
          <Text style={styles.headerTitle}>AERONAVES UTILIZADAS</Text>
        </View>
        <View style={[styles.cell, { width: col.dia_h + col.noche, borderRightWidth: 1.5, borderBottomWidth: 1.5 }]}>
          <Text style={styles.headerTitle}>TIEMPOS DE VUELO</Text>
        </View>
        <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5, borderBottomWidth: 0 }]} />
        <View style={[styles.cell, { width: col.instTcp + col.tipoAero, borderRightWidth: 1.5, borderBottomWidth: 1.5 }]}>
          <Text style={[styles.headerTitle, { fontSize: 5.5 }]}>DISCRIMINACION DE TIEMPOS DE VUELO</Text>
        </View>
        <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, borderBottomWidth: 0 }]} />
      </View>
      <View style={[styles.headerRow, { height: bodyHeight, borderBottomWidth: 1.5 }]}>
        <View style={[styles.cell, { width: col.dia, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>DIA</Text></View>
        <View style={[styles.cell, { width: col.mes, borderRightWidth: 1.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>MES</Text></View>
        {renderDeepColumn(col.salida, 'HORA DE SALIDA', 5, 1.5)}
        <View style={[styles.cell, { width: col.desde, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>DESDE</Text></View>
        <View style={[styles.cell, { width: col.hasta, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>HASTA</Text></View>
        {renderDeepColumn(col.llegada, 'HORA DE LLEGADA', 5, 1.5)}
        <View style={[styles.cell, { width: col.finalidad, borderRightWidth: 1.5, borderBottomWidth: 0 }]} />
        <View style={[styles.cell, { width: col.marca, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>MARCA</Text></View>
        <View style={[styles.cell, { width: col.matr, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>MATRÍCULA</Text></View>
        <View style={[styles.cell, { width: col.folioRav, borderRightWidth: 1.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>FOLIO RAV</Text></View>
        <View style={[styles.cell, { width: col.dia_h, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>DE DÍA</Text></View>
        <View style={[styles.cell, { width: col.noche, borderRightWidth: 1.5, borderBottomWidth: 0 }]}><Text style={styles.cellText}>NOCHE</Text></View>
        <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5, borderBottomWidth: 0 }]} />
        <View style={[styles.cell, { width: col.instTcp, borderRightWidth: 0.5, borderBottomWidth: 0 }]}><Text style={[styles.cellText, { fontSize: 4.5 }]}>INSTRUCTOR DE TCP</Text></View>
        <View style={[styles.cell, { width: col.tipoAero, borderRightWidth: 1.5, borderBottomWidth: 0 }]}><Text style={[styles.cellText, { fontSize: 4.5 }]}>TIPO DE AERONAVE</Text></View>
        <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, borderBottomWidth: 0 }]} />
      </View>
      <View style={{ position: 'absolute', left: finalidadLeft, top: 0, width: col.finalidad, height: 25 + bodyHeight + 1.5, borderRightWidth: 1.5, borderColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: 25 + bodyHeight + 1.5 }}>
          <Text style={{ fontSize: 5, fontWeight: 'bold', textAlign: 'center' }}>FINALIDAD DEL VUELO</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: aterrizajesLeft, top: 0, width: col.aterr, height: 25 + bodyHeight + 1.5, borderRightWidth: 1.5, borderColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ transform: 'rotate(-90deg)', alignItems: 'center', justifyContent: 'center', width: 25 + bodyHeight + 1.5 }}>
          <Text style={{ fontSize: 5, fontWeight: 'bold', textAlign: 'center' }}>ATERRIZAJES</Text>
        </View>
      </View>
      <View style={{ position: 'absolute', left: certLeft, top: 0, width: col.cert, height: 25 + bodyHeight + 1.5, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 5, fontWeight: 'bold', textAlign: 'center' }}>CERTIFICACIONES</Text>
      </View>
    </View>
  );
};

export const FlightLogTcpPDF = ({ logs, profile }: { logs: FlightLog[]; profile?: Profile | null }) => {
  const sortedLogs = [...logs].sort((a, b) => {
    const dateA = new Date(a.fechaHoraSalida).getTime();
    const dateB = new Date(b.fechaHoraSalida).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const rowsPerPage = 15;
  const pages: any[][] = [];
  let yearLogs: any[] = [];
  let currentYear = 0;

  for (const log of sortedLogs) {
    const logYear = new Date(log.fechaHoraSalida).getFullYear();
    if (currentYear !== 0 && logYear !== currentYear) {
      for (let i = 0; i < yearLogs.length; i += rowsPerPage)
        pages.push(yearLogs.slice(i, i + rowsPerPage));
      yearLogs = [];
    }
    currentYear = logYear;
    yearLogs.push(log);
  }
  for (let i = 0; i < yearLogs.length; i += rowsPerPage)
    pages.push(yearLogs.slice(i, i + rowsPerPage));

  return (
    <Document>
      {pages.map((pageLogs, pageIndex) => {
        const initialDia = profile?.tcp_total_dia || 0;
        const initialNoche = profile?.tcp_total_noche || 0;
        const initialInstructor = profile?.tcp_horas_instructor || 0;
        const initialLandings = profile?.total_landings || 0;
        const pageYear = pageLogs.length > 0 ? new Date(pageLogs[0].fechaHoraSalida).getUTCFullYear() : new Date().getFullYear();

        const getCumulativeTotals = (upToPageIndex: number) => {
          let d = Number(initialDia);
          let n = Number(initialNoche);
          let ins = Number(initialInstructor);
          let l = Number(initialLandings);
          for (let p = 0; p < upToPageIndex; p++) {
            pages[p].forEach(log => {
              const hDia = parseFloat(log.horasDia || '0');
              const hNoche = parseFloat(log.horasNoche || '0');
              d += hDia;
              n += hNoche;
              l += Number(log.aterrizajes || 0);
              if (log.tcp_instructor) ins += (hDia + hNoche);
            });
          }
          return { dia: d, noche: n, instructor: ins, landings: l };
        };

        const anterior = getCumulativeTotals(pageIndex);
        const siguiente = getCumulativeTotals(pageIndex + 1);

        return (
          <Page key={pageIndex} size="A4" style={styles.page} orientation="landscape">
            <View style={styles.cuttingLineTop} />
            <View style={styles.topHeaderContainer}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={styles.headerLabel}>APELLIDO Y NOMBRE: </Text>
                <Text style={styles.headerValue}>{profile?.last_name || ''}{profile?.first_name ? `, ${profile.first_name}` : ''}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 20 }}>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>CERTIFICADO DE COMPETENCIA: </Text>
                  <Text style={styles.headerValue}>TCP</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>LEGAJO: </Text>
                  <Text style={styles.headerValue}>{profile?.legajo || ''}</Text>
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <Text style={styles.headerLabel}>FOLIO N° </Text>
                  <Text style={styles.headerValue}>{(profile?.initial_folio_number || 1) + pageIndex}</Text>
                </View>
              </View>
            </View>
            <View style={styles.table}>
              {renderHeader(pageYear)}
              <View style={[styles.row, { height: 14, borderBottomWidth: 1.5 }]}>
                <View style={{
                  width: col.dia + col.mes + col.salida + col.desde + col.hasta + col.llegada + col.finalidad + col.marca + col.matr + col.folioRav,
                  borderRightWidth: 1.5, borderBottomWidth: 0, borderColor: '#000',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5,
                  backgroundColor: '#fff'
                }}>
                  <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 7 }]}>TOTALES PAGINA ANTERIOR -----------------------------------------------------------------------------{'>'}</Text>
                </View>
                <View style={[styles.cell, { width: col.dia_h, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.dia.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.noche, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.noche.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.landings}</Text></View>
                <View style={[styles.cell, { width: col.instTcp, borderRightWidth: 1.5 }]}><Text style={styles.cellText}>{anterior.instructor.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.tipoAero, borderRightWidth: 1.5 }]}><Text style={styles.cellText}></Text></View>
                <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4 }]}>
                  <Text style={[styles.cellText, { fontSize: 5 }]}>{`${anterior.dia.toFixed(1)}    Total horas de vuelo de la pagina anterior`}</Text>
                </View>
              </View>
              {pageLogs.map((log, idx) => {
                const d = new Date(log.fechaHoraSalida);
                const a = new Date(log.fechaHoraLlegada);
                const hDia = parseFloat(log.horasDia || '0');
                const hNoche = parseFloat(log.horasNoche || '0');
                const instructorHrs = log.tcp_instructor ? (hDia + hNoche) : 0;
                const finSigla = FLIGHT_PURPOSES[log.finalidadID] || log.finalidadID;
                return (
                  <View key={log.id || idx} style={[styles.row, { minHeight: 14 }]}>
                    <View style={[styles.cell, { width: col.dia }]}><Text style={styles.cellText}>{d.getUTCDate()}</Text></View>
                    <View style={[styles.cell, { width: col.mes }]}><Text style={styles.cellText}>{d.getUTCMonth() + 1}</Text></View>
                    <View style={[styles.cell, { width: col.salida }]}>
                      <Text style={styles.cellText}>{String(d.getUTCHours()).padStart(2, '0')}:{String(d.getUTCMinutes()).padStart(2, '0')}</Text>
                    </View>
                    <View style={[styles.cell, { width: col.desde }]}><Text style={styles.cellText}>{log.origenID}</Text></View>
                    <View style={[styles.cell, { width: col.hasta }]}><Text style={styles.cellText}>{log.destinoID}</Text></View>
                    <View style={[styles.cell, { width: col.llegada }]}>
                      <Text style={styles.cellText}>{String(a.getUTCHours()).padStart(2, '0')}:{String(a.getUTCMinutes()).padStart(2, '0')}</Text>
                    </View>
                    <View style={[styles.cell, { width: col.finalidad }]}><Text style={styles.cellText}>{finSigla}</Text></View>
                    <View style={[styles.cell, { width: col.marca }]}><Text style={[styles.cellText, { fontSize: 5 }]}>{log.Marca_Modelo || ''}</Text></View>
                    <View style={[styles.cell, { width: col.matr }]}><Text style={styles.cellText}>{log.matriculaAvion}</Text></View>
                    <View style={[styles.cell, { width: col.folioRav }]}><Text style={styles.cellText}>{log.folio_rva ?? ''}</Text></View>
                    <View style={[styles.cell, { width: col.dia_h }]}><Text style={styles.cellText}>{hDia.toFixed(1)}</Text></View>
                    <View style={[styles.cell, { width: col.noche }]}><Text style={styles.cellText}>{hNoche.toFixed(1)}</Text></View>
                    <View style={[styles.cell, { width: col.aterr }]}><Text style={styles.cellText}>{log.aterrizajes}</Text></View>
                    <View style={[styles.cell, { width: col.instTcp }]}><Text style={styles.cellText}>{instructorHrs > 0 ? instructorHrs.toFixed(1) : ''}</Text></View>
                    <View style={[styles.cell, { width: col.tipoAero }]}><Text style={[styles.cellText, { fontSize: 5 }]}>{log.Marca_Modelo || ''}</Text></View>
                    <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 2 }]}>
                      <Text style={[styles.cellText, { fontSize: 5, textAlign: 'left' }]}>
                        {`${(hDia + hNoche).toFixed(1)}  ${log.observaciones || ''}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {Array.from({ length: Math.max(0, rowsPerPage - pageLogs.length) }).map((_, idx) => (
                <View key={`empty-${idx}`} style={[styles.row, { minHeight: 14 }]}>
                  <View style={[styles.cell, { width: col.dia }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.mes }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.salida }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.desde }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.hasta }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.llegada }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.finalidad }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.marca }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.matr }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.folioRav }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.dia_h }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.noche }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.aterr }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.instTcp }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.tipoAero }]}><Text style={styles.cellText}></Text></View>
                  <View style={[styles.cell, { width: col.cert, borderRightWidth: 0 }]}><Text style={styles.cellText}></Text></View>
                </View>
              ))}
              <View style={[styles.row, { minHeight: 14, backgroundColor: '#f5f5f5', borderTopWidth: 1.5 }]}>
                <View style={{
                  width: col.dia + col.mes + col.salida + col.desde + col.hasta + col.llegada + col.finalidad + col.marca + col.matr + col.folioRav,
                  borderRightWidth: 1.5, borderBottomWidth: 0, borderTopWidth: 0, borderColor: '#000',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 5
                }}>
                  <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 7 }]}>TOTAL HORAS DE VUELO A LA PAGINA SIGUIENTE {'>'}</Text>
                </View>
                <View style={[styles.cell, { width: col.dia_h, borderRightWidth: 1.5 }]}><Text style={[styles.cellText, { fontWeight: 'bold' }]}>{siguiente.dia.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.noche, borderRightWidth: 1.5 }]}><Text style={[styles.cellText, { fontWeight: 'bold' }]}>{siguiente.noche.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.aterr, borderRightWidth: 1.5 }]}><Text style={[styles.cellText, { fontWeight: 'bold' }]}>{siguiente.landings}</Text></View>
                <View style={[styles.cell, { width: col.instTcp }]}><Text style={[styles.cellText, { fontWeight: 'bold' }]}>{siguiente.instructor.toFixed(1)}</Text></View>
                <View style={[styles.cell, { width: col.tipoAero, borderRightWidth: 1.5 }]}><Text style={styles.cellText}></Text></View>
                <View style={[styles.cell, { width: col.cert, borderRightWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 4 }]}>
                  <Text style={[styles.cellText, { fontWeight: 'bold', fontSize: 5 }]}>{`${siguiente.dia.toFixed(1)}    Total horas de vuelo de la pagina siguiente`}</Text>
                </View>
              </View>
            </View>
            <View style={styles.footer}>
              <Text style={styles.footerText}>APROBADO POR DISPOSICIÓN 278/03 DHA</Text>
            </View>
            {pageIndex === pages.length - 1 && (
              <View style={styles.signatureSection}>
                <View style={styles.signatureBox}>
                  <Text style={styles.signatureText}>FIRMA DEL TITULAR</Text>
                </View>
              </View>
            )}
            <View style={styles.cuttingLine} />
          </Page>
        );
      })}
    </Document>
  );
};
