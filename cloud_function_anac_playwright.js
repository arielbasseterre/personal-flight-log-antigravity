/**
 * Google Cloud Function: ANAC Sync Worker (PRO VERSION)
 * Objetivo: Sincronización automática Supabase -> ANAC
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ANAC_BASE_URL = 'https://cad.anac.gob.ar/foliadoweb';

exports.syncAnacVuelos = async (req, res) => {
  // CORS Headers — solo orígenes conocidos
  const allowedOrigins = [
    'https://personal-flight-log-antigravity.vercel.app',
    'capacitor://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  const { user_id, anac_token, logs_to_sync } = req.body;
  if (!user_id || !anac_token) {
    return res.status(400).send('Missing user_id or anac_token');
  }

  const results = [];
  const sortedLogs = (logs_to_sync || []).sort((a, b) => new Date(a.fechaHoraSalida) - new Date(b.fechaHoraSalida));

  for (const log of sortedLogs) {
    try {
      const payload = {
        Discriminaciones: (log.Discriminaciones || []).map(d => ({
          tipoDiscriminacionID: d.tipoDiscriminacionID,
          horas: String(parseFloat(d.horas || "0").toFixed(1))
        })),
        aterrizajes: parseInt(log.aterrizajes || "0"),
        autoridadCertificanteID: String(log.autoridadCertificanteID || "15"),
        cargoID: String(log.cargoID || "1"),
        clase: log.clase || "MULT-T",
        destinoID: log.destinoID,
        destinoPersonalizado: "",
        discriminaciones: [], 
        fechaHoraLlegada: log.fechaHoraLlegada,
        fechaHoraSalida: log.fechaHoraSalida,
        finalidadID: String(log.finalidadID || "46"),
        horasDia: String(log.horasDia || "0").padStart(2, '0'),
        horasNoche: parseFloat(log.horasNoche || "0"),
        matriculaAvion: log.matriculaAvion,
        observaciones: log.observaciones || "",
        origenID: log.origenID,
        origenPersonalizado: "",
        potencia: parseInt(log.potencia || "26000"),
        tipoVueloID: String(log.tipoVueloID || "1")
      };

      const response = await axios.post(`${ANAC_BASE_URL}/api/VueloTripulante/Create`, payload, {
        headers: {
          "Cookie": `Auth.ANAC=${anac_token}`,
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "Origin": "https://cad.anac.gob.ar",
          "Referer": `${ANAC_BASE_URL}/VueloTripulante/Create`,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      results.push({ id: log.id, status: "success", data: response.data });

      // Delay de seguridad de 2 segundos (REQUERIDO)
      await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
      results.push({ 
        id: log.id, 
        status: "error", 
        error: error.response ? error.response.data : error.message 
      });
    }
  }

  res.json({ success: true, results });
};
