import React, { useState, useRef, useCallback, useMemo } from 'react';
import * as ExcelJS from 'exceljs';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Download, X, Loader2, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from "@/components/ui/button";

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

const COLUMN_RULES: { pattern: RegExp; field: string; group: 'date' | 'time' | 'route' | 'aircraft' | 'times' | 'other' }[] = [
  { pattern: /^d[ií]a$/i, field: 'dia', group: 'date' },
  { pattern: /^mes$/i, field: 'mes', group: 'date' },
  { pattern: /hora.*salida|salida|departure/i, field: 'horaSalida', group: 'time' },
  { pattern: /^desde$|origen|from/i, field: 'origenID', group: 'route' },
  { pattern: /^hasta$|destino|to/i, field: 'destinoID', group: 'route' },
  { pattern: /desde.*hasta|origen.*destino|ruta/i, field: 'origenDestino', group: 'route' },
  { pattern: /hora.*llegada|llegada|arrival/i, field: 'horaLlegada', group: 'time' },
  { pattern: /finalidad|purpose/i, field: 'finalidadID', group: 'other' },
  { pattern: /marca|modelo|model/i, field: 'Marca_Modelo', group: 'aircraft' },
  { pattern: /matricula|matrícula|reg|tail/i, field: 'matriculaAvion', group: 'aircraft' },
  { pattern: /potencia|power/i, field: 'potencia', group: 'aircraft' },
  { pattern: /clase|class/i, field: 'clase', group: 'aircraft' },
  { pattern: /de d[ií]a|horas.*d[ií]a|vuelo.*d[ií]a|d[ií]a.*piloto/i, field: 'horasDia', group: 'times' },
  { pattern: /noche|horas.*noche|vuelo.*noche/i, field: 'horasNoche', group: 'times' },
  { pattern: /aterrizajes|landings/i, field: 'aterrizajes', group: 'times' },
  { pattern: /folio.*rva|folio.*rav|rva/i, field: 'folio_rva', group: 'other' },
  { pattern: /instructor.*tcp|tcp.*instructor/i, field: 'tcp_instructor', group: 'other' },
  { pattern: /tipo.*aeronave/i, field: 'tipoAeronave', group: 'aircraft' },
  { pattern: /certificaciones|observaciones|observations/i, field: 'observaciones', group: 'other' },
  { pattern: /cargo|tripulación|rol/i, field: 'cargoID', group: 'other' },
  { pattern: /tipo.*vuelo|tipo.*flight/i, field: 'tipoVueloID', group: 'other' },
  { pattern: /sobre aerodromo de d[ií]a.*piloto|aerodromo.*d[ií]a.*piloto/i, field: 'airfield_day_pilot', group: 'times' },
  { pattern: /sobre aerodromo de d[ií]a.*copiloto|aerodromo.*d[ií]a.*copiloto/i, field: 'airfield_day_copilot', group: 'times' },
  { pattern: /sobre aerodromo de noche.*piloto|aerodromo.*noche.*piloto/i, field: 'airfield_night_pilot', group: 'times' },
  { pattern: /sobre aerodromo de noche.*copiloto|aerodromo.*noche.*copiloto/i, field: 'airfield_night_copilot', group: 'times' },
  { pattern: /travesia de d[ií]a.*piloto/i, field: 'cross_country_day_pilot', group: 'times' },
  { pattern: /travesia de d[ií]a.*copiloto/i, field: 'cross_country_day_copilot', group: 'times' },
  { pattern: /travesia de noche.*piloto/i, field: 'cross_country_night_pilot', group: 'times' },
  { pattern: /travesia de noche.*copiloto/i, field: 'cross_country_night_copilot', group: 'times' },
];

