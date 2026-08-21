import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, History, BarChart3, FileDown, Calendar as CalendarIcon, Clock, MapPin, PlaneTakeoff, Save, Trash2, ChevronRight, Info, Edit2, FileText, ArrowLeft, User, X, AlertTriangle, AlertCircle, CheckCircle2, Globe, RefreshCw, CalendarSync, LogOut, WifiOff, CloudOff, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { FlightLog, Profile, AnacLog } from '@/src/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { FlightLogTcpPDF } from './FlightLogTcpPDF';
import { AnacAuth } from './AnacAuth';
import BulkImportModal from './BulkImportModal';
import { supabase } from '@/src/utils/supabase/client';
import { getApiUrl } from '@/src/utils/api';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getQueue, addToQueue, removeFromQueue, pendingCount, PendingOp } from '@/src/utils/offlineQueue';
import { formatCuil } from '@/src/utils/cuil';
import airportsCsvRaw from '../../airports.csv?raw';

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

const CERTIFIER_ROLES = [
  { key: "2", value: "JEFE DE AERODROMO" },
  { key: "3", value: "OFICINA DE PLAN DE VUELO" },
  { key: "4", value: "OFICINA DE ARO/AIS" },
  { key: "5", value: "INSTRUCTOR DE VUELO" },
  { key: "6", value: "JEFE DE INSTRUCTORES" },
  { key: "7", value: "DIRECTOR ESCUELA" },
  { key: "8", value: "PRESIDENTE INST. AERODEPORTIVA" },
  { key: "9", value: "INSPECTORES DE VUELO" },
  { key: "10", value: "INSPECTORES DE LINEA AEREA" },
  { key: "11", value: "DIRECTOR DE AERONAUTICA PROVINCIAL" },
  { key: "12", value: "JEFE DE OPERACIONES" },
  { key: "13", value: "TITULAR EMPRESA" },
  { key: "14", value: "JEFE DE PILOTOS" },
  { key: "15", value: "GTE DE OPERACIONES" },
  { key: "16", value: "JEFE DE FLOTA" },
  { key: "17", value: "JEFE DE LINEA" },
  { key: "18", value: "INSPECTORES RECONOCIDOS" },
  { key: "19", value: "INSTRUCTOR DE SIMULADOR" },
  { key: "1", value: "OTROS" }
];

const IATA_AIRPORTS: Record<string, { iata: string, name: string }> = {
  'SABE': { iata: 'AEP', name: 'Aeroparque Jorge Newbery' },
  'SAEZ': { iata: 'EZE', name: 'Ezeiza Ministro Pistarini' },
  'SACO': { iata: 'COR', name: 'Córdoba / Pajas Blancas' },
  'SAMM': { iata: 'MDZ', name: 'Mendoza / El Plumerillo' },
  'SAZS': { iata: 'BRC', name: 'Bariloche' },
  'SARI': { iata: 'IGR', name: 'Puerto Iguazú' },
  'SASA': { iata: 'SLA', name: 'Salta' },
  'SAZN': { iata: 'NQN', name: 'Neuquén' },
  'SANT': { iata: 'TUC', name: 'Tucumán' },
  'SAWH': { iata: 'USH', name: 'Ushuaia' },
  'SAWC': { iata: 'FTE', name: 'El Calafate' },
  'SASJ': { iata: 'JUJ', name: 'Jujuy' },
  'SAVT': { iata: 'REL', name: 'Trelew' },
  'SAZM': { iata: 'MDQ', name: 'Mar del Plata' },
  'SAZB': { iata: 'BHI', name: 'Bahía Blanca' },
  'SARE': { iata: 'RES', name: 'Resistencia' },
  'SARC': { iata: 'CNQ', name: 'Corrientes' },
  'SARP': { iata: 'PSS', name: 'Posadas' },
  'SARF': { iata: 'FMA', name: 'Formosa' },
  'SANU': { iata: 'UAQ', name: 'San Juan' },
  'SANL': { iata: 'IRJ', name: 'La Rioja' },
  'SANC': { iata: 'CTC', name: 'Catamarca' },
  'SAOU': { iata: 'LUQ', name: 'San Luis' },
  'SASR': { iata: 'SRA', name: 'Santa Rosa' },
  'SAVN': { iata: 'VDM', name: 'Viedma' },
  'SAVE': { iata: 'EQS', name: 'Esquel' },
  'SAWG': { iata: 'RGL', name: 'Río Gallegos' },
  'SAVC': { iata: 'CRD', name: 'Comodoro Rivadavia' },
  'SAWE': { iata: 'RGA', name: 'Río Grande' },
  'SAZY': { iata: 'CPC', name: 'Chapelco / San Martín de los Andes' },
  'SAVY': { iata: 'PMY', name: 'Puerto Madryn' },
  'SAMR': { iata: 'AFA', name: 'San Rafael' },
  'SANE': { iata: 'SDE', name: 'Santiago del Estero' },
  'SANR': { iata: 'RHD', name: 'Termas de Río Hondo' },
  'SAAV': { iata: 'SFN', name: 'Santa Fe' },
  'SAAP': { iata: 'PRA', name: 'Paraná' },
  'SAOR': { iata: 'RLO', name: 'Merlo' },
  'SATR': { iata: 'RCQ', name: 'Reconquista' },
  'SAAR': { iata: 'ROS', name: 'Rosario' },
  'SAVV': { iata: 'VME', name: 'Villa Mercedes' },
  'SAOC': { iata: 'RCU', name: 'Río Cuarto' },
  'SAZQ': { iata: 'GPO', name: 'General Pico' },
  'SAZT': { iata: 'TDL', name: 'Tandil' },
  'SAZH': { iata: 'OLN', name: 'Olavarría' },
  'SAWD': { iata: 'PUD', name: 'Puerto Deseado' },
  'SAWP': { iata: 'PMO', name: 'Perito Moreno' },
  'SULS': { iata: 'PDP', name: 'Punta del Este' },
  'SUMU': { iata: 'MVD', name: 'Montevideo' },
  'SCEL': { iata: 'SCL', name: 'Santiago de Chile' },
  'SBGR': { iata: 'GRU', name: 'San Pablo' },
  'SBGL': { iata: 'GIG', name: 'Río de Janeiro' },
  'KMIA': { iata: 'MIA', name: 'Miami' },
  'LEMD': { iata: 'MAD', name: 'Madrid' },
  'EGLL': { iata: 'LHR', name: 'Londres' },
  'LFPG': { iata: 'CDG', name: 'París' },
  'LEBL': { iata: 'BCN', name: 'Barcelona' },
  'MMMX': { iata: 'MEX', name: 'Ciudad de México' },
  'SKBO': { iata: 'BOG', name: 'Bogotá' },
  'SPJC': { iata: 'LIM', name: 'Lima' },
  'MPTO': { iata: 'PTY', name: 'Panamá' },
  'KJFK': { iata: 'JFK', name: 'Nueva York' },
};

const IATA_LIST = Object.entries(IATA_AIRPORTS).map(([icao, info]) => ({ icao, ...info }));

const DecimalInput = ({ value, onChange, id, disabled, placeholder, className, onFocus, onBlur }: any) => {
  const [localValue, setLocalValue] = React.useState(value !== undefined && value !== null && value !== 0 ? String(value) : '');

  React.useEffect(() => {
    if (value === 0 || value === null || value === undefined) {
      setLocalValue('');
    } else {
      const currentParsed = parseFloat(localValue.replace(',', '.'));
      if (isNaN(currentParsed) || currentParsed !== value) {
        setLocalValue(String(value));
      }
    }
  }, [value]);

  const handleChange = (e: any) => {
    let val = e.target.value;
    val = val.replace(/,/g, '.');
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    setLocalValue(val);
    if (val === '' || val === '.') {
      onChange({ target: { value: '' } });
    } else {
      onChange({ target: { value: val } });
    }
  };

  return (
    <Input
      id={id}
      type="text"
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={localValue}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

const parseAirportsCsv = (csvText: string) => {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length <= 1) return [];
  const airports = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (parts.length < 2) continue;
    const iata = parts[0]?.trim().replace(/^"|"$/g, '');
    const icao = parts[1]?.trim().replace(/^"|"$/g, '');
    const anac = parts[2]?.trim().replace(/^"|"$/g, '');
    const name = parts[3]?.trim().replace(/^"|"$/g, '');
    const city = parts[4]?.trim().replace(/^"|"$/g, '');
    const cleanAnac = anac && anac !== 'N/A' && anac !== '' ? anac.toUpperCase() : null;
    airports.push({
      iata_code: iata?.toUpperCase(),
      icao_code: icao?.toUpperCase(),
      anac_code: cleanAnac,
      key_code: cleanAnac || iata?.toUpperCase(),
      name: name || '',
      city: city || ''
    });
  }
  return airports;
};

const localAirportsList = parseAirportsCsv(airportsCsvRaw);

// ── Comparación local vs ANAC para detectar vuelos modificados ──
const normalizeMatCompare = (m: any) => String(m || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const normTxt = (s: any) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const resolveAnacCode = (code: any) => {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return '';
  const found = localAirportsList.find(a => a.iata_code === c || a.icao_code === c || a.anac_code === c || a.key_code === c);
  return found ? (found.anac_code || found.key_code || c) : c;
};

// Todos los códigos del aeropuerto local (IATA/OACI/ANAC) para matchear la descripción de ANAC
const localAirportCodes = (code: any): string[] => {
  const c = String(code || '').trim().toUpperCase();
  if (!c) return [];
  const found = localAirportsList.find(a => a.iata_code === c || a.icao_code === c || a.anac_code === c || a.key_code === c);
  if (found) {
    return Array.from(new Set([found.iata_code, found.icao_code, found.anac_code, found.key_code].filter(Boolean))) as string[];
  }
  return [c];
};

const descContainsAny = (desc: string, codes: string[]): boolean =>
  codes.some(cd => cd && (desc || '').toUpperCase().includes(cd));

// Si el desc de ANAC no contiene ningún código local, intentar resolverlo como un
// aeropuerto conocido. Solo marca cambio si es un aeropuerto DISTINTO al local.
const routeDiffers = (localRaw: any, localCodes: string[], anacDesc: any): boolean => {
  if (!localCodes.length) return false;
  if (descContainsAny(anacDesc, localCodes)) return false;
  const d = (anacDesc || '').trim().toUpperCase();
  if (!d) return false;
  const resolved = localAirportsList.find(a =>
    a.icao_code === d || a.iata_code === d || a.anac_code === d || a.key_code === d
  );
  if (!resolved) return false; // desc no reconocido → no se puede comparar → no marcar
  const localRow = localAirportsList.find(a =>
    localCodes.includes(a.iata_code as any) || localCodes.includes(a.icao_code as any) ||
    localCodes.includes(a.anac_code as any) || localCodes.includes(a.key_code as any)
  );
  if (!localRow) return false;
  return resolved.iata_code !== localRow.iata_code;
};

// Merge del detalle (Get?id=) sobre el log del listado (GetPagedList):
// GetPagedList NO expone horas/observaciones/autoridad → los toma del detalle.
const mergeAnacDetail = (listLog: any, detail: any): any => {
  if (!detail) return listLog;
  return {
    ...listLog,
    horasDia: detail.horasDia ?? listLog.horasDia,
    horasNoche: detail.horasNoche ?? listLog.horasNoche,
    observaciones: detail.observaciones ?? listLog.observaciones,
    aterrizajes: detail.aterrizajes ?? listLog.aterrizajes,
    autoridadCertificanteID: detail.autoridadCertificanteID ?? listLog.autoridadCertificanteID,
    finalidad: detail.finalidad ?? listLog.finalidad,
    clase: detail.clase ?? listLog.clase,
    matricula: detail.matriculaAvion ?? listLog.matricula,
    marcaModelo: detail.marcaModelo ?? listLog.marcaModelo,
  };
};

const runConcurrent = async (items: any[], limit: number, fn: (item: any) => Promise<void>) => {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      try { await fn(items[i]); } catch {}
    }
  });
  await Promise.all(workers);
};

