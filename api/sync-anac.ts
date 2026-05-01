import { createClient } from "@supabase/supabase-js";
import axios from "axios";

export default async function handler(req: any, res: any) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { user_id, anac_token, logs_to_sync } = req.body;

  if (!user_id || !anac_token) {
    return res.status(400).json({ error: "user_id y anac_token son requeridos" });
  }

  try {
    const results = [];
    const logs = logs_to_sync || [];
    
    // Ordenar cronológicamente
    logs.sort((a: any, b: any) => new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime());

    const authCookie = anac_token.includes('=') ? anac_token : `Auth.ANAC.localhost=${anac_token}`;

    for (const log of logs) {
      try {
        const authId = log.autoridadCertificanteID || "15";
        const destID = log.destinoID || "AER";
        const oriID = log.origenID || "EZE";
        const obs = log.observaciones || "";
        
        const discriminaciones = [];
        const formatHours = (h: any) => parseFloat(String(h || "0")).toFixed(1);
        
        if (parseFloat(String(log.instruccion || "0")) > 0) {
          discriminaciones.push({ tipoDiscriminacionID: 1, horas: formatHours(log.instruccion) });
        }
        if (parseFloat(String(log.multi_engine || "0")) > 0) {
          discriminaciones.push({ tipoDiscriminacionID: 2, horas: formatHours(log.multi_engine) });
        }
        if (parseFloat(String(log.jet || "0")) > 0) {
          discriminaciones.push({ tipoDiscriminacionID: 3, horas: formatHours(log.jet) });
        }
        const ifrRealTotal = parseFloat(String(log.ifr_real_pilot || "0")) + parseFloat(String(log.ifr_real_copilot || "0"));
        if (ifrRealTotal > 0) {
          discriminaciones.push({ tipoDiscriminacionID: 6, horas: formatHours(ifrRealTotal) });
        }

        const uniqueDiscriminaciones = Array.from(
          discriminaciones.reduce((map, item) => {
            map.set(item.tipoDiscriminacionID, item);
            return map;
          }, new Map()).values()
        ).sort((a: any, b: any) => a.tipoDiscriminacionID - b.tipoDiscriminacionID);

        let finalCargoID = "1";
        const copilotHours = (parseFloat(String(log.cross_country_day_copilot || "0")) + 
                             parseFloat(String(log.cross_country_night_copilot || "0")) +
                             parseFloat(String(log.airfield_day_copilot || "0")) + 
                             parseFloat(String(log.airfield_night_copilot || "0")));

        if (copilotHours > 0) {
          finalCargoID = "2";
        } else {
          finalCargoID = "1";
        }

        const payload = {
          Discriminaciones: uniqueDiscriminaciones,
          aterrizajes: parseInt(log.aterrizajes || "1"),
          autoridadCertificanteID: parseInt(authId || "15"),
          cargoID: parseInt(finalCargoID),
          clase: log.clase || "MULT-T",
          destinoID: destID,
          destinoPersonalizado: "",
          discriminaciones: [],
          fechaHoraLlegada: log.fechaHoraLlegada,
          fechaHoraSalida: log.fechaHoraSalida,
          finalidadID: parseInt(log.finalidadID || "79"),
          horasDia: parseFloat(log.horasDia || "0"),
          horasNoche: parseFloat(log.horasNoche || "0"),
          marcaModeloID: 302371,
          matriculaAvion: log.matriculaAvion,
          observaciones: obs,
          origenID: oriID,
          origenPersonalizado: "",
          potencia: parseInt(log.potencia || "26000"),
          tipoVueloID: parseInt(log.tipoVueloID || "2"),
          vueloTripulanteID: 0,
          vueloTripulanteIDs: null
        };

        const syncResponse = await axios.post(
          "https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create",
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              "Cookie": authCookie,
              "Accept": "application/json, text/plain, */*",
              "Origin": "https://cad.anac.gob.ar",
              "Referer": "https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Create"
            },
            timeout: 30000
          }
        );

        results.push({ id: log.id, success: true, data: syncResponse.data });
      } catch (err: any) {
        results.push({ id: log.id, success: false, error: err.response?.data || err.message });
      }
    }

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