const normalizeMatricula = (input: string): string => {
  const letters = (input || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  if (letters.length !== 5) return letters;
  return `${letters.slice(0, 2)}-${letters.slice(2)}`;
};

const parseTime = (val: string): [number, number] => {
  if (!val) return [0, 0];
  const iso = val.match(/T(\d{1,2}):(\d{2})/);
  if (iso) return [parseInt(iso[1]), parseInt(iso[2])];
  const withColon = val.match(/\b(\d{1,2}):(\d{2})\b/);
  if (withColon) return [parseInt(withColon[1]), parseInt(withColon[2])];
  return [0, 0];
};

const resolveFinalidad = (val: string): string => {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const found = FLIGHT_PURPOSES.find(p => p.sigla === trimmed.toUpperCase());
  return found ? found.key : trimmed;
};

interface ParsedRow {
  id: number;
  sheetName: string;
  rowNum: number;
  raw: Record<string, string>;
  normalized: Record<string, any>;
  errors: string[];
  warnings: string[];
  selected: boolean;
}

type Step = 'upload' | 'preview' | 'importing' | 'result';

interface ImportResult {
  inserted: number;
  errors: { index: number; messages: string[] }[];
  total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: 'piloto' | 'tcp';
  userId: string;
  isPaidSubscriber: boolean;
  onGoToSuscripcion?: () => void;
  onImportComplete: () => void;
}

export default function BulkImportModal({ open, onClose, mode, userId, isPaidSubscriber, onGoToSuscripcion, onImportComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setResult(null);
    setImportError('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const apiBase = (window as any).VITE_API_URL || '';

  const parseExcel = useCallback(async (file: File) => {
    setStep('importing');
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const parsedRows: ParsedRow[] = [];
      let rowId = 0;

      workbook.eachSheet((sheet) => {
        const allRows: any[][] = [];
        const maxExpectedCols = mode === 'tcp' ? 16 : 30;
        sheet.eachRow({ includeEmpty: false }, (row) => {
          const values: any[] = [];
          for (let ci = 1; ci <= maxExpectedCols; ci++) {
            values.push(row.getCell(ci).value);
          }
          allRows.push(values);
        });

        if (allRows.length < 2) return;

        // --- Smart header detection: merge column mappings from ALL header-like rows ---
        // The planilla format has row 2 with merged category headers and row 3 with column labels.
        // We scan rows 1-5, build colMap from non-empty cells, with later rows overriding earlier ones.
        let detectedYear = new Date().getUTCFullYear();
        let dataStartRow = 1;

        const colMap = new Map<string, number>();
        let hasOrigenDestino = false;
        let origenDestinoStart = -1;
        let origenDestinoEnd = -1;

        for (let ri = 0; ri < Math.min(5, allRows.length); ri++) {
          const row = allRows[ri];
          const text = row.map((c: any) => String(c ?? '').trim());

          // Check for year in this row (e.g. "AÑO\n2024" in merged cell)
          text.forEach(t => {
            const yMatch = t.match(/(\d{4})/);
            if (yMatch) detectedYear = parseInt(yMatch[0]);
          });

          // Count how many columns in this row match known patterns
          const matchCount = COLUMN_RULES.filter(r =>
            text.some(t => r.pattern.test(t))
          ).length;

          // Only process rows with at least 2 matching headers (avoid random data rows)
          if (matchCount < 2) continue;

          // For each non-empty cell in this row, try to match a column rule
          text.forEach((t, ci) => {
            if (!t) return;
            for (const rule of COLUMN_RULES) {
              if (rule.pattern.test(t)) {
                if (rule.field === 'origenDestino') {
                  hasOrigenDestino = true;
                  if (origenDestinoStart === -1) origenDestinoStart = ci;
                  origenDestinoEnd = ci;
                } else {
                  colMap.set(rule.field, ci);
                }
                break;
              }
            }
          });

          dataStartRow = ri + 1;
        }
        if (origenDestinoStart >= 0) colMap.set('origenDestino', origenDestinoStart);

        // --- Helper: get value from a row using column field name ---
        const getCell = (row: any[], field: string): string => {
          const colIdx = colMap.get(field);
          if (colIdx === undefined || colIdx >= row.length) return '';
          const val = row[colIdx];
          if (val && typeof val === 'object' && 'result' in val && val.result !== null && val.result !== undefined) {
            return String(val.result).trim();
          }
          return String(val ?? '').trim();
        };

        // --- Parse data rows (after header rows) ---
        const dataRows = allRows.slice(dataStartRow);
        for (const row of dataRows) {
          // Skip empty rows
          if (!row.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '')) continue;

          // Skip total/header/footer rows
          const rowText = row.map((c: any) => String(c ?? '')).join(' ');
          if (/TOTALES|APELLIDO Y NOMBRE|FIRMA DEL|APROBADO POR|CERTIFICADO DE COMPETENCIA|AÑO/.test(rowText)) continue;

          const dia = getCell(row, 'dia') || '';
          const mes = getCell(row, 'mes') || '';
          const horaSalida = getCell(row, 'horaSalida') || '';
          const horaLlegada = getCell(row, 'horaLlegada') || '';
          let origenID = getCell(row, 'origenID') || '';
          let destinoID = getCell(row, 'destinoID') || '';
          const matriculaRaw = getCell(row, 'matriculaAvion') || '';

          // Data row check: must have DIA (1-31), MES (1-12), and either matrícula or origen
          const hasDate = /^\d{1,2}$/.test(dia) && /^\d{1,2}$/.test(mes);
          const hasRoute = !!origenID || !!destinoID;
          const hasReg = matriculaRaw.length >= 3;
          if (!hasDate || (!hasRoute && !hasReg)) continue;

          // Combined origen-destino (DESDE - HASTA) column
          if ((!origenID || !destinoID) && hasOrigenDestino) {
            const combined = getCell(row, 'origenDestino') || '';
            const parts = combined.split('-').map((s: string) => s.trim());
            if (parts.length >= 2) {
              origenID = parts[0];
              destinoID = parts[1];
            } else if (origenDestinoEnd > origenDestinoStart && combined) {
              // Planilla format: merged header "DESDE - HASTA" but data has separate columns
              origenID = combined;
              destinoID = String(row[origenDestinoEnd] ?? '').trim();
            }
          }

          const matriculaNorm = normalizeMatricula(matriculaRaw);
          const finalidadVal = resolveFinalidad(getCell(row, 'finalidadID'));
          const hDia = parseFloat(getCell(row, 'horasDia')) || 0;
          const hNoche = parseFloat(getCell(row, 'horasNoche')) || 0;
          const aterrizajes = parseInt(getCell(row, 'aterrizajes')) || 0;
          const folioRva = getCell(row, 'folio_rva') || '';

          const month = parseInt(mes) || 1;
          const day = parseInt(dia) || 1;
          const [salH, salM] = parseTime(horaSalida);
          const [lleH, lleM] = parseTime(horaLlegada);
          const fechaSalida = new Date(Date.UTC(detectedYear, month - 1, day, salH, salM));
          const fechaLlegada = new Date(Date.UTC(detectedYear, month - 1, day, lleH, lleM));
          const fechaSalStr = fechaSalida.toISOString();
          const fechaLleStr = fechaLlegada.toISOString();

          const errors: string[] = [];
          const warnings: string[] = [];

          if (!fechaSalida.getTime()) errors.push('Fecha salida inválida');
          if (!fechaLlegada.getTime()) errors.push('Fecha llegada inválida');
          if (fechaSalida.getTime() && fechaLlegada.getTime() && fechaSalida >= fechaLlegada)
            errors.push('Salida posterior a llegada');
          if (!origenID) errors.push('Origen requerido');
          if (!destinoID) errors.push('Destino requerido');
          const matriculaLetters = (matriculaRaw || '').replace(/[^a-zA-Z]/g, '');
          if (!matriculaRaw) errors.push('Matrícula requerida');
          if (matriculaLetters.length !== 5 && matriculaRaw) errors.push('Matrícula inválida');
          if (!finalidadVal) warnings.push('FINALIDAD no reconocida');
          if (mode === 'tcp' && !folioRva) warnings.push('FOLIO RVA vacío');

          const normalized: Record<string, any> = {
            fechaHoraSalida: fechaSalStr,
            fechaHoraLlegada: fechaLleStr,
            origenID,
            destinoID,
            matriculaAvion: matriculaNorm,
            Marca_Modelo: getCell(row, 'Marca_Modelo') || '',
            potencia: parseInt(getCell(row, 'potencia')) || 0,
            clase: getCell(row, 'clase') || (mode === 'tcp' ? '' : 'D'),
            horasDia: hDia,
            horasNoche: hNoche,
            aterrizajes,
            finalidadID: finalidadVal || '78',
            observaciones: getCell(row, 'observaciones') || '',
            folio_rva: folioRva ? parseInt(folioRva) : null,
            tcp_instructor: mode === 'tcp' ? (getCell(row, 'tcp_instructor') === '1' || getCell(row, 'tcp_instructor')?.toLowerCase() === 'si' || getCell(row, 'tcp_instructor')?.toLowerCase() === 'true' || false) : undefined,
            cargoID: mode === 'tcp' ? '5' : (getCell(row, 'cargoID') || '1'),
            tipoVueloID: getCell(row, 'tipoVueloID') || '2',
          };

          if (mode === 'piloto') {
            normalized.airfield_day_pilot = parseFloat(getCell(row, 'airfield_day_pilot')) || 0;
            normalized.airfield_day_copilot = parseFloat(getCell(row, 'airfield_day_copilot')) || 0;
            normalized.airfield_night_pilot = parseFloat(getCell(row, 'airfield_night_pilot')) || 0;
            normalized.airfield_night_copilot = parseFloat(getCell(row, 'airfield_night_copilot')) || 0;
            normalized.cross_country_day_pilot = parseFloat(getCell(row, 'cross_country_day_pilot')) || 0;
            normalized.cross_country_day_copilot = parseFloat(getCell(row, 'cross_country_day_copilot')) || 0;
            normalized.cross_country_night_pilot = parseFloat(getCell(row, 'cross_country_night_pilot')) || 0;
            normalized.cross_country_night_copilot = parseFloat(getCell(row, 'cross_country_night_copilot')) || 0;
          }

          parsedRows.push({
            id: rowId++,
            sheetName: sheet.name,
            rowNum: allRows.indexOf(row) + 1,
            raw: {},
            normalized,
            errors,
            warnings,
            selected: errors.length === 0,
          });
        }
      });

      setRows(parsedRows);
      setStep('preview');
    } catch (e: any) {
      setImportError(`Error al leer el archivo: ${e.message}`);
      setStep('result');
    }
  }, [mode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
  }, [parseExcel]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) parseExcel(file);
  }, [parseExcel]);

  const toggleRow = useCallback((id: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  }, []);

  const updateCell = useCallback((rowId: number, field: string, value: any) => {
    if (!isPaidSubscriber) { setShowUpgradeModal(true); return; }
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const norm = { ...r.normalized, [field]: value };
      const errs: string[] = [];
      const warns: string[] = [];
      if (field === 'matriculaAvion') {
        const normed = normalizeMatricula(value);
        norm.matriculaAvion = normed;
        const letters = (value || '').replace(/[^a-zA-Z]/g, '');
        if (letters.length !== 5) errs.push('Matrícula inválida');
      }
      if (field === 'origenID' && !value) errs.push('Origen requerido');
      if (field === 'destinoID' && !value) errs.push('Destino requerido');
      if (mode === 'tcp' && field === 'folio_rva' && !value) warns.push('FOLIO RVA vacío');
      return { ...r, normalized: norm, errors: errs, warnings: warns, selected: errs.length === 0 };
    }));
  }, [mode, isPaidSubscriber]);

  const autoNormalize = useCallback(() => {
    setRows(prev => prev.map(r => {
      const raw = r.normalized.matriculaAvion || '';
      const mat = normalizeMatricula(raw);
      const errs = [...r.errors];
      const warns = [...r.warnings];
      const norm = { ...r.normalized, matriculaAvion: mat };
      const letters = raw.replace(/[^a-zA-Z]/g, '');
      if (letters.length === 5) {
        const idx = errs.indexOf('Matrícula inválida');
        if (idx >= 0) errs.splice(idx, 1);
      }
      return { ...r, normalized: norm, errors: errs, warnings: warns, selected: errs.length === 0 };
    }));
  }, []);

  const exportErrorsCSV = useCallback(() => {
    const errorRows = rows.filter(r => r.errors.length > 0 || r.warnings.length > 0);
    if (errorRows.length === 0) return;
    let csv = 'Hoja,Fila,Origen,Destino,Matrícula,Horas,Errores,Advertencias\n';
    errorRows.forEach(r => {
      csv += `"${r.sheetName}","${r.rowNum}","${r.normalized.origenID || ''}","${r.normalized.destinoID || ''}","${r.normalized.matriculaAvion || ''}","${(r.normalized.horasDia || 0) + (r.normalized.horasNoche || 0)}","${r.errors.join('; ')}","${r.warnings.join('; ')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errores_importacion.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  const handleImport = useCallback(async () => {
    const selected = rows.filter(r => r.selected);
    if (selected.length === 0) return;

    if (!isPaidSubscriber) { setShowUpgradeModal(true); return; }

    setStep('importing');
    try {
      const logs = selected.map(r => ({
        ...r.normalized,
        horasDia: String(r.normalized.horasDia),
        horasNoche: String(r.normalized.horasNoche),
      }));

      const res = await fetch(`${apiBase}/api/import-flight-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, logs, mode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error del servidor');

      setResult(data);
      setStep('result');
    } catch (e: any) {
      setImportError(e.message);
      setStep('result');
    }
  }, [rows, userId, mode, apiBase, isPaidSubscriber]);

  const countByStatus = useMemo(() => {
    let ok = 0, warns = 0, errs = 0;
    rows.forEach(r => {
      if (r.errors.length > 0) errs++;
      else if (r.warnings.length > 0 && r.selected) warns++;
      else if (r.selected) ok++;
    });
    return { ok, warns, errs };
  }, [rows]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-white dark:bg-[#1a2233] rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2d3748] shrink-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload size={18} className="text-blue-500" />
            Importar desde Excel
          </h2>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 'upload' && (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileSelect} />
              <FileSpreadsheet size={48} className="mx-auto mb-4 text-slate-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Hacé clic o arrastrá un archivo .xlsx</p>
              <p className="text-xs text-slate-400 mt-1">Formato de exportación de la app o similar</p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Sheet summary */}
              <div className="text-xs text-slate-500">
                Archivo: <span className="font-medium text-slate-700 dark:text-slate-300">{fileName}</span>
                {' · '}{rows.length} filas detectadas
              </div>

              {/* Tools bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={autoNormalize}>
                  Auto-normalizar matrículas
                </Button>
                {rows.filter(r => r.errors.length > 0 || r.warnings.length > 0).length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportErrorsCSV}>
                    <Download size={14} /> Errores CSV
                  </Button>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  {countByStatus.ok} ✅ · {countByStatus.warns} ⚠️ · {countByStatus.errs} ❌
                </span>
              </div>

              {/* Preview table */}
              <div className="border border-slate-200 dark:border-[#2d3748] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                        <th className="p-2 text-left w-8">
                          <input type="checkbox" checked={rows.filter(r => r.errors.length === 0).every(r => r.selected) && rows.filter(r => r.errors.length === 0).length > 0}
                            onChange={() => {
                              const allSelected = rows.filter(r => r.errors.length === 0).every(r => r.selected);
                              setRows(prev => prev.map(r => r.errors.length === 0 ? { ...r, selected: !allSelected } : r));
                            }}
                          />
                        </th>
                        <th className="p-2 text-left">Hoja</th>
                        <th className="p-2 text-left">DIA</th>
                        <th className="p-2 text-left">MES</th>
                        <th className="p-2 text-left">H.SAL</th>
                        <th className="p-2 text-left">DESDE</th>
                        <th className="p-2 text-left">HASTA</th>
                        <th className="p-2 text-left">H.LLE</th>
                        <th className="p-2 text-left">MATRÍCULA</th>
                        <th className="p-2 text-left">FINALIDAD</th>
                        <th className="p-2 text-right">DÍA</th>
                        <th className="p-2 text-right">NOCHE</th>
                        <th className="p-2 text-right">ATERR</th>
                        <th className="p-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const d = new Date(r.normalized.fechaHoraSalida);
                        const a = new Date(r.normalized.fechaHoraLlegada);
                        const hasErr = r.errors.length > 0;
                        const hasWarn = r.warnings.length > 0;
                        return (
                          <tr key={r.id} className={`border-t border-slate-100 dark:border-[#2d3748] ${!r.selected ? 'opacity-50' : ''} ${hasErr ? 'bg-red-50 dark:bg-red-900/10' : hasWarn ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                            <td className="p-2">
                              <input type="checkbox" checked={r.selected} disabled={hasErr} onChange={() => toggleRow(r.id)} />
                            </td>
                            <td className="p-2 text-slate-400">{r.sheetName}</td>
                            <td className="p-2 font-mono">{String(d.getUTCDate()).padStart(2, '0')}</td>
                            <td className="p-2 font-mono">{String(d.getUTCMonth() + 1).padStart(2, '0')}</td>
                            <td className="p-2 font-mono">{d.toISOString().slice(11, 16)}</td>
                            <td className="p-2">
                              <input className="w-14 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none text-center"
                                value={r.normalized.origenID || ''}
                                onChange={e => updateCell(r.id, 'origenID', e.target.value.toUpperCase())}
                              />
                            </td>
                            <td className="p-2">
                              <input className="w-14 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none text-center"
                                value={r.normalized.destinoID || ''}
                                onChange={e => updateCell(r.id, 'destinoID', e.target.value.toUpperCase())}
                              />
                            </td>
                            <td className="p-2 font-mono">{a.toISOString().slice(11, 16)}</td>
                            <td className="p-2">
                              {(() => { const ml = (r.normalized.matriculaAvion || '').replace(/[^a-zA-Z]/g, ''); return (
                                <input className={`w-16 bg-transparent border-b border-dashed text-center outline-none ${ml.length !== 5 ? 'border-red-300 text-red-600' : 'border-slate-300 dark:border-slate-600 focus:border-blue-500'}`}
                                  value={r.normalized.matriculaAvion || ''}
                                  onChange={e => updateCell(r.id, 'matriculaAvion', e.target.value.toUpperCase())}
                                />
                              ); })()}
                            </td>
                            <td className="p-2">{(() => {
                              const fid = r.normalized.finalidadID;
                              const fp = FLIGHT_PURPOSES.find(p => p.key === fid);
                              return fp ? fp.sigla : (fid || '');
                            })()}</td>
                            <td className="p-2 text-right font-mono">{r.normalized.horasDia.toFixed(1)}</td>
                            <td className="p-2 text-right font-mono">{r.normalized.horasNoche.toFixed(1)}</td>
                            <td className="p-2 text-right font-mono">{r.normalized.aterrizajes}</td>
                            <td className="p-2 text-center">
                              {hasErr ? <span title={r.errors.join(', ')}><XCircle size={14} className="text-red-500 mx-auto" /></span>
                                : hasWarn ? <span title={r.warnings.join(', ')}><AlertTriangle size={14} className="text-amber-500 mx-auto" /></span>
                                : <span title="Sin errores"><CheckCircle2 size={14} className="text-green-500 mx-auto" /></span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
              <p className="text-sm text-slate-500">
                {rows.length > 0 ? `Importando ${rows.filter(r => r.selected).length} vuelos...` : 'Procesando archivo...'}
              </p>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
                <CheckCircle2 size={24} className="text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-800 dark:text-green-400">Importación completada</p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    {result.inserted} insertado{result.inserted !== 1 ? 's' : ''} correctamente
                    {result.total > result.inserted && ` · ${result.total - result.inserted} omitido${result.total - result.inserted !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              {result.errors.filter(e => e.messages[0] !== 'Duplicado').length > 0 && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                  <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">Errores:</p>
                  {result.errors.filter(e => e.messages[0] !== 'Duplicado').map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Fila {e.index + 1}: {e.messages.join(', ')}</p>
                  ))}
                </div>
              )}
              {result.errors.filter(e => e.messages[0] === 'Duplicado').length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {result.errors.filter(e => e.messages[0] === 'Duplicado').length} duplicado{result.errors.filter(e => e.messages[0] === 'Duplicado').length !== 1 ? 's' : ''} omitido{result.errors.filter(e => e.messages[0] === 'Duplicado').length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'result' && importError && !result && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
              <XCircle size={24} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-400">Error</p>
                <p className="text-xs text-red-600">{importError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-[#2d3748] shrink-0">
          {step === 'preview' && (
            <>
              <span className="text-xs text-slate-400">
                {rows.filter(r => r.selected).length} de {rows.length} filas seleccionadas
                {countByStatus.errs > 0 && ` (${countByStatus.errs} con error excluidas)`}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
                <Button size="sm" onClick={handleImport} disabled={rows.filter(r => r.selected).length === 0}>
                  Confirmar importación ({rows.filter(r => r.selected).length})
                </Button>
              </div>
            </>
          )}
          {step === 'upload' && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancelar</Button>
            </div>
          )}
          {step === 'importing' && (
            <div className="ml-auto">
              <Button variant="outline" size="sm" disabled>Importando...</Button>
            </div>
          )}
          {step === 'result' && (
            <div className="ml-auto">
              <Button size="sm" onClick={() => { onImportComplete(); handleClose(); }}>Cerrar</Button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpgradeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 p-6 text-center"
            >
              <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
                <Upload size={28} className="text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Importación masiva</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                La importación masiva de vuelos está disponible solo para suscriptores de pago. Click aquí para adquirir la suscripción.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-12 font-semibold" onClick={() => setShowUpgradeModal(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1 rounded-xl h-12 font-bold bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 text-white" onClick={() => { setShowUpgradeModal(false); onGoToSuscripcion?.(); }}>
                  Adquirir Suscripción
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