const listFlightDiffs = (local: any, anac: any): string[] => {
  const diffs: string[] = [];

  // Campos núcleo: se comparan solo si ANAC los devuelve con valor (GetPagedList
  // puede devolver null en horasDia/horasNoche/aterrizajes → no son comparables)
  const anacHD = anac.horasDia;
  if (anacHD != null && Math.abs(Number(local.horasDia || 0) - Number(anacHD)) > 0.01) diffs.push('horasDia');
  const anacHN = anac.horasNoche;
  if (anacHN != null && Math.abs(Number(local.horasNoche || 0) - Number(anacHN)) > 0.01) diffs.push('horasNoche');
  if (anac.aterrizajes != null && Number(local.aterrizajes || 0) !== Number(anac.aterrizajes)) diffs.push('aterrizajes');

  const localStart = new Date(local.fechaHoraSalida).toISOString().substring(0, 16);
  const localEnd = new Date(local.fechaHoraLlegada).toISOString().substring(0, 16);
  if (localStart !== (anac.fechaSalida || '').substring(0, 16)) diffs.push('fechaSalida');
  if (localEnd !== (anac.fechaLlegada || '').substring(0, 16)) diffs.push('fechaLlegada');

  if (normalizeMatCompare(local.matriculaAvion) !== normalizeMatCompare(anac.matricula)) diffs.push('matricula');

  // ANAC devuelve la ruta como descripción (ej: "SAZS" o "SAZS - BRC - BAR (...)") →
  // matchear contra CUALQUIER código del aeropuerto local (IATA/OACI/ANAC)
  const localOrigenCodes = localAirportCodes(local.origenID || (local as any).origin_ad);
  const localDestCodes = localAirportCodes(local.destinoID || (local as any).destination_ad);
  if (routeDiffers(local.origenID || (local as any).origin_ad, localOrigenCodes, anac.origenDesc)) diffs.push('origen');
  if (routeDiffers(local.destinoID || (local as any).destination_ad, localDestCodes, anac.destinoDesc)) diffs.push('destino');

  // Campos opcionales: SOLO marcan si AMBOS lados tienen valor y difieren
  // (GetPagedList puede no devolverlos → no generar falsos "modificados")
  const locObs = normTxt(local.observaciones);
  const anacObs = normTxt(anac.observaciones);
  if (locObs && anacObs && locObs !== anacObs) diffs.push('observaciones');

  // marcaModelo NO se compara: ANAC lo completa por su cuenta y puede diferir siempre

  const locClase = normTxt(local.clase);
  const anacClase = normTxt(anac.clase);
  if (locClase && anacClase && locClase !== anacClase) diffs.push('clase');

  const locPot = Number(local.potencia || 0);
  const anacPot = Number(anac.potencia || 0);
  if (locPot > 0 && anacPot > 0 && locPot !== anacPot) diffs.push('potencia');

  // autoridadCertificante:
  // - Si ANAC expone autoridadCertificanteID (del detalle Get?id=) → comparar el ID directo.
  // - Si no, comparar por rol reconocido (nombre); si ANAC devuelve persona/otro texto → no marcar.
  const localCertifierKey = String(local.autoridadCertificanteID);
  if (anac.autoridadCertificanteID != null) {
    if (String(anac.autoridadCertificanteID) !== localCertifierKey) {
      diffs.push('autoridadCertificante');
    }
  } else {
    const localCertifier = CERTIFIER_ROLES.find((r: any) => r.key === localCertifierKey);
    const anacCertNorm = normTxt(anac.autoridadCertificante);
    if (localCertifier && anacCertNorm) {
      const matchedCertRole = CERTIFIER_ROLES.find((r: any) =>
        anacCertNorm.includes(normTxt(r.value)) || anacCertNorm.includes(normTxt(r.key))
      );
      if (matchedCertRole && matchedCertRole.key !== localCertifierKey) {
        diffs.push('autoridadCertificante');
      }
    }
  }

  // finalidad: comparar por NOMBRE completo; las siglas cortas (ej: "I" de INSTRUCTOR)
  // causan falsos positivos porque son substrings de casi cualquier texto
  const localFinalidad = FLIGHT_PURPOSES.find((p: any) => p.key === String(local.finalidadID));
  const anacFinNorm = normTxt(anac.finalidad);
  if (localFinalidad && anacFinNorm) {
    const localFinName = normTxt(localFinalidad.value);
    const localFinSigla = normTxt(localFinalidad.sigla);
    const localFinKey = normTxt(localFinalidad.key);
    const localFinMatches = anacFinNorm.includes(localFinName)
      || (localFinSigla.length >= 3 && anacFinNorm.includes(localFinSigla))
      || anacFinNorm === localFinKey
      || anacFinNorm.includes(localFinKey);
    if (!localFinMatches) {
      const matchedFin = FLIGHT_PURPOSES.find((p: any) => {
        const name = normTxt(p.value);
        const sigla = normTxt(p.sigla);
        return anacFinNorm.includes(name) || (sigla.length >= 3 && anacFinNorm.includes(sigla));
      });
      if (matchedFin && matchedFin.key !== String(local.finalidadID)) {
        diffs.push('finalidad');
      }
    }
  }

  return diffs;
};

const flightDiffersFromAnac = (local: any, anac: any): boolean => listFlightDiffs(local, anac).length > 0;

// Describe en texto los cambios detectados (para mostrarlos antes de sincronizar)
const describeFlightDiffs = (local: any, anac: any): string[] => {
  const diffs = listFlightDiffs(local, anac);
  const labels: string[] = [];
  const fmtNum = (v: any) => (v == null ? '(sin dato)' : String(Number(v)));
  const fmtDate = (iso: any) => (iso ? (iso || '').substring(0, 16).replace('T', ' ') : '(sin dato)');
  const resolveIata = (code: any) => {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return c;
    const f = localAirportsList.find(a => a.iata_code === c || a.icao_code === c || a.anac_code === c || a.key_code === c);
    return f?.iata_code || c;
  };
  const descIata = (desc: any) => {
    const d = (desc || '').trim().toUpperCase();
    const f = localAirportsList.find(a => a.icao_code === d || a.iata_code === d || a.anac_code === d || a.key_code === d);
    return f?.iata_code || d;
  };

  if (diffs.includes('horasDia')) labels.push(`Horas día: ${fmtNum(local.horasDia)} → ${fmtNum(anac.horasDia)}`);
  if (diffs.includes('horasNoche')) labels.push(`Horas noche: ${fmtNum(local.horasNoche)} → ${fmtNum(anac.horasNoche)}`);
  if (diffs.includes('aterrizajes')) labels.push(`Aterrizajes: ${fmtNum(local.aterrizajes)} → ${fmtNum(anac.aterrizajes)}`);
  if (diffs.includes('fechaSalida')) labels.push(`Fecha salida: ${fmtDate(new Date(local.fechaHoraSalida).toISOString())} → ${fmtDate(anac.fechaSalida)}`);
  if (diffs.includes('fechaLlegada')) labels.push(`Fecha llegada: ${fmtDate(new Date(local.fechaHoraLlegada).toISOString())} → ${fmtDate(anac.fechaLlegada)}`);
  if (diffs.includes('matricula')) labels.push(`Matrícula: ${normalizeMatCompare(local.matriculaAvion)} → ${normalizeMatCompare(anac.matricula)}`);
  if (diffs.includes('origen')) labels.push(`Origen: ${resolveIata(local.origenID || (local as any).origin_ad)} → ${descIata(anac.origenDesc)}`);
  if (diffs.includes('destino')) labels.push(`Destino: ${resolveIata(local.destinoID || (local as any).destination_ad)} → ${descIata(anac.destinoDesc)}`);
  if (diffs.includes('observaciones')) labels.push(`Observaciones: "${normTxt(local.observaciones)}" → "${normTxt(anac.observaciones)}"`);
  if (diffs.includes('clase')) labels.push(`Clase: ${normTxt(local.clase)} → ${normTxt(anac.clase)}`);
  if (diffs.includes('potencia')) labels.push(`Potencia: ${fmtNum(local.potencia)} → ${fmtNum(anac.potencia)}`);
  if (diffs.includes('autoridadCertificante')) {
    const localRole = CERTIFIER_ROLES.find((r: any) => r.key === String(local.autoridadCertificanteID))?.value || local.autoridadCertificanteID;
    const anacRole = anac.autoridadCertificanteID != null
      ? (CERTIFIER_ROLES.find((r: any) => r.key === String(anac.autoridadCertificanteID))?.value || anac.autoridadCertificanteID)
      : (anac.autoridadCertificante || '(sin dato)');
    labels.push(`Autoridad certificante: ${localRole} → ${anacRole}`);
  }
  if (diffs.includes('finalidad')) {
    const localFin = FLIGHT_PURPOSES.find((p: any) => p.key === String(local.finalidadID))?.value || local.finalidadID;
    labels.push(`Finalidad: ${localFin} → ${anac.finalidad || '(sin dato)'}`);
  }
  return labels;
};

const findSecondaryMatch = (local: any, remoteLogs: any[]): any => {
  const localMat = normalizeMatCompare(local.matriculaAvion);
  if (!localMat) return undefined;
  const localStart = new Date(local.fechaHoraSalida).getTime();
  const localOrigenCodes = localAirportCodes(local.origenID || (local as any).origin_ad);
  const localDestCodes = localAirportCodes(local.destinoID || (local as any).destination_ad);
  const candidates = remoteLogs.filter(r => {
    if (normalizeMatCompare(r.matricula) !== localMat) return false;
    const rStart = new Date(r.fechaSalida).getTime();
    if (isNaN(rStart)) return false;
    // ±1 día (maneja vuelos que cruzan las 00:00 y cambian el día)
    if (Math.abs(rStart - localStart) / 86400000 > 1) return false;
    // Misma ruta (origen+destino) → es el mismo vuelo; excluye vuelos distintos
    if (routeDiffers(local.origenID || (local as any).origin_ad, localOrigenCodes, r.origenDesc)) return false;
    if (routeDiffers(local.destinoID || (local as any).destination_ad, localDestCodes, r.destinoDesc)) return false;
    return true;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
};

const AirportAutocomplete = ({ id, value, onChange, IATA_LIST, placeholder }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const normalizeStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filtered = useMemo(() => {
    if (!search) return [];
    const lower = search.toLowerCase();
    const lowerNorm = normalizeStr(lower);
    let allApts: any[] = localAirportsList.map(apt => {
      const codes = [apt.anac_code, apt.iata_code, apt.icao_code].filter(Boolean);
      const uniqueCodes = Array.from(new Set(codes));
      const raw = `${apt.city} ${apt.name} ${uniqueCodes.join(' ')}`;
      return { code: apt.key_code, label: `${apt.city ? apt.city + ' - ' : ''}${apt.name} (${uniqueCodes.join('/')})`, searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}` }
    });
    if (allApts.length === 0) {
      allApts = IATA_LIST.map((apt: any) => {
        const raw = `${apt.name} ${apt.iata}`;
        return { code: apt.iata, label: `${apt.name} (${apt.iata})`, searchStr: `${raw.toLowerCase()} ${normalizeStr(raw).toLowerCase()}` }
      });
    }
    return allApts.filter((a: any) => a.searchStr.includes(lower) || a.searchStr.includes(lowerNorm)).slice(0, 15);
  }, [search, IATA_LIST]);

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        id={id}
        placeholder={placeholder}
        maxLength={30}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value.toUpperCase());
          onChange(e.target.value.toUpperCase());
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-xl">
          <ul className="max-h-56 overflow-auto py-1">
            {filtered.map((item: any, idx: number) => (
              <li
                key={idx}
                className="px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex flex-col gap-0.5"
                onClick={() => {
                  setSearch(item.code);
                  onChange(item.code);
                  setIsOpen(false);
                }}
              >
                <div className="font-bold text-xs text-blue-600 dark:text-blue-400">{item.code}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{item.label}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const resolveToAnac = (code: string) => {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const local = localAirportsList.find(a => a.iata_code === c || a.icao_code === c || a.anac_code === c || a.key_code === c);
  if (local) return local.iata_code || local.key_code;
  const localFound = Object.entries(IATA_AIRPORTS).find(([icao, info]) =>
    icao.toUpperCase() === c || info.iata.toUpperCase() === c
  );
  if (localFound) return localFound[1].iata;
  return c;
};

interface LibroTcpScreenProps {
  logs: FlightLog[];
  setLogs: React.Dispatch<React.SetStateAction<FlightLog[]>>;
  profile: Profile | null;
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
  refreshData: () => Promise<Profile | null>;
  loading: boolean;
  userId: string;
  onGoToSuscripcion?: () => void;
}

export const LibroTcpScreen = ({ logs, setLogs, profile, setProfile, refreshData, loading, userId, onGoToSuscripcion }: LibroTcpScreenProps) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [anacToken, setAnacToken] = useState('');
  const [anacSession, setAnacSession] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<{ message: string, type: 'info' | 'success' | 'error' | null, progress?: number }>({ message: '', type: null });
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [anacLogs, setAnacLogs] = useState<AnacLog[]>([]);
  const [pendingLogs, setPendingLogs] = useState<FlightLog[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<{ log: FlightLog; vueloTripulanteID: number; diffs: string[] }[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOps, setPendingOps] = useState<PendingOp[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);

  const processQueue = async () => {
    if (!supabase || isSyncingQueue) return;
    setIsSyncingQueue(true);
    const queue = getQueue();
    if (queue.length === 0) { setIsSyncingQueue(false); return; }
    for (const op of queue) {
      if (op.type === 'insert') {
        try {
          const { data: existing } = await supabase
            .from('flight_logs')
            .select('id')
            .eq('user_id', op.data.user_id)
            .eq('fechaHoraSalida', op.data.fechaHoraSalida)
            .eq('fechaHoraLlegada', op.data.fechaHoraLlegada)
            .eq('origenID', op.data.origenID)
            .eq('destinoID', op.data.destinoID)
            .maybeSingle();
          if (existing) { removeFromQueue(op.localId); continue; }
          const { error } = await supabase.from('flight_logs').insert([op.data]);
          if (error) { op.retryCount++; if (op.retryCount >= 5) removeFromQueue(op.localId); continue; }
          removeFromQueue(op.localId);
        } catch (err) { op.retryCount++; if (op.retryCount >= 5) removeFromQueue(op.localId); }
      } else if (op.type === 'update') {
        try {
          const { error } = await supabase.from('flight_logs').update(op.data).eq('id', op.logId);
          if (error) { op.retryCount++; if (op.retryCount >= 5) removeFromQueue(op.logId); continue; }
          removeFromQueue(op.logId);
        } catch (err) { op.retryCount++; if (op.retryCount >= 5) removeFromQueue(op.logId); }
      } else if (op.type === 'delete') {
        try {
          const { error } = await supabase.from('flight_logs').delete().eq('id', op.remoteId);
          if (error) {
            op.retryCount++;
            if (op.retryCount >= 5) removeFromQueue(op.remoteId);
            continue;
          }
          removeFromQueue(op.remoteId);
        } catch (err) {
          op.retryCount++;
          if (op.retryCount >= 5) removeFromQueue(op.remoteId);
        }
      }
    }
    setPendingOps(getQueue());
    await refreshData();
    setIsSyncingQueue(false);
  };

  // Ref para evitar stale closure en listeners/auto-sync
  const processQueueRef = useRef<() => Promise<void>>(async () => {});
  processQueueRef.current = processQueue;

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean; title: string; message: string; onConfirm: () => void; onCancel?: () => void;
    confirmText?: string; cancelText?: string; type?: 'info' | 'warning' | 'danger'; isAlert?: boolean;
  }>({ show: false, title: '', message: '', onConfirm: () => {} });

  const showAlert = (title: string, message: string, type: 'info' | 'warning' | 'danger' = 'info') => {
    setConfirmModal({ show: true, title, message, onConfirm: () => setConfirmModal(prev => ({ ...prev, show: false })), type, isAlert: true, confirmText: 'Entendido' });
  };

  const askConfirm = (title: string, message: string, onConfirm: () => void, type: 'warning' | 'danger' | 'info' = 'warning') => {
    setConfirmModal({ show: true, title, message, onConfirm: () => { setConfirmModal(prev => ({ ...prev, show: false })); onConfirm(); }, onCancel: () => setConfirmModal(prev => ({ ...prev, show: false })), type, isAlert: false, confirmText: 'Confirmar', cancelText: 'Cancelar' });
  };

  const importFromRoster = async () => {
    if (!supabase || !userId) return;
    const { year, month, day, origin_ad, destination_ad } = formData;
    if (!year || !month || !day || !origin_ad || !destination_ad) return;

    try {
      const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const { data: rosterData } = await supabase
        .from('arms_roster')
        .select('roster_json, synced_at')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (!rosterData) {
        showAlert("Roster no encontrado", "No hay datos de roster para ese mes. Sincronizá ARMS primero.", 'warning');
        return;
      }

      const ANAC_TO_IATA: Record<string, string> = {
        "AER":"AEP","BAR":"BRC","ECA":"FTE","CAT":"CTC","BCA":"BHI",
        "CBA":"COR","CHP":"CPC","CRR":"CNQ","CRV":"CRD","DOZ":"MDZ","ESQ":"EQS",
        "GAL":"RGL","GPI":"GPO","GRA":"RGA","IGU":"IGR","JUA":"UAQ",
        "LAR":"IRJ","DRY":"PMY","MLG":"LGS","MDP":"MDQ","NEU":"NQN",
        "OSA":"RSA","PAR":"PRA","POS":"PSS","RYD":"VME","SAL":"SLA","SIS":"RES",
        "SRA":"AFA","SVO":"SFN","TRH":"TMM","TRE":"REL","UIS":"LUQ",
        "USU":"USH","VIE":"VDM",
      };

      const resolveToIATA = (code: string): string => {
        if (!code) return code;
        const c = code.trim().toUpperCase();
        if (ANAC_TO_IATA[c]) return ANAC_TO_IATA[c];
        const found = localAirportsList.find((a: any) =>
          a.iata_code === c || a.icao_code === c || a.anac_code === c || a.key_code === c
        );
        if (found?.iata_code) return found.iata_code;
        return c;
      };

      const originIATA = resolveToIATA(origin_ad);
      const destIATA = resolveToIATA(destination_ad);

      const getUTCDate = (localDateISO: string, localTime: string, utcTime: string): string => {
        const d = new Date(localDateISO + 'T12:00:00Z');
        const [lh, lm] = (localTime || '00:00').split(':').map(Number);
        const [uh, um] = (utcTime || '00:00').split(':').map(Number);
        if (uh * 60 + um < lh * 60 + lm) d.setUTCDate(d.getUTCDate() + 1);
        d.setUTCHours(uh, um, 0, 0);
        return d.toISOString().substring(0, 10);
      };

      const entries: any[] = rosterData.roster_json;
      let bestMatch: any = null;
      let bestLocalDate = '';

      for (const entry of entries) {
        if (!entry.isFlight) continue;
        for (const leg of (entry.legs || [])) {
          if (!leg.departureTimeUtc) continue;
          const legUTCDate = getUTCDate(entry.dateISO, leg.departureTimeLoc, leg.departureTimeUtc);
          if (legUTCDate === dateStr && leg.origin === originIATA && leg.destination === destIATA) {
            bestMatch = leg;
            bestLocalDate = entry.dateISO;
            break;
          }
        }
        if (bestMatch) break;
      }

      if (!bestMatch) {
        showAlert("Ruta no encontrada", `No se encontró un vuelo ${originIATA}→${destIATA} para el ${dateStr} en tu roster.`, 'warning');
        return;
      }

      const leg = bestMatch;
      if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) {
        showAlert("Sin horarios", "El roster no tiene horarios UTC para ese vuelo.", 'warning');
        return;
      }

      const arrivalDateTime = new Date(`${bestLocalDate}T${leg.arrivalTimeUtc}:00Z`);
      const syncedAt = new Date(rosterData.synced_at);

      if (syncedAt < arrivalDateTime) {
        showAlert("Horarios no actualizados",
          "Los horarios del roster aún no reflejan los tiempos reales del vuelo. Sincronizá ARMS primero y volvé a intentar.",
          'warning');
        return;
      }

      setFormData(prev => ({
        ...prev,
        departure_time_utc: leg.departureTimeUtc,
        arrival_time_utc: leg.arrivalTimeUtc,
      }));
      showAlert("Horarios importados", `Salida: ${leg.departureTimeUtc} UTC · Llegada: ${leg.arrivalTimeUtc} UTC\nHorarios reales confirmados.`, 'info');
    } catch (e: any) {
      showAlert("Error", e.message || 'Error al importar del roster.', 'danger');
    }
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isPaidSubscriber = !!(profile?.subscription_id && profile?.subscription_end_date && new Date(profile.subscription_end_date) > new Date());

  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const getSavedField = (key: string, defaultVal: string) => {
    try {
      const val = localStorage.getItem(`tcp_saved_${key}`);
      return val !== null ? val : defaultVal;
    } catch { return defaultVal; }
  };

  const getInitialFormState = () => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    day: new Date().getDate(),
    departure_time_utc: "",
    arrival_time_utc: "",
    origin_ad: "",
    destination_ad: "",
    registration: "",
    aircraft_model: getSavedField("aircraft_model", ""),
    flight_purpose: getSavedField("flight_purpose", "79"),
    landings: 1,
    certifier_role_id: getSavedField("certifier_role_id", "15"),
    certifier_name: getSavedField("certifier_name", ""),
    folio_number: 1,
    folio_rva: null as number | null,
    horas_dia: 0,
    horas_noche: 0,
    tcp_instructor: false,
  });

  const initialFormState = getInitialFormState();
  const [formData, setFormData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('tcp_draft_flight_log_form');
      if (saved) {
        const parsed = JSON.parse(saved);
        const isEditing = localStorage.getItem('tcp_draft_flight_log_editing_id');
        if (!isEditing) {
          parsed.year = new Date().getFullYear();
          parsed.month = new Date().getMonth() + 1;
          parsed.day = new Date().getDate();
        }
        return parsed;
      }
    } catch {}
    return initialFormState;
  });
  const [editingId, setEditingId] = useState<string | null>(() => {
    try { return localStorage.getItem('tcp_draft_flight_log_editing_id') || null; } catch { return null; }
  });

  useEffect(() => {
    try { localStorage.setItem('tcp_draft_flight_log_form', JSON.stringify(formData)); } catch {}
  }, [formData]);
  useEffect(() => {
    try {
      if (editingId) localStorage.setItem('tcp_draft_flight_log_editing_id', editingId);
      else localStorage.removeItem('tcp_draft_flight_log_editing_id');
    } catch {}
  }, [editingId]);
  useEffect(() => {
    try { localStorage.setItem('tcp_flight_log_active_tab', activeTab); } catch {}
  }, [activeTab]);

  // Auto-sync de la cola offline al montar (si hay ops pendientes y estamos online)
  useEffect(() => {
    setPendingOps(getQueue());
    if (navigator.onLine && getQueue().length > 0) {
      processQueueRef.current();
    }
  }, []);

  // Listeners de conexión + auto-sync al reconectar/focus (usa ref para evitar stale closure)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processQueueRef.current();
    };
    const handleOffline = () => setIsOnline(false);
    const handleFocus = () => { if (navigator.onLine) processQueueRef.current(); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const calculateDecimalDuration = (dep: string | undefined, arr: string | undefined) => {
    if (!dep || !arr) return null;
    const [dh, dm] = dep.split(':').map(Number);
    const [ah, am] = arr.split(':').map(Number);
    const depMin = dh * 60 + dm;
    let arrMin = ah * 60 + am;
    if (arrMin <= depMin) arrMin += 1440;
    const diffMin = arrMin - depMin;
    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    let decimalMinutes = 0;
    if (minutes >= 3 && minutes <= 8) decimalMinutes = 0.1;
    else if (minutes >= 9 && minutes <= 14) decimalMinutes = 0.2;
    else if (minutes >= 15 && minutes <= 20) decimalMinutes = 0.3;
    else if (minutes >= 21 && minutes <= 26) decimalMinutes = 0.4;
    else if (minutes >= 27 && minutes <= 33) decimalMinutes = 0.5;
    else if (minutes >= 34 && minutes <= 39) decimalMinutes = 0.6;
    else if (minutes >= 40 && minutes <= 45) decimalMinutes = 0.7;
    else if (minutes >= 46 && minutes <= 51) decimalMinutes = 0.8;
    else if (minutes >= 52 && minutes <= 57) decimalMinutes = 0.9;
    else if (minutes >= 58) decimalMinutes = 1.0;
    return (hours + decimalMinutes).toFixed(1);
  };

  const syncProfileTotals = async () => {
    // No-op: initial totals must remain static and are calculated dynamically in the UI.
    // They are only accumulated and updated when the database is reset or manually updated by the user.
  };

  const saveLog = async () => {
    if (!supabase) return;

    const performSave = async () => {
      if (!formData.year || !formData.month || !formData.day) {
        showAlert("Campos Incompletos", "Por favor ingrese una fecha válida.", 'warning');
        return;
      }
      if (!formData.origin_ad || !formData.destination_ad) {
        showAlert("Ruta Incompleta", "Por favor ingrese aeródromo de origen y destino.", 'warning');
        return;
      }
      if (!formData.registration) {
        showAlert("Campo Obligatorio", "Por favor ingrese la matrícula de la aeronave.", 'warning');
        return;
      }
      const regLetters = (formData.registration || '').replace(/[^a-zA-Z]/g, '');
      if (regLetters.length !== 5) {
        showAlert("Matrícula Inválida", "La matrícula debe tener 5 letras (ej: LV-KCE).", 'warning');
        return;
      }
      if (!formData.departure_time_utc || formData.departure_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de salida válido (HH:MM).", 'warning');
        return;
      }
      if (!formData.arrival_time_utc || formData.arrival_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de llegada válido (HH:MM).", 'warning');
        return;
      }

      const resolvedOrigin = resolveToAnac(formData.origin_ad);
      const resolvedDest = resolveToAnac(formData.destination_ad);
      if (!resolvedOrigin || !resolvedDest) {
        showAlert("Aeródromo Inválido", "No se pudo resolver el código del aeródromo.", 'warning');
        return;
      }

      const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
      const currentSum = Number(formData.horas_dia || 0) + Number(formData.horas_noche || 0);
      if (currentSum > (totalRef + 0.01)) {
        showAlert("Error de Tiempos", `Las horas (${currentSum.toFixed(1)}) exceden el tiempo del vuelo (${totalRef.toFixed(1)}).`, 'danger');
        return;
      }

      if (!userId) {
        showAlert("Sesión Expirada", "Por favor inicie sesión nuevamente.", 'danger');
        return;
      }

      const buildISO = (y: number, mon: number, d: number, timeStr: string, isNextDay: boolean = false) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(Date.UTC(y, mon - 1, d, h || 0, m || 0));
        if (isNextDay) date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString();
      };

      const crossesMidnight = (formData.arrival_time_utc || "") < (formData.departure_time_utc || "");
      const checkSalida = buildISO(formData.year, formData.month, formData.day, formData.departure_time_utc);
      const checkLlegada = buildISO(formData.year, formData.month, formData.day, formData.arrival_time_utc, crossesMidnight);

      const conflictingLog = logs.find(log => {
        if (editingId && log.id === editingId) return false;
        const logSalidaMs = new Date(log.fechaHoraSalida).getTime();
        const logLlegadaMs = new Date(log.fechaHoraLlegada).getTime();
        const checkSalidaMs = new Date(checkSalida).getTime();
        const checkLlegadaMs = new Date(checkLlegada).getTime();
        const isDuplicate = logSalidaMs === checkSalidaMs && logLlegadaMs === checkLlegadaMs && log.origenID === resolvedOrigin && log.destinoID === resolvedDest;
        const isOverlapping = checkSalidaMs < logLlegadaMs && checkLlegadaMs > logSalidaMs;
        return isDuplicate || isOverlapping;
      });

      if (conflictingLog && !editingId) {
        showAlert("Conflicto de Horarios", "Ya existe un vuelo en ese horario.", 'warning');
        return;
      }

      let obs = formData.certifier_name || "";
      const maxFolio = logs.reduce((max, l) => Math.max(max, Number(l.folio_number || 0)), 0);
      const nextFolio = Math.max(maxFolio + 1, Number(profile?.initial_folio_number || 1));

      const logToSave: any = {
        user_id: userId,
        fechaHoraSalida: checkSalida,
        fechaHoraLlegada: checkLlegada,
        origenID: resolvedOrigin,
        destinoID: resolvedDest,
        finalidadID: formData.flight_purpose || '79',
        clase: '',
        matriculaAvion: (() => {
          const raw = (formData.registration || '').toUpperCase();
          const letters = raw.replace(/[^a-zA-Z]/g, '');
          if (letters.length === 5) return `${letters.slice(0, 2)}-${letters.slice(2)}`;
          return raw;
        })(),
        Marca_Modelo: formData.aircraft_model || '',
        potencia: 0,
        aterrizajes: Number(formData.landings || 1),
        horasDia: String(Number(formData.horas_dia || 0).toFixed(1)),
        horasNoche: String(Number(formData.horas_noche || 0).toFixed(1)),
        tipoVueloID: '2',
        cargoID: '5',
        autoridadCertificanteID: formData.certifier_role_id || '15',
        observaciones: obs,
        ifr_instrument: 0,
        instruccion: 0,
        multi_engine: 0,
        jet: 0,
        turboprop: 0,
        ag_application: 0,
        folio_number: nextFolio,
        folio_rva: formData.folio_rva ? Number(formData.folio_rva) : null,
        tcp_instructor: formData.tcp_instructor || false,
        airfield_day_pilot: 0,
        airfield_day_copilot: 0,
        airfield_night_pilot: 0,
        airfield_night_copilot: 0,
        cross_country_day_pilot: 0,
        cross_country_day_copilot: 0,
        cross_country_night_pilot: 0,
        cross_country_night_copilot: 0,
        ifr_real_pilot: 0,
        ifr_real_copilot: 0,
        ifr_hood: 0,
        sim_instructor: 0,
        sim_student: 0,
      };

      try {
        localStorage.setItem('tcp_saved_aircraft_model', formData.aircraft_model || '');
        localStorage.setItem('tcp_saved_flight_purpose', formData.flight_purpose || '79');
        localStorage.setItem('tcp_saved_certifier_role_id', formData.certifier_role_id || '15');
        localStorage.setItem('tcp_saved_certifier_name', formData.certifier_name || '');
      } catch (e) {
        console.error("Error saving autocomplete fields:", e);
      }

      if (editingId) {
        const { error } = await supabase.from('flight_logs').update(logToSave).eq('id', editingId);
        if (error) throw error;
        setLogs(prev => prev.map(l => l.id === editingId ? { ...l, ...logToSave, id: editingId } : l));
        showAlert("Vuelo Actualizado", "El registro ha sido actualizado correctamente." + (!formData.folio_rva ? " Nota: no ingresó ningún número de FOLIO RAV, puede continuar pero ese campo quedará vacío en el PDF exportado." : ""), 'info');
      } else {
        const { data, error } = await supabase.from('flight_logs').insert(logToSave).select().single();
        if (error) throw error;
        if (data) setLogs(prev => [...prev, data]);
        showAlert("Vuelo Guardado", "El registro se ha guardado correctamente." + (!formData.folio_rva ? " Nota: no ingresó ningún número de FOLIO RAV, puede continuar pero ese campo quedará vacío en el PDF exportado." : ""), 'info');
      }

      setEditingId(null);
      setFormData(getInitialFormState());
      setActiveTab('historial');
      await syncProfileTotals();
    };

    if (!navigator.onLine) {
      try {
        localStorage.setItem('tcp_saved_aircraft_model', formData.aircraft_model || '');
        localStorage.setItem('tcp_saved_flight_purpose', formData.flight_purpose || '79');
        localStorage.setItem('tcp_saved_certifier_role_id', formData.certifier_role_id || '15');
        localStorage.setItem('tcp_saved_certifier_name', formData.certifier_name || '');
      } catch {}

      // Validation and build logic for offline queue payload
      if (!formData.year || !formData.month || !formData.day) {
        showAlert("Campos Incompletos", "Por favor ingrese una fecha válida.", 'warning');
        return;
      }
      if (!formData.origin_ad || !formData.destination_ad) {
        showAlert("Ruta Incompleta", "Por favor ingrese aeródromo de origen y destino.", 'warning');
        return;
      }
      if (!formData.registration) {
        showAlert("Campo Obligatorio", "Por favor ingrese la matrícula de la aeronave.", 'warning');
        return;
      }
      const regLetters = (formData.registration || '').replace(/[^a-zA-Z]/g, '');
      if (regLetters.length !== 5) {
        showAlert("Matrícula Inválida", "La matrícula debe tener 5 letras (ej: LV-KCE).", 'warning');
        return;
      }
      if (!formData.departure_time_utc || formData.departure_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de salida válido (HH:MM).", 'warning');
        return;
      }
      if (!formData.arrival_time_utc || formData.arrival_time_utc.length < 5) {
        showAlert("Horario Inválido", "Por favor ingrese un horario de llegada válido (HH:MM).", 'warning');
        return;
      }

      const resolvedOrigin = resolveToAnac(formData.origin_ad);
      const resolvedDest = resolveToAnac(formData.destination_ad);
      if (!resolvedOrigin || !resolvedDest) {
        showAlert("Aeródromo Inválido", "No se pudo resolver el código del aeródromo.", 'warning');
        return;
      }

      const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
      const currentSum = Number(formData.horas_dia || 0) + Number(formData.horas_noche || 0);
      if (currentSum > (totalRef + 0.01)) {
        showAlert("Error de Tiempos", `Las horas (${currentSum.toFixed(1)}) exceden el tiempo del vuelo (${totalRef.toFixed(1)}).`, 'danger');
        return;
      }

      if (!userId) {
        showAlert("Sesión Expirada", "Por favor inicie sesión nuevamente.", 'danger');
        return;
      }

      const buildISO = (y: number, mon: number, d: number, timeStr: string, isNextDay: boolean = false) => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date(Date.UTC(y, mon - 1, d, h || 0, m || 0));
        if (isNextDay) date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString();
      };

      const crossesMidnight = (formData.arrival_time_utc || "") < (formData.departure_time_utc || "");
      const checkSalida = buildISO(formData.year, formData.month, formData.day, formData.departure_time_utc);
      const checkLlegada = buildISO(formData.year, formData.month, formData.day, formData.arrival_time_utc, crossesMidnight);

      const maxFolio = logs.reduce((max, l) => Math.max(max, Number(l.folio_number || 0)), 0);
      const nextFolio = Math.max(maxFolio + 1, Number(profile?.initial_folio_number || 1));

      const logToSave: any = {
        user_id: userId,
        fechaHoraSalida: checkSalida,
        fechaHoraLlegada: checkLlegada,
        origenID: resolvedOrigin,
        destinoID: resolvedDest,
        finalidadID: formData.flight_purpose || '79',
        clase: '',
        matriculaAvion: (() => {
          const raw = (formData.registration || '').toUpperCase();
          const letters = raw.replace(/[^a-zA-Z]/g, '');
          if (letters.length === 5) return `${letters.slice(0, 2)}-${letters.slice(2)}`;
          return raw;
        })(),
        Marca_Modelo: formData.aircraft_model || '',
        potencia: 0,
        aterrizajes: Number(formData.landings || 1),
        horasDia: String(Number(formData.horas_dia || 0).toFixed(1)),
        horasNoche: String(Number(formData.horas_noche || 0).toFixed(1)),
        tipoVueloID: '2',
        cargoID: '5',
        autoridadCertificanteID: formData.certifier_role_id || '15',
        observaciones: formData.certifier_name || '',
        ifr_instrument: 0,
        instruccion: 0,
        multi_engine: 0,
        jet: 0,
        turboprop: 0,
        ag_application: 0,
        folio_number: nextFolio,
        folio_rva: formData.folio_rva ? Number(formData.folio_rva) : null,
        tcp_instructor: formData.tcp_instructor || false,
        airfield_day_pilot: 0,
        airfield_day_copilot: 0,
        airfield_night_pilot: 0,
        airfield_night_copilot: 0,
        cross_country_day_pilot: 0,
        cross_country_day_copilot: 0,
        cross_country_night_pilot: 0,
        cross_country_night_copilot: 0,
        ifr_real_pilot: 0,
        ifr_real_copilot: 0,
        ifr_hood: 0,
        sim_instructor: 0,
        sim_student: 0,
      };

      if (editingId) {
        addToQueue({
          type: 'update',
          logId: editingId,
          data: logToSave,
          createdAt: new Date().toISOString(),
          retryCount: 0
        });
        setLogs(prev => prev.map(l => l.id === editingId ? { ...l, ...logToSave, id: editingId } : l));
      } else {
        const localId = `local_${Date.now()}`;
        addToQueue({
          type: 'insert',
          localId,
          data: logToSave,
          createdAt: new Date().toISOString(),
          retryCount: 0
        });
        setLogs(prev => [...prev, { ...logToSave, id: localId, _pending: true }]);
      }
      
      setPendingOps(getQueue());
      showAlert("Guardado Offline", "El vuelo se agregó a la cola de sincronización.", 'info');
      setEditingId(null);
      setFormData(getInitialFormState());
      setActiveTab('historial');
      return;
    }

    // Verificación de límites
    if (!editingId && logs.length >= 500) {
      showAlert("Límite Alcanzado", "Llegaste a 500 registros. Por favor restablece tu base de datos.", 'danger');
      return;
    }

    if (!editingId && logs.length >= 420) {
      askConfirm(
        "Límite de Capacidad",
        `Aviso: Estás próximo a alcanzar el límite de 500 registros (tienes ${logs.length}). Al llegar a 500 no podrás guardar más vuelos hasta restablecer la base de datos. ¿Deseas continuar?`,
        performSave,
        'warning'
      );
      return;
    }

    try {
      await performSave();
    } catch (error: any) {
      showAlert("Error al Guardar", error.message || 'Ocurrió un error al guardar.', 'danger');
    }
  };

  const deleteLog = async (logId: string) => {
    const log = tcpLogs.find(l => l.id === logId);
    if (!log) return;
    const fecha = new Date(log.fechaHoraSalida).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const hora = new Date(log.fechaHoraSalida).toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit'
    });
    const route = `${log.origenID} → ${log.destinoID}`;

    askConfirm(
      'Eliminar registro',
      `Fecha: ${fecha} ${hora}\nRuta: ${route}\nMatrícula: ${log.matriculaAvion}\n\n⚠️ Si el vuelo ya fue sincronizado con ANAC, deberás eliminar manualmente el registro en el portal de ANAC, ya que la app no elimina datos de ANAC.\n\n¿Estás seguro? Esta acción no se puede deshacer.`,
      async () => {
        if (!supabase) return;

        if (!navigator.onLine) {
          addToQueue({ type: 'delete', remoteId: logId, createdAt: new Date().toISOString(), retryCount: 0 });
          setLogs(prev => prev.filter(l => l.id !== logId));
          setPendingOps(getQueue());
          return;
        }

        try {
          await supabase.from('flight_logs').delete().eq('id', logId);
          setLogs(prev => prev.filter(l => l.id !== logId));
          showAlert("Eliminado", "El registro ha sido eliminado.", 'info');
          await syncProfileTotals();
        } catch (e: any) {
          showAlert("Error", e.message || 'Error al eliminar.', 'danger');
        }
      },
      'danger'
    );
  };

  const resetDatabase = async () => {
    if (!supabase || !profile || tcpLogs.length === 0) return;

    const latestLocalFlight = tcpLogs.reduce((prev, current) => {
      const d1 = new Date(prev.fechaHoraSalida).getTime();
      const d2 = new Date(current.fechaHoraSalida).getTime();
      return d2 > d1 ? current : prev;
    });

    const performReset = async () => {
      try {
        setIsSavingProfile(true);
        setSyncStatus({ message: 'Procesando totales y restableciendo base de datos...', type: 'info' });

        const logsSumDia = tcpLogs.reduce((acc, log) => acc + parseFloat(log.horasDia || '0'), 0);
        const logsSumNoche = tcpLogs.reduce((acc, log) => acc + parseFloat(log.horasNoche || '0'), 0);
        const logsSumLandings = tcpLogs.reduce((acc, log) => acc + Number(log.aterrizajes || 0), 0);
        const logsSumInstructor = tcpLogs.reduce((acc, log) => {
          if (log.tcp_instructor) return acc + parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0');
          return acc;
        }, 0);

        const newTotals: any = {
          tcp_total_dia: parseFloat((Number(profile.tcp_total_dia || 0) + logsSumDia).toFixed(1)),
          tcp_total_noche: parseFloat((Number(profile.tcp_total_noche || 0) + logsSumNoche).toFixed(1)),
          total_landings: parseFloat((Number(profile.total_landings || 0) + logsSumLandings).toFixed(1)),
          tcp_horas_instructor: parseFloat((Number(profile.tcp_horas_instructor || 0) + logsSumInstructor).toFixed(1)),
          initial_folio_number: (Number(profile.initial_folio_number) || 1) + 1,
        };
        // Tras el restablecimiento no quedan vuelos: las "Horas totales" = día + noche del perfil.
        newTotals.grand_total_hours = parseFloat((Number(newTotals.tcp_total_dia || 0) + Number(newTotals.tcp_total_noche || 0)).toFixed(1));

        const { error: updateError } = await supabase
          .from('profiles')
          .update(newTotals)
          .eq('id', profile.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('flight_logs')
          .delete()
          .eq('user_id', profile.id)
          .eq('cargoID', '5');

        if (deleteError) throw deleteError;

        setSyncStatus({ message: '¡Base de datos restablecida con éxito!', type: 'success' });
        await refreshData();
        setLogs(prev => prev.filter(l => l.cargoID !== '5'));
      } catch (err: any) {
        console.error("Reset error:", err);
        setSyncStatus({ message: 'Error: ' + err.message, type: 'error' });
      } finally {
        setIsSavingProfile(false);
      }
    };

    const confirmFinal = () => {
      askConfirm(
        "Confirmación Final",
        "Se borrarán todos los registros TCP locales y se sumarán a los totales de su perfil. Recuerde descargar sus hojas del libro en PDF antes de continuar, ya que una vez restablecida la base de datos ya no será posible. ¿Desea continuar?",
        performReset,
        'danger'
      );
    };

    if (profile.last_synced_flight_at) {
      const lastSync = new Date(profile.last_synced_flight_at).getTime();
      const lastLocal = new Date(latestLocalFlight.fechaHoraSalida).getTime();

      if (lastLocal > lastSync) {
        askConfirm(
          "Vuelos sin Sincronizar",
          "Hay registros más nuevos en tu historial que aún no han sido sincronizados con ANAC. ¿Deseas continuar con el restablecimiento de todos modos?",
          confirmFinal,
          'warning'
        );
        return;
      }
    } else {
      askConfirm(
        "Sincronización Pendiente",
        "No se encontró registro de sincronización previa con ANAC o tus registros actuales son más nuevos. ¿Deseas continuar con el restablecimiento?",
        confirmFinal,
        'warning'
      );
      return;
    }

    confirmFinal();
  };

  const editLog = (log: FlightLog) => {
    const d = new Date(log.fechaHoraSalida);
    setFormData({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      departure_time_utc: String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'),
      arrival_time_utc: (() => {
        const a = new Date(log.fechaHoraLlegada);
        return String(a.getUTCHours()).padStart(2, '0') + ':' + String(a.getUTCMinutes()).padStart(2, '0');
      })(),
      origin_ad: log.origenID,
      destination_ad: log.destinoID,
      registration: log.matriculaAvion,
      aircraft_model: log.Marca_Modelo || '',
      flight_purpose: log.finalidadID || '79',
      landings: log.aterrizajes,
      certifier_role_id: log.autoridadCertificanteID || '15',
      certifier_name: log.observaciones || '',
      folio_number: log.folio_number,
      folio_rva: log.folio_rva,
      horas_dia: parseFloat(log.horasDia || '0'),
      horas_noche: parseFloat(log.horasNoche || '0'),
      tcp_instructor: log.tcp_instructor || false,
    });
    setEditingId(log.id);
    setActiveTab('nuevo');
    window.scrollTo(0, 0);
    showAlert(
      "Precaución ANAC",
      "Recuerda volver a sincronizar con ANAC para enviar los cambios realizados en este vuelo.",
      'info'
    );
  };

  const fetchAnacLogs = async (tokenOverride?: string, sessionOverride?: any): Promise<AnacLog[] | null> => {
    const tokenToUse = tokenOverride || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) return null;
    try {
      const response = await fetch(getApiUrl('/api/get-anac-logs-tcp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anac_token: tokenToUse, storageState: sessionToUse, rowsPerPage: 100 })
      });
      if (response.ok) {
        const data = await response.json();
        return (data.dataSource as AnacLog[]) || [];
      }
      return null;
    } catch { return null; }
  };

  const compareWithAnac = async (tokenOverride?: any, sessionOverride?: any) => {
    const actualToken = typeof tokenOverride === 'string' ? tokenOverride : undefined;
    const tokenToUse = actualToken || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) {
      setSyncStatus({ message: 'Primero inicia sesión en ANAC para comparar', type: 'error' });
      setShowSyncDialog(true);
      return;
    }
    setIsComparing(true);
    setSyncStatus({ message: 'Obteniendo registros de ANAC...', type: 'info' });
    const remoteLogs = await fetchAnacLogs(tokenToUse, sessionToUse);
    setAnacLogs(remoteLogs || []);
    if (remoteLogs === null) {
      setSyncStatus({ message: 'No se pudieron obtener registros de ANAC. Verificá tu sesión.', type: 'error' });
      setIsComparing(false);
      return;
    }
    // remoteLogs puede ser [] (cuenta sin vuelos en ANAC) → se procede: todos van como "nuevos"

    const missing: FlightLog[] = [];
    const updates: { log: FlightLog; vueloTripulanteID: number; diffs: string[] }[] = [];
    const matchedIds: { logId: string; vueloTripulanteID: number }[] = [];
    const matchedPairs: { localLog: FlightLog; matched: any }[] = [];

    logs.forEach(localLog => {
      try {
        const localStart = new Date(localLog.fechaHoraSalida).toISOString().substring(0, 16);
        const localEnd = new Date(localLog.fechaHoraLlegada).toISOString().substring(0, 16);
        const localMat = normalizeMatCompare(localLog.matriculaAvion);

        const anacId = Number((localLog as any).anac_vuelo_id) || 0;
        let matched = anacId ? remoteLogs.find(r => Number(r.vueloTripulanteID) === anacId) : undefined;

        if (!matched) {
          matched = remoteLogs.find(remoteLog => {
            const remoteStart = (remoteLog.fechaSalida || "").substring(0, 16);
            const remoteEnd = (remoteLog.fechaLlegada || "").substring(0, 16);
            const remoteMat = normalizeMatCompare(remoteLog.matricula);
            const matchTime = localStart === remoteStart && localEnd === remoteEnd;
            const matchMat = localMat === remoteMat || !localMat || !remoteMat;
            return matchTime && matchMat;
          });
        }
        if (!matched) {
          matched = findSecondaryMatch(localLog, remoteLogs);
        }

        if (matched) {
          const id = Number(matched.vueloTripulanteID) || 0;
          if (id) matchedIds.push({ logId: localLog.id, vueloTripulanteID: id });
          if (id) {
            const diffs = listFlightDiffs(localLog, matched);
            if (diffs.length > 0) {
              updates.push({ log: localLog, vueloTripulanteID: id, diffs: describeFlightDiffs(localLog, matched) });
            }
            matchedPairs.push({ localLog, matched });
          }
        } else {
          missing.push(localLog);
        }
      } catch {
        missing.push(localLog);
      }
    });

    // Pasada con detalle Get?id= para vuelos matcheados NO marcados por el listado:
    // GetPagedList no expone horas/observaciones/autoridad → compararlos con el detalle.
    {
      const flaggedIds = new Set(updates.map(u => u.log.id));
      const toDetail = matchedPairs.filter(p => !flaggedIds.has(p.localLog.id));
      if (toDetail.length > 0) {
        setSyncStatus({ message: 'Verificando detalles con ANAC...', type: 'info' });
        const detailCache = new Map<number, any>();
        await runConcurrent(toDetail, 5, async (pair) => {
          const id = Number(pair.matched.vueloTripulanteID) || 0;
          if (!id) return;
          try {
            const res = await fetch(getApiUrl('/api/get-anac-log-detail'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ anac_token: tokenToUse, storageState: sessionToUse, vueloTripulanteID: id }),
            });
            if (res.ok) detailCache.set(id, await res.json());
          } catch {}
        });
        for (const { localLog, matched } of toDetail) {
          const id = Number(matched.vueloTripulanteID) || 0;
          const merged = mergeAnacDetail(matched, detailCache.get(id));
          const diffs = listFlightDiffs(localLog, merged);
          if (diffs.length > 0) {
            updates.push({ log: localLog, vueloTripulanteID: id, diffs: describeFlightDiffs(localLog, merged) });
          }
        }
      }
    }

    setPendingLogs(missing);
    setPendingUpdates(updates);
    setIsComparing(false);

    // Backfill best-effort de anac_vuelo_id (vuelos que ya existen en ANAC)
    const backfillPromises = matchedIds
      .filter(({ logId }) => {
        const current = logs.find(l => l.id === logId) as any;
        return Number(current?.anac_vuelo_id) !== matchedIds.find(m => m.logId === logId)?.vueloTripulanteID;
      })
      .map(({ logId, vueloTripulanteID }) =>
        supabase.from('flight_logs').update({ anac_vuelo_id: vueloTripulanteID }).eq('id', logId)
      );
    if (backfillPromises.length > 0) {
      Promise.all(backfillPromises).then(() => refreshData()).catch(() => {});
    }

    const totalPending = missing.length + updates.length;
    if (totalPending === 0) {
      setSyncStatus({ message: 'Todos tus vuelos ya están en el portal de ANAC.', type: 'success' });

      if (logs.length > 0 && profile?.id) {
        const latestFlight = logs.reduce((prev, current) => {
          const d1 = new Date(prev.fechaHoraSalida).getTime();
          const d2 = new Date(current.fechaHoraSalida).getTime();
          return d2 > d1 ? current : prev;
        });

        try {
          await supabase
            .from('profiles')
            .update({ last_synced_flight_at: latestFlight.fechaHoraSalida })
            .eq('id', profile.id);

          refreshData();
        } catch (err) {
          console.error("Error silencioso actualizando última sincronización:", err);
        }
      }
    } else if (updates.length === 0) {
      setSyncStatus({ message: `Se encontraron ${missing.length} vuelos pendientes de sincronizar.`, type: 'info' });
    } else if (missing.length === 0) {
      setSyncStatus({ message: `Se encontraron ${updates.length} vuelos con cambios para actualizar en ANAC.`, type: 'info' });
    } else {
      setSyncStatus({ message: `Se encontraron ${missing.length} vuelos nuevos y ${updates.length} para actualizar.`, type: 'info' });
    }
    setShowPendingModal(true);
  };

  // Auditoría de duplicados en ANAC: agrupa los registros remotos por
  // fechaHoraSalida+Llegada+matrícula y reporta los grupos con más de 1 registro.
  // Detecta grupos duplicados en ANAC (misma fecha+matrícula). Devuelve los grupos con >1 registro.
  const detectAnacDuplicates = (remoteLogs: any[]): any[][] => {
    const groups = new Map<string, any[]>();
    remoteLogs.forEach((r: any) => {
      const k = `${(r.fechaSalida || '').substring(0, 16)}|${(r.fechaLlegada || '').substring(0, 16)}|${normalizeMatCompare(r.matricula)}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    });
    return Array.from(groups.values()).filter(g => g.length > 1);
  };

  const handleSyncANAC = async (tokenOverride?: string, sessionOverride?: any, logsToSyncOverride?: FlightLog[]) => {
    const actualToken = typeof tokenOverride === 'string' ? tokenOverride : undefined;
    const tokenToUse = actualToken || anacToken;
    const sessionToUse = sessionOverride || anacSession;
    if (!tokenToUse && !sessionToUse) {
      setSyncStatus({ message: 'Primero inicia sesión en ANAC', type: 'error' });
      return;
    }
    setIsSyncing(true);

    const allLogs = (logsToSyncOverride || pendingLogs).map(log => ({
      id: log.id,
      fechaHoraSalida: log.fechaHoraSalida,
      fechaHoraLlegada: log.fechaHoraLlegada,
      origenID: log.origenID,
      destinoID: log.destinoID,
      finalidadID: log.finalidadID,
      matriculaAvion: log.matriculaAvion,
      horasDia: log.horasDia,
      horasNoche: log.horasNoche,
      aterrizajes: log.aterrizajes,
      autoridadCertificanteID: log.autoridadCertificanteID,
      observaciones: log.observaciones,
    }));

    const BATCH_SIZE = 20;
    const edits = pendingUpdates || [];
    const totalToProcess = allLogs.length + edits.length;
    let successfulIds = new Set<string>();
    let updatedIds = new Set<string>();
    let editErrors = 0;
    let batchIndex = 0;

    try {
      // FASE 1: Crear vuelos nuevos (igual que antes)
      for (let i = 0; i < allLogs.length; i += BATCH_SIZE) {
        batchIndex++;
        const batch = allLogs.slice(i, i + BATCH_SIZE);
        const processedSoFar = successfulIds.size;

        setSyncStatus({
          message: `Sincronizando lote ${batchIndex}/${Math.ceil(allLogs.length / BATCH_SIZE)} (${processedSoFar}/${allLogs.length} nuevos)`,
          type: 'info',
          progress: processedSoFar / totalToProcess
        });

        let attempts = 0;
        const maxAttempts = 3;
        let batchOk = false;

        while (!batchOk && attempts < maxAttempts) {
          attempts++;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 180000);
          try {
            const response = await fetch(getApiUrl('/api/sync-anac-tcp'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: profile?.id,
                anac_token: tokenToUse,
                storageState: sessionToUse,
                logs_to_sync: batch
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error del servidor');

            if (result.results) {
              result.results.forEach((r: any) => {
                if (r.status === 'success' || r.status === 'already_exists') successfulIds.add(r.id);
              });
            }
            batchOk = true;
          } catch (e: any) {
            clearTimeout(timeoutId);
            if (attempts >= maxAttempts) {
              console.warn(`[SYNC_TCP] Lote ${batchIndex} falló tras ${maxAttempts} intentos: ${e.message}`);
            } else {
              await new Promise(r => setTimeout(r, 3000));
            }
          }
        }
      }

      // FASE 2: Actualizar vuelos modificados en ANAC (Edit)
      if (edits.length > 0) {
        let editBatchIndex = 0;
        for (let i = 0; i < edits.length; i += BATCH_SIZE) {
          editBatchIndex++;
          const batch = edits.slice(i, i + BATCH_SIZE);
          const processedSoFar = updatedIds.size;

          setSyncStatus({
            message: `Actualizando vuelos lote ${editBatchIndex}/${Math.ceil(edits.length / BATCH_SIZE)} (${processedSoFar}/${edits.length} actualizados)`,
            type: 'info',
            progress: (successfulIds.size + processedSoFar) / totalToProcess
          });

          let attempts = 0;
          const maxAttempts = 3;
          let batchOk = false;

          while (!batchOk && attempts < maxAttempts) {
            attempts++;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 180000);
            try {
              const response = await fetch(getApiUrl('/api/edit-anac-tcp'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: profile?.id,
                  anac_token: tokenToUse,
                  storageState: sessionToUse,
                  edits: batch
                }),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || 'Error del servidor');

              if (result.results) {
                result.results.forEach((r: any) => {
                  if (r.status === 'success') {
                    updatedIds.add(r.id);
                    if (r.newVueloTripulanteID) {
                      setLogs(prev => prev.map(l => l.id === r.id ? { ...l, anac_vuelo_id: r.newVueloTripulanteID } : l));
                      (async () => { try { await supabase.from('flight_logs').update({ anac_vuelo_id: r.newVueloTripulanteID }).eq('id', r.id); } catch {} })();
                    }
                  } else if (r.status === 'error') editErrors++;
                });
              }
              batchOk = true;
            } catch (e: any) {
              clearTimeout(timeoutId);
              if (attempts >= maxAttempts) {
                console.warn(`[SYNC_TCP_EDIT] Lote ${editBatchIndex} falló tras ${maxAttempts} intentos: ${e.message}`);
              } else {
                await new Promise(r => setTimeout(r, 3000));
              }
            }
          }
        }
      }

      const finalProcessed = successfulIds.size + updatedIds.size;
      const msgEdits = edits.length > 0 ? `, ${updatedIds.size} actualizados` : '';
      const msgErrors = editErrors > 0 ? `, ${editErrors} con error` : '';
      setSyncStatus({
        message: `Sincronización completa: ${successfulIds.size} nuevos${msgEdits}${msgErrors}`,
        type: finalProcessed < totalToProcess ? 'warning' : 'success',
        progress: 1
      });

      // Re-resolver el ID de ANAC tras el sync: ANAC implementa el Edit como
      // borrar + crear (nuevo vueloTripulanteID) y responde solo 'true'.
      // Matcheamos fecha+matrícula+ruta contra el listado actual para actualizar anac_vuelo_id.
      if (finalProcessed > 0) {
        try {
          const remoteLogs = await fetchAnacLogs(tokenToUse, sessionToUse);
          if (!remoteLogs) return;
          const syncedIds = new Set<string>([...successfulIds, ...updatedIds]);
          for (const id of syncedIds) {
            const localLog = logs.find(l => l.id === id);
            if (!localLog) continue;
            const localStart = new Date(localLog.fechaHoraSalida).toISOString().substring(0, 16);
            const localEnd = new Date(localLog.fechaHoraLlegada).toISOString().substring(0, 16);
            const localMat = normalizeMatCompare(localLog.matriculaAvion);
            const localOriCodes = localAirportCodes(localLog.origenID || (localLog as any).origin_ad);
            const localDestCodes = localAirportCodes(localLog.destinoID || (localLog as any).destination_ad);
            const anacMatch = remoteLogs.find(r =>
              (r.fechaSalida || '').substring(0, 16) === localStart &&
              (r.fechaLlegada || '').substring(0, 16) === localEnd &&
              (normalizeMatCompare(r.matricula) === localMat || !localMat || !normalizeMatCompare(r.matricula)) &&
              (!localOriCodes.length || descContainsAny(r.origenDesc, localOriCodes)) &&
              (!localDestCodes.length || descContainsAny(r.destinoDesc, localDestCodes))
            );
            if (anacMatch?.vueloTripulanteID) {
              const newId = Number(anacMatch.vueloTripulanteID);
              setLogs(prev => prev.map(l => l.id === id ? { ...l, anac_vuelo_id: newId } : l));
              try { await supabase.from('flight_logs').update({ anac_vuelo_id: newId }).eq('id', id); } catch {}
            }
          }

          // Verificación automática de duplicados post-sync (transparente: solo avisa si hay)
          const dups = detectAnacDuplicates(remoteLogs);
          if (dups.length > 0) {
            const sample = dups.slice(0, 8).map(g =>
              `${(g[0].fechaSalida || '').substring(0, 16)} ${g[0].matricula} — ${g.length} registros`
            ).join('\n');
            showAlert(
              `Posibles duplicados: ${dups.length}`,
              `Se detectaron ${dups.length} grupos con más de 1 registro (misma fecha+matrícula) en ANAC:\n${sample}${dups.length > 8 ? `\n… y ${dups.length - 8} más.` : ''}`,
              'warning'
            );
          }
        } catch (e) {
          console.warn("[SYNC_TCP] Error re-resolviendo IDs ANAC:", e);
        }
      }

      // Cerrar la ventana de pendientes y avisar el resultado ANTES de updates secundarios
      setPendingLogs([]);
      setPendingUpdates([]);
      setShowPendingModal(false);
      if (finalProcessed > 0) {
        showAlert('Sincronización completada', `Se sincronizaron ${successfulIds.size} vuelos nuevos${msgEdits}${msgErrors}.`, 'info');
      }
      if (finalProcessed > 0 && profile?.id) {
        try {
          const latestFlight = logs.reduce((prev, current) => {
            const d1 = new Date(prev.fechaHoraSalida).getTime();
            const d2 = new Date(current.fechaHoraSalida).getTime();
            return d2 > d1 ? current : prev;
          });
          await supabase.from('profiles').update({ last_synced_flight_at: latestFlight.fechaHoraSalida }).eq('id', profile.id);
        } catch (err) {
          console.error("Error actualizando última sincronización:", err);
        }
        refreshData();
      }
    } catch (e: any) {
      setSyncStatus({ message: `Error: ${e.message}`, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const exportExcel = async () => {
    if (!profile) return;
    try {
      const workbook = new ExcelJS.Workbook();
      const sortedLogs = [...logs].sort((a, b) => new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime());

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
      if (pages.length === 0) pages.push([]);

      const initialDia = Number(profile.tcp_total_dia || 0);
      const initialNoche = Number(profile.tcp_total_noche || 0);
      const initialInstructor = Number(profile.tcp_horas_instructor || 0);
      const initialLandings = Number(profile.total_landings || 0);

      const getCumulativeTotals = (upToPageIndex: number) => {
        let d = initialDia;
        let n = initialNoche;
        let ins = initialInstructor;
        let l = initialLandings;
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

      const colWidths: (number | null)[] = [5, null, 6.55, 6.22, 6.66, 7.55, 4.22, 15, 10, 7, null, null, 5, 8, null, 28];

      const medRight = (c: number) => [2, 3, 7, 10, 12, 13, 15, 16].includes(c) ? 'medium' as const : 'thin' as const;
      const thinMedBottom = (isLastRow: boolean) => isLastRow ? 'medium' as const : 'thin' as const;

      pages.forEach((pageLogs, pageIndex) => {
        const sheet = workbook.addWorksheet(`FOLIO ${(profile?.initial_folio_number || 1) + pageIndex}`);
        const pageYear = pageLogs.length > 0 ? new Date(pageLogs[0].fechaHoraSalida).getUTCFullYear() : new Date().getFullYear();

        colWidths.forEach((w, i) => { if (w) sheet.getColumn(i + 1).width = w; });

        // Row 1: Header info
        sheet.getRow(1).height = 15;
        sheet.mergeCells('A1:H1');
        sheet.getCell('A1').value = `APELLIDO Y NOMBRE: ${profile?.last_name || ''}, ${profile?.first_name || ''}`;
        sheet.getCell('A1').font = { bold: true, size: 10 };

        sheet.mergeCells('I1:M1');
        sheet.getCell('I1').value = 'CERTIFICADO DE COMPETENCIA: TCP';
        sheet.getCell('I1').font = { bold: true, size: 9 };

        sheet.mergeCells('N1:O1');
        sheet.getCell('N1').value = `LEGAJO: ${profile?.legajo || ''}`;
        sheet.getCell('N1').font = { bold: true, size: 9 };
        sheet.getCell('N1').alignment = { horizontal: 'center' };
        sheet.getCell('N1').border = { right: { style: 'medium' } };

        sheet.getCell('P1').value = `FOLIO N° ${(profile?.initial_folio_number || 1) + pageIndex}`;
        sheet.getCell('P1').font = { bold: true, size: 9 };

        // Row 2: Category headers
        sheet.getRow(2).height = 24.6;
        sheet.mergeCells('A2:B2');
        sheet.getCell('A2').value = `AÑO\n${pageYear}`;
        sheet.getCell('A2').font = { bold: true, size: 8 };
        sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        sheet.mergeCells('C2:F2');
        sheet.getCell('C2').value = 'ITINERARIO';
        sheet.getCell('C2').font = { bold: true, size: 8 };
        sheet.getCell('C2').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('G2:G3');
        sheet.getCell('G2').value = 'FINALIDAD DEL VUELO';
        sheet.getCell('G2').font = { bold: true, size: 7 };
        sheet.getCell('G2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, textRotation: 90 };

        sheet.mergeCells('H2:J2');
        sheet.getCell('H2').value = 'AERONAVES UTILIZADAS';
        sheet.getCell('H2').font = { bold: true, size: 8 };
        sheet.getCell('H2').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('K2:L2');
        sheet.getCell('K2').value = 'TIEMPOS DE VUELO';
        sheet.getCell('K2').font = { bold: true, size: 8 };
        sheet.getCell('K2').alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.mergeCells('M2:M3');
        sheet.getCell('M2').value = 'ATERRIZAJES';
        sheet.getCell('M2').font = { bold: true, size: 7 };
        sheet.getCell('M2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, textRotation: 90 };

        sheet.mergeCells('N2:O2');
        sheet.getCell('N2').value = 'DISCRIMINACION DE TIEMPOS DE VUELO';
        sheet.getCell('N2').font = { bold: true, size: 7 };
        sheet.getCell('N2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        sheet.mergeCells('P2:P3');
        sheet.getCell('P2').value = 'CERTIFICACIONES';
        sheet.getCell('P2').font = { bold: true, size: 7 };
        sheet.getCell('P2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Unified row 2 borders: medium top edge-to-edge, thin sides/bottom
        for (let c = 1; c <= 16; c++) {
          const cell = sheet.getCell(2, c);
          cell.border = {
            left: { style: c === 1 || c === 7 || c === 13 ? 'medium' : c === 3 || c === 8 || c === 11 || c === 14 ? 'thin' : undefined },
            right: { style: c === 2 || c === 7 || c === 10 || c === 12 || c === 13 || c === 15 || c === 16 ? 'medium' : c === 6 || c === 11 ? 'thin' : undefined },
            top: { style: 'medium' },
            bottom: { style: c === 7 || c === 13 || c === 16 ? 'medium' : 'thin' },
          };
        }

        // Row 3: Column labels
        sheet.getRow(3).height = 52.8;
        const subHeaderData: { label: string; col: number; medRight: boolean }[] = [
          { label: 'DIA', col: 1, medRight: false },
          { label: 'MES', col: 2, medRight: true },
          { label: 'HORA DE SALIDA', col: 3, medRight: true },
          { label: 'DESDE', col: 4, medRight: false },
          { label: 'HASTA', col: 5, medRight: false },
          { label: 'HORA DE LLEGADA', col: 6, medRight: false },
          { label: 'MARCA', col: 8, medRight: false },
          { label: 'MATRÍCULA', col: 9, medRight: false },
          { label: 'FOLIO RAV', col: 10, medRight: true },
          { label: 'DE DÍA', col: 11, medRight: false },
          { label: 'NOCHE', col: 12, medRight: true },
          { label: 'INSTRUCTOR DE TCP', col: 14, medRight: false },
          { label: 'TIPO DE AERONAVE', col: 15, medRight: true },
        ];

        subHeaderData.forEach(({ label, col }) => {
          const cell = sheet.getCell(3, col);
          cell.value = label;
          cell.font = { bold: true, size: 7 };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        // Apply row 3 borders
        for (let c = 1; c <= 16; c++) {
          const cell = sheet.getCell(3, c);
          const isMed = medRight(c);
          cell.border = {
            left: { style: c === 1 ? 'medium' : c === 7 || c === 13 ? 'medium' : 'thin' },
            right: { style: isMed ? 'medium' : c === 6 || c === 7 || c === 13 || c === 16 ? undefined : 'thin' },
            top: { style: 'thin' },
            bottom: { style: 'medium' },
          };
        }

        // Ensure all row 3 cells have vertical center alignment
        for (let c = 1; c <= 16; c++) {
          sheet.getCell(3, c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }

        // Data start position
        const dataStartRow = 4;
        const hasAnterior = pageIndex > 0;

        // TOTALES PAGINA ANTERIOR row (only if pageIndex > 0)
        if (hasAnterior) {
          const anterior = getCumulativeTotals(pageIndex);
          const r = dataStartRow;
          sheet.mergeCells(r, 1, r, 10);
          const c = sheet.getCell(r, 1);
          c.value = `TOTALES PAGINA ANTERIOR -------------------------------------------------------------------------------->`;
          c.font = { bold: true, size: 7 };
          c.alignment = { horizontal: 'right', vertical: 'middle' };
          sheet.getCell(r, 11).value = parseFloat(anterior.dia.toFixed(1));
          sheet.getCell(r, 12).value = parseFloat(anterior.noche.toFixed(1));
          sheet.getCell(r, 13).value = anterior.landings;
          sheet.getCell(r, 14).value = parseFloat(anterior.instructor.toFixed(1));
          sheet.getCell(r, 16).value = `${parseFloat(anterior.dia.toFixed(1))}    Total horas de vuelo de la pagina anterior`;
          for (let c2 = 1; c2 <= 16; c2++) {
            const cell = sheet.getCell(r, c2);
            cell.font = { size: 7 };
            cell.border = {
              left: { style: 'thin' },
              right: { style: c2 === 16 ? 'thin' : medRight(c2) },
              top: { style: 'thin' },
              bottom: { style: 'medium' },
            };
          }
        }

        // Data rows
        const dataOffset = hasAnterior ? dataStartRow + 1 : dataStartRow;
        pageLogs.forEach((log, idx) => {
          const r = dataOffset + idx;
          const d = new Date(log.fechaHoraSalida);
          const a = new Date(log.fechaHoraLlegada);
          const hDia = parseFloat(log.horasDia || '0');
          const hNoche = parseFloat(log.horasNoche || '0');
          const instructorHrs = log.tcp_instructor ? (hDia + hNoche) : 0;
          const finSigla = FLIGHT_PURPOSES.find((p: any) => p.key === log.finalidadID)?.sigla || log.finalidadID;

          const rowData = [
            d.getUTCDate(), d.getUTCMonth() + 1,
            `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
            log.origenID, log.destinoID,
            `${String(a.getUTCHours()).padStart(2, '0')}:${String(a.getUTCMinutes()).padStart(2, '0')}`,
            finSigla, log.Marca_Modelo || '', log.matriculaAvion, log.folio_rva ?? '',
            hDia, hNoche, log.aterrizajes, instructorHrs || '', log.Marca_Modelo || '',
            log.observaciones || ''
          ];

          rowData.forEach((val, c) => {
            const cell = sheet.getCell(r, c + 1);
            cell.value = val;
            cell.font = { size: 7 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            const isFirstDataRow = r === dataOffset;
            cell.border = {
              left: { style: c + 1 === 1 ? 'medium' : c + 1 === 7 || c + 1 === 13 ? 'medium' : 'thin' },
              right: { style: c + 1 === 6 ? undefined : c + 1 === 16 ? 'medium' : medRight(c + 1) },
              top: { style: isFirstDataRow && c + 1 === 7 ? 'medium' : 'thin' },
              bottom: { style: 'thin' },
            };
          });
        });

        // Empty rows to fill up to rowsPerPage
        const emptyCount = rowsPerPage - pageLogs.length;
        for (let e = 0; e < emptyCount; e++) {
          const r = dataOffset + pageLogs.length + e;
          const isLastDataRow = e === emptyCount - 1;
          for (let c = 1; c <= 16; c++) {
            const cell = sheet.getCell(r, c);
            cell.value = '';
            cell.font = { size: 7 };
            cell.border = {
              left: { style: c === 1 ? 'medium' : c === 7 || c === 13 ? 'medium' : 'thin' },
              right: { style: c === 6 ? undefined : c === 16 ? 'medium' : medRight(c) },
              top: { style: 'thin' },
              bottom: { style: isLastDataRow ? 'medium' : 'thin' },
            };
          }
        }

        // TOTAL HORAS DE VUELO A LA PAGINA SIGUIENTE row
        const siguiente = getCumulativeTotals(pageIndex + 1);
        const totalR = dataOffset + rowsPerPage;
        sheet.mergeCells(totalR, 1, totalR, 10);
        const tc = sheet.getCell(totalR, 1);
        tc.value = `TOTAL HORAS DE VUELO A LA PAGINA SIGUIENTE >`;
        tc.font = { bold: true, size: 7 };
        tc.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet.getCell(totalR, 11).value = parseFloat(siguiente.dia.toFixed(1));
        sheet.getCell(totalR, 12).value = parseFloat(siguiente.noche.toFixed(1));
        sheet.getCell(totalR, 13).value = siguiente.landings;
        sheet.getCell(totalR, 14).value = parseFloat(siguiente.instructor.toFixed(1));
        sheet.getCell(totalR, 15).value = '';
        sheet.getCell(totalR, 16).value = `${parseFloat(siguiente.dia.toFixed(1))}    Total horas de vuelo de la pagina siguiente`;

        const totalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF5F5F5' } };
        for (let c = 1; c <= 16; c++) {
          const cell = sheet.getCell(totalR, c);
          cell.font = { bold: true, size: 7 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = totalFill;
          cell.border = {
            left: { style: 'thin' },
            right: { style: c === 16 ? 'thin' : c === 15 ? 'thin' : medRight(c) },
            top: { style: 'medium' },
            bottom: { style: 'thin' },
          };
        }

        // Total row height
        sheet.getRow(totalR).height = 15;

        // Footer
        const footerR = totalR + 1;
        sheet.mergeCells(footerR, 1, footerR, 16);
        sheet.getCell(footerR, 1).value = 'APROBADO POR DISPOSICIÓN 278/03 DHA';
        sheet.getCell(footerR, 1).font = { size: 8 };

        // Signature (last page only)
        if (pageIndex === pages.length - 1) {
          const sigLineR = footerR + 2;
          sheet.mergeCells(sigLineR, 13, sigLineR, 16);
          sheet.getCell(sigLineR, 13).border = { top: { style: 'thin' } };

          const sigTextR = sigLineR + 1;
          sheet.mergeCells(sigTextR, 13, sigTextR, 16);
          sheet.getCell(sigTextR, 13).value = 'FIRMA DEL TITULAR';
          sheet.getCell(sigTextR, 13).font = { bold: true, size: 8 };
          sheet.getCell(sigTextR, 13).alignment = { horizontal: 'center' };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `libro_vuelo_tcp_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e: any) {
      showAlert("Error al exportar", e.message, 'danger');
    }
  };

  const exportPDFBlob = async () => {
    try {
      const blob = await pdf(<FlightLogTcpPDF logs={logs} profile={profile} />).toBlob();
      saveAs(blob, `libro_vuelo_tcp_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e: any) {
      showAlert("Error al exportar PDF", e.message, 'danger');
    }
  };

  const tcpLogs = useMemo(() => logs.filter(l => l.cargoID === '5'), [logs]);

  const totalDayHours = tcpLogs.reduce((acc, log) => acc + parseFloat(log.horasDia || '0'), 0);
  const totalNightHours = tcpLogs.reduce((acc, log) => acc + parseFloat(log.horasNoche || '0'), 0);
  const totalLandings = tcpLogs.reduce((acc, log) => acc + Number(log.aterrizajes || 0), 0);
  const totalInstructorHours = tcpLogs.reduce((acc, log) => {
    if (log.tcp_instructor) return acc + parseFloat(log.horasDia || '0') + parseFloat(log.horasNoche || '0');
    return acc;
  }, 0);

  const initialDia = Number(profile?.tcp_total_dia || 0);
  const initialNoche = Number(profile?.tcp_total_noche || 0);
  const initialLandings = Number(profile?.total_landings || 0);
  const initialInstructor = Number(profile?.tcp_horas_instructor || 0);

  const grandTotalDia = totalDayHours + initialDia;
  const grandTotalNoche = totalNightHours + initialNoche;
  const grandTotalInstructor = totalInstructorHours + initialInstructor;
  const grandTotalLandings = totalLandings + initialLandings;

  const chartData = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const data = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const monthLogs = tcpLogs.filter(log => {
        const dateStr = log.fechaHoraSalida;
        if (!dateStr) return false;
        const date = new Date(dateStr);
        return (date.getUTCMonth() + 1) === m && date.getUTCFullYear() === y;
      });
      const day = monthLogs.reduce((acc, log) => acc + parseFloat(log.horasDia || '0'), 0);
      const night = monthLogs.reduce((acc, log) => acc + parseFloat(log.horasNoche || '0'), 0);
      data.push({ name: months[d.getMonth()], diurna: day, nocturna: night, total: day + night });
    }
    return data;
  }, [tcpLogs]);

  const handleLogout = async () => {
    localStorage.removeItem('arms_saved_username');
    localStorage.removeItem('arms_saved_password');
    await supabase?.auth.signOut();
  };

  const updateProfile = async () => {
    if (!supabase || !profile) return;
    setIsSavingProfile(true);
    try {
      const dataToUpsert = {
        ...profile,
        id: userId,
        tcp_total_dia: Number(profile.tcp_total_dia || 0),
        tcp_total_noche: Number(profile.tcp_total_noche || 0),
        total_landings: Number(profile.total_landings || 0),
        tcp_horas_instructor: Number(profile.tcp_horas_instructor || 0),
      };
      const { error } = await supabase.from('profiles').upsert(dataToUpsert, { onConflict: 'id' });
      if (error) throw error;
      await refreshData();
      showAlert("Perfil Actualizado", "Los cambios han sido guardados.", 'info');
    } catch (error: any) {
      showAlert("Error", error.message || 'Error al guardar.', 'danger');
    }
    setIsSavingProfile(false);
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 bg-slate-50 dark:bg-[#101622] pt-4 px-4">
      <div className="max-w-lg mx-auto w-full space-y-4">
        {pendingOps.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl">
            <div className="flex items-center gap-2">
              {isOnline ? <CloudOff size={16} className="text-amber-600 dark:text-amber-400" /> : <WifiOff size={16} className="text-amber-600 dark:text-amber-400" />}
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                {pendingOps.length} {pendingOps.length === 1 ? 'cambio pendiente' : 'cambios pendientes'} {isOnline ? '' : '— Sin conexión'}
              </span>
            </div>
            {isOnline && (
              <button onClick={processQueue} disabled={isSyncingQueue} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50">
                {isSyncingQueue ? 'Sincronizando...' : 'Sincronizar ahora'}
              </button>
            )}
          </div>
        )}

        {!isOnline && pendingOps.length === 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl">
            <WifiOff size={14} className="text-slate-400" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Sin conexión a internet</span>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-4 sticky top-0 z-10 bg-white/50 dark:bg-[#1a2233]/50 backdrop-blur-md">
            <TabsTrigger value="dashboard" className="flex items-center gap-2 text-xs">
              <BarChart3 size={14} /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="nuevo" className="flex items-center gap-2 text-xs">
              <Plus size={14} /> Nuevo
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2 text-xs">
              <History size={14} /> Historial
            </TabsTrigger>
            <TabsTrigger value="perfil" className="flex items-center gap-2 text-xs">
              <User size={14} /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 m-0">
            {/* ANAC Sync Card */}
            <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 shadow-sm">
              <CardContent className="pt-4 px-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Globe size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white">Sincronización ANAC</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Carga tus vuelos automáticamente al sistema oficial.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 gap-2 h-9 shadow-md"
                      onClick={() => compareWithAnac()}
                      disabled={isComparing || isSyncing}
                    >
                      <RefreshCw size={14} className={isComparing || isSyncing ? "animate-spin" : ""} />
                      Sincronizar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">3- DETALLE PARA DDJJ DE HORAS DE VUELO</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Los totales en esta sección pueden ser utilizados para compararlos con el 3- DDJJ de horas de vuelo en el portal de ANAC</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700">
                <CardContent className="p-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">Horas Día</p>
                  <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{totalDayHours.toFixed(1)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 border-indigo-200 dark:border-indigo-700">
                <CardContent className="p-4">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Horas Noche</p>
                  <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{totalNightHours.toFixed(1)}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-700">
                <CardContent className="p-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Aterrizajes</p>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{totalLandings}</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700">
                <CardContent className="p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Instructor TCP</p>
                  <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{totalInstructorHours.toFixed(1)}</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Horas Últimos 3 Meses</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="diurna" fill="#3b82f6" name="Diurna" stackId="a" />
                    <Bar dataKey="nocturna" fill="#6366f1" name="Nocturna" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Últimos Registros</h3>
              {[...tcpLogs].sort((a, b) => {
                const dateA = new Date(a.fechaHoraSalida).getTime();
                const dateB = new Date(b.fechaHoraSalida).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
              }).slice(0, 3).map((log) => (
                <Card key={log.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <PlaneTakeoff size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const depISO = log.fechaHoraSalida || '';
                          const arrISO = log.fechaHoraLlegada || '';
                          const date = depISO ? new Date(depISO) : null;
                          return (
                            <>
                              <div className="font-semibold text-sm">
                                {log.origenID || (log as any).origin_ad || '---'} → {log.destinoID || (log as any).destination_ad || '---'}
                              </div>
                              <div className="text-[10px] flex items-center gap-2 mt-1">
                                <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                  {depISO ? depISO.slice(11, 16) : ((log as any).departure_time_utc || '--:--')}
                                </span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                                  {arrISO ? arrISO.slice(11, 16) : ((log as any).arrival_time_utc || '--:--')}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">
                                  {date ? `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}` : '--/--/--'}
                                  {' • '}{log.matriculaAvion || (log as any).registration || 'S/M'}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {FLIGHT_PURPOSES.find((f: any) => f.key === String(log.finalidadID))?.sigla || log.tipoVueloID || 'VUELO'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {tcpLogs.length === 0 && (
                <div className="text-center py-6">
                  <FileText size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-slate-400">No hay vuelos registrados aún</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="nuevo">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{editingId ? 'Editar Vuelo TCP' : 'Nuevo Vuelo TCP'}</CardTitle>
                <CardDescription className="text-xs">Completá los datos del vuelo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">DÍA</Label>
                    <Input type="number" min={1} max={31} className="h-8 text-xs" value={formData.day} onChange={e => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">MES</Label>
                    <Input type="number" min={1} max={12} className="h-8 text-xs" value={formData.month} onChange={e => setFormData({ ...formData, month: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">AÑO</Label>
                    <Input type="number" min={2020} max={2030} className="h-8 text-xs" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) || 2026 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">HORA SALIDA (UTC)</Label>
                    <Input type="time" className="h-8 text-xs" value={formData.departure_time_utc} onChange={e => setFormData({ ...formData, departure_time_utc: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HORA LLEGADA (UTC)</Label>
                    <Input type="time" className="h-8 text-xs" value={formData.arrival_time_utc} onChange={e => setFormData({ ...formData, arrival_time_utc: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ORIGEN</Label>
                    <AirportAutocomplete id="origin_ad" value={formData.origin_ad} onChange={(v: string) => setFormData({ ...formData, origin_ad: v })} IATA_LIST={IATA_LIST} placeholder="Código aeropuerto" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">DESTINO</Label>
                    <AirportAutocomplete id="destination_ad" value={formData.destination_ad} onChange={(v: string) => setFormData({ ...formData, destination_ad: v })} IATA_LIST={IATA_LIST} placeholder="Código aeropuerto" />
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 gap-2 text-[10px]"
                  onClick={importFromRoster}
                >
                  <CalendarSync size={14} />
                  Importar horario del roster
                </Button>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">MATRÍCULA</Label>
                    <Input 
                      className="h-8 text-xs uppercase" 
                      placeholder="LV-KCE" 
                      maxLength={10} 
                      list="tcp-registrations-list"
                      value={formData.registration} 
                      onChange={e => setFormData({ ...formData, registration: e.target.value.toUpperCase() })} 
                    />
                    <datalist id="tcp-registrations-list">
                      {Array.from(new Set(tcpLogs.map(log => log.matriculaAvion || (log as any).registration).filter(Boolean))).sort().map(reg => (
                        <option key={reg} value={reg} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">MARCA / MODELO</Label>
                    <Input className="h-8 text-xs" placeholder="BO 737-8Q8" value={formData.aircraft_model} onChange={e => setFormData({ ...formData, aircraft_model: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">FOLIO RAV</Label>
                    <Input type="text" inputMode="numeric" className="h-8 text-xs" placeholder="N° del otro libro" value={formData.folio_rva ?? ''} onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, folio_rva: val === '' ? null : parseInt(val) });
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">FINALIDAD</Label>
                    <select className="h-8 text-xs w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2" value={formData.flight_purpose} onChange={e => setFormData({ ...formData, flight_purpose: e.target.value })}>
                      {FLIGHT_PURPOSES.map(p => <option key={p.key} value={p.key}>{p.sigla} - {p.value}</option>)}
                    </select>
                  </div>
                </div>

                <Separator />

                <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock size={14} /> TIEMPOS DE VUELO (Horas Decimales)
                  </div>
                  {formData.departure_time_utc && formData.arrival_time_utc && (
                    <div className="bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-200 dark:border-blue-800">
                      Total: {calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc)} hs
                    </div>
                  )}
                </h4>

                {(() => {
                  const totalRef = parseFloat(calculateDecimalDuration(formData.departure_time_utc, formData.arrival_time_utc) || '0');
                  const currentSum = Number(formData.horas_dia || 0) + Number(formData.horas_noche || 0);
                  if (currentSum > (totalRef + 0.01)) {
                    return (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg flex gap-3">
                        <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0" />
                        <div className="space-y-1">
                          <h5 className="text-[11px] font-bold text-amber-800 dark:text-amber-200">Exceso en Horas</h5>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
                            La suma de horas día y noche ({currentSum.toFixed(1)} hs) excede el total del vuelo ({totalRef.toFixed(1)} hs). Verifique los datos.
                          </p>
                        </div>
                      </motion.div>
                    );
                  }
                  return null;
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">HORAS DÍA</Label>
                    <DecimalInput className="h-8 text-xs" value={formData.horas_dia} onChange={(e: any) => setFormData({ ...formData, horas_dia: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">HORAS NOCHE</Label>
                    <DecimalInput className="h-8 text-xs" value={formData.horas_noche} onChange={(e: any) => setFormData({ ...formData, horas_noche: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ATERRIZAJES</Label>
                    <Input type="number" min={0} className="h-8 text-xs" value={formData.landings} onChange={e => setFormData({ ...formData, landings: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={formData.tcp_instructor} onCheckedChange={(v) => setFormData({ ...formData, tcp_instructor: v === true })} />
                      <span className="text-xs font-medium">INSTRUCTOR TCP</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">AUTORIDAD CERTIFICANTE</Label>
                    <select className="h-8 text-xs w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2" value={formData.certifier_role_id} onChange={e => setFormData({ ...formData, certifier_role_id: e.target.value })}>
                      {CERTIFIER_ROLES.map(r => <option key={r.key} value={r.key}>{r.value}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">NOMBRE CERTIFICANTE</Label>
                    <Input className="h-8 text-xs" placeholder="Nombre del certificante" value={formData.certifier_name} onChange={e => setFormData({ ...formData, certifier_name: e.target.value })} />
                  </div>
                </div>

                <Button className="w-full h-10 bg-blue-600 hover:bg-blue-700" onClick={saveLog}>
                  <Save size={16} className="mr-2" />{editingId ? 'Actualizar Vuelo' : 'Guardar Vuelo'}
                </Button>
                {editingId && (
                  <Button variant="outline" className="w-full h-10" onClick={() => { setEditingId(null); setFormData(getInitialFormState()); setActiveTab('historial'); }}>
                    Cancelar Edición
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial">
            <div className="px-1 space-y-2">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-center">REGISTRO DE VUELOS TCP</h3>
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-2 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  disabled={tcpLogs.length === 0}
                  onClick={async () => {
                    try {
                      const blob = await pdf(<FlightLogTcpPDF logs={tcpLogs} profile={profile} />).toBlob();
                      saveAs(blob, `libro_vuelo_tcp_${new Date().toISOString().split('T')[0]}.pdf`);
                    } catch (e: any) { showAlert("Error", e.message, 'danger'); }
                  }}>
                  <FileDown size={14} /> Generar PDF
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={exportExcel} disabled={tcpLogs.length === 0}>
                  <FileDown size={14} /> EXCEL
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleImportClick}>
                  <Upload size={14} /> Importar Excel
                </Button>
              </div>
            </div>

            <Card className="overflow-hidden">
              <ScrollArea className="h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Ruta</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...tcpLogs].sort((a, b) => {
                      const dateA = new Date(a.fechaHoraSalida).getTime();
                      const dateB = new Date(b.fechaHoraSalida).getTime();
                      if (dateA !== dateB) return dateB - dateA;
                      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    }).map((log) => {
                      const isPending = (log as any)._pending === true;
                      const d = new Date(log.fechaHoraSalida);
                      return (
                      <TableRow key={log.id} className={isPending ? 'opacity-60' : ''}>
                        <TableCell className="text-xs font-medium">
                          <div className="flex items-center gap-1.5">
                            {isPending && <Clock size={12} className="text-amber-500 shrink-0" title="Pendiente de sincronización" />}
                            {`${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear().toString().slice(-2)}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-bold">
                            {log.origenID} → {log.destinoID}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                              {log.fechaHoraSalida?.slice(11, 16) || '--:--'}
                            </span>
                            <span className="text-[10px] opacity-30">|</span>
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                              {log.fechaHoraLlegada?.slice(11, 16) || '--:--'}
                            </span>
                            <span className="text-[10px] opacity-60 uppercase ml-1">
                              {log.matriculaAvion}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(Number(log.horasDia || 0) + Number(log.horasNoche || 0)).toFixed(1)}h
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => editLog(log)}>
                              <Edit2 size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteLog(log.id)}>
                              <X size={14} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                    })}
                  </TableBody>
                </Table>
                {tcpLogs.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <History size={40} className="mx-auto mb-4" />
                    <p>No hay historial registrado</p>
                  </div>
                )}
              </ScrollArea>
            </Card>
            {/* Botón Restablecer al final del historial */}
            <div className="pt-6 pb-2 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 gap-2 h-10 px-4 font-bold transition-all duration-200"
                onClick={resetDatabase}
                disabled={tcpLogs.length === 0}
              >
                <RefreshCw size={16} className={isSavingProfile ? "animate-spin" : ""} />
                Restablecer registros
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="perfil">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User size={20} className="text-blue-600" />
                    Perfil TCP
                  </div>
                </CardTitle>
                <CardDescription>Totales iniciales que aparecerán en el encabezado de los folios PDF</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prof_email">Email (Autenticación)</Label>
                  <Input
                    id="prof_email"
                    value={profile?.email || ''}
                    disabled
                    className="bg-slate-50 dark:bg-slate-800 text-slate-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prof_cuil">CUIL</Label>
                  <Input
                    id="prof_cuil"
                    disabled
                    className="bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    value={profile?.cuil ? formatCuil(profile.cuil) : 'No cargado'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Total Inicial Horas Día</Label>
                    <DecimalInput className="h-8 text-xs" value={profile?.tcp_total_dia ?? 0} onChange={(e: any) => setProfile(prev => prev ? { ...prev, tcp_total_dia: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) } : null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Inicial Horas Noche</Label>
                    <DecimalInput className="h-8 text-xs" value={profile?.tcp_total_noche ?? 0} onChange={(e: any) => setProfile(prev => prev ? { ...prev, tcp_total_noche: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) } : null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Inicial Aterrizajes</Label>
                    <Input type="number" className="h-8 text-xs" value={profile?.total_landings ?? 0} onChange={e => setProfile(prev => prev ? { ...prev, total_landings: e.target.value === '' ? null : (parseInt(e.target.value) || 0) } : null)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Inicial Instructor TCP</Label>
                    <DecimalInput className="h-8 text-xs" value={profile?.tcp_horas_instructor ?? 0} onChange={(e: any) => setProfile(prev => prev ? { ...prev, tcp_horas_instructor: e.target.value === '' ? null : (parseFloat(e.target.value) || 0) } : null)} />
                  </div>
                </div>

                <Separator />

                <div className="p-3 bg-slate-900 dark:bg-slate-800 rounded-lg border border-slate-700">
                  <div className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2">Configuración de Folio</div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-white">Próximo Folio N° a Generar</Label>
                    <Input type="number" className="h-8 text-xs bg-slate-800 border-slate-600 text-white" placeholder="Ej: 1"
                      value={profile?.initial_folio_number ?? ''}
                      onChange={e => setProfile(prev => prev ? { ...prev, initial_folio_number: e.target.value === '' ? null : (parseInt(e.target.value) || 0) } : null)} />
                    <p className="text-[9px] text-slate-400 mt-1">Folio que se usará como base para el próximo PDF generado.</p>
                  </div>
                </div>

                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 pt-2">TUS HORAS TOTALES (horas cargadas en tu perfil + horas cargadas en la app)</p>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-xl">
                    <p className="text-xs font-bold text-emerald-600">TOTAL DÍA</p>
                    <p className="text-xl font-black text-emerald-600">{grandTotalDia.toFixed(1)}</p>
                  </div>
                  <div className="p-4 bg-indigo-600/10 border border-indigo-600/30 rounded-xl">
                    <p className="text-xs font-bold text-indigo-600">TOTAL NOCHE</p>
                    <p className="text-xl font-black text-indigo-600">{grandTotalNoche.toFixed(1)}</p>
                  </div>
                  <div className="p-4 bg-amber-600/10 border border-amber-600/30 rounded-xl">
                    <p className="text-xs font-bold text-amber-600">TOTAL ATERRIZAJES</p>
                    <p className="text-xl font-black text-amber-600">{grandTotalLandings}</p>
                  </div>
                  <div className="p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-xl">
                    <p className="text-xs font-bold text-emerald-600">TOTAL INSTRUCTOR</p>
                    <p className="text-xl font-black text-emerald-600">{grandTotalInstructor.toFixed(1)}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700" onClick={updateProfile} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Guardando...' : 'Actualizar Perfil'}
                  </Button>
                  <Separator />
                  <p className="text-xs text-slate-500 text-center">Exportar libro de vuelo</p>
                  <div className="flex gap-3">
                    <Button className="flex-1 h-12 bg-blue-600 hover:bg-blue-700" onClick={async () => {
                      try {
                        const blob = await pdf(<FlightLogTcpPDF logs={tcpLogs} profile={profile} />).toBlob();
                        saveAs(blob, `libro_vuelo_tcp_${new Date().toISOString().split('T')[0]}.pdf`);
                      } catch (e: any) { showAlert("Error", e.message, 'danger'); }
                    }}>
                      <FileText size={18} className="mr-2" />PDF
                    </Button>
                    <Button variant="outline" className="flex-1 h-12" onClick={exportExcel}>
                      <FileDown size={18} className="mr-2" />Excel
                    </Button>
                  </div>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[10px] uppercase tracking-wider text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={handleLogout}
                    disabled={loading}
                  >
                    <LogOut size={14} className="mr-1" />
                    Cerrar Sesión
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Pending Sync Modal */}
      <AnimatePresence>
        {showPendingModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a2233] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {syncStatus.type === 'success' && (pendingLogs.length + pendingUpdates.length) > 0 ? 'Vuelos Sincronizados' : 'Vuelos Pendientes'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {syncStatus.type === 'success' && (pendingLogs.length + pendingUpdates.length) > 0
                      ? 'Estos vuelos han sido subidos exitosamente al portal de ANAC.'
                      : pendingUpdates.length > 0
                        ? 'Hay vuelos nuevos y/o con cambios para sincronizar con ANAC.'
                        : 'Estos vuelos no se encontraron en el portal de ANAC.'}
                  </p>
                </div>
                <button onClick={() => setShowPendingModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <ScrollArea className="h-[350px] p-4">
                {(pendingLogs.length === 0 && pendingUpdates.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-slate-500">
                    <CheckCircle2 size={48} className="text-emerald-500" />
                    <div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">¡Todo está al día!</p>
                      <p className="text-sm mt-2">No hay nuevos vuelos ni cambios. Tus registros locales y el portal de ANAC se encuentran perfectamente sincronizados.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingLogs.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Nuevos (a crear)</p>
                        {pendingLogs.map((log) => {
                          const date = new Date(log.fechaHoraSalida);
                          return (
                            <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                              <div>
                                <div className="font-bold text-sm">{log.origenID || (log as any).origin_ad} → {log.destinoID || (log as any).destination_ad}</div>
                                <div className="text-[10px] text-slate-500">
                                  {date.getUTCDate()}/{date.getUTCMonth() + 1}/{date.getUTCFullYear()} • {log.matriculaAvion || (log as any).registration}
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/40">
                                {syncStatus.type === 'success' ? 'Sincronizado' : 'A crear'}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {pendingUpdates.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Modificados (a actualizar en ANAC)</p>
                        {pendingUpdates.map(({ log, diffs }) => {
                          const date = new Date(log.fechaHoraSalida);
                          return (
                            <div key={log.id} className="p-3 bg-amber-50/60 dark:bg-amber-900/10 rounded-xl border border-amber-200/70 dark:border-amber-900/40">
                              <div className="flex justify-between items-center gap-2">
                                <div>
                                  <div className="font-bold text-sm">{log.origenID || (log as any).origin_ad} → {log.destinoID || (log as any).destination_ad}</div>
                                  <div className="text-[10px] text-slate-500">
                                    {date.getUTCDate()}/{date.getUTCMonth() + 1}/{date.getUTCFullYear()} • {log.matriculaAvion || (log as any).registration}
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40">
                                  {syncStatus.type === 'success' ? 'Actualizado' : 'Actualizar'}
                                </Badge>
                              </div>
                              {diffs.length > 0 && (
                                <ul className="mt-1.5 space-y-0.5 border-t border-amber-200/60 dark:border-amber-900/40 pt-1.5">
                                  {diffs.map((d, i) => (
                                    <li key={i} className="text-[10px] text-amber-700 dark:text-amber-300">• {d}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {isSyncing && syncStatus.progress !== undefined && (
                <div className="px-6 py-3">
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${syncStatus.progress * 100}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center mt-1">{syncStatus.message}</p>
                </div>
              )}

              <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowPendingModal(false)}>
                  Cerrar
                </Button>
                {(pendingLogs.length + pendingUpdates.length) > 0 && syncStatus.type !== 'success' && (
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-2"
                    onClick={() => handleSyncANAC()}
                    disabled={isSyncing}
                  >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing
                      ? 'Sincronizando...'
                      : pendingUpdates.length > 0
                        ? `Sincronizar ${pendingLogs.length} nuevos + ${pendingUpdates.length} actualizar`
                        : `Sincronizar ${pendingLogs.length}`}
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm/Alert Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-[#1a2233] w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-3">
                {confirmModal.type === 'danger' && <AlertCircle className="text-red-500" size={24} />}
                {confirmModal.type === 'warning' && <AlertTriangle className="text-amber-500" size={24} />}
                {confirmModal.type === 'info' && <Info className="text-blue-500" size={24} />}
                <h3 className="font-bold text-sm">{confirmModal.title}</h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-5">{confirmModal.message}</p>
              <div className="flex gap-2">
                {confirmModal.isAlert ? (
                  <Button className="flex-1" onClick={confirmModal.onConfirm}>{confirmModal.confirmText || 'Entendido'}</Button>
                ) : (
                  <>
                    <Button variant="outline" className="flex-1" onClick={confirmModal.onCancel}>{confirmModal.cancelText || 'Cancelar'}</Button>
                    <Button className={`flex-1 ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`} onClick={confirmModal.onConfirm}>{confirmModal.confirmText || 'Confirmar'}</Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Dialog */}
      <AnimatePresence>
        {showSyncDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="bg-white dark:bg-[#1a2233] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="p-1 text-right">
                <button onClick={() => setShowSyncDialog(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24} /></button>
              </div>
              <div className="px-6 pb-8">
                <AnacAuth cuil={profile?.cuil} onAuthSuccess={(session: any) => {
                  let authCookie = session.cookies.find((c: any) => c.name === 'Auth.ANAC.localhost' || c.name.includes('.ANAC.') || c.name === 'Auth.ANAC');
                  if (!authCookie) authCookie = session.cookies.find((c: any) => c.name.toLowerCase().includes('auth'));
                  if (authCookie) { setAnacToken(authCookie.value); setAnacSession(null); }
                  else { setAnacSession(session); }
                  setShowSyncDialog(false);
                  compareWithAnac(undefined, session);
                }} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BulkImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        mode="tcp"
        userId={userId}
        isPaidSubscriber={isPaidSubscriber}
        onGoToSuscripcion={onGoToSuscripcion}
        onImportComplete={() => { refreshData(); setShowImportModal(false); }}
      />

      <AnimatePresence>
        {showUpgradeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
                La importación masiva de vuelos está disponible solo para suscriptores. Click aquí para adquirir la suscripción.
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
};
