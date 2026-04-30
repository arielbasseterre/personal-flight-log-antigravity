import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import axios from "axios";
import dns from "dns";

// Fix for ENOTFOUND errors in some environments
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const app = express();
app.use(express.json());

  // Supabase Admin/Client setup for backend
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ""; // Should ideally use service_role for backend
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- Connectivity Test API ---
  app.get("/api/test-connectivity", async (req, res) => {
    try {
      const google = await axios.get("https://www.google.com", { timeout: 5000 });
      const anacResolve = await new Promise((resolve) => {
        dns.lookup("cad.anac.gob.ar", (err, address) => {
          resolve({ err: err?.message, address });
        });
      });
      
      res.json({
        internet: "ok",
        googleStatus: google.status,
        anacResolve
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // --- ANAC Sincronización API ---
  app.post("/api/sync-anac", async (req, res) => {
    const { user_id, anac_token, logs_to_sync } = req.body;

    if (!user_id || !anac_token) {
      return res.status(400).json({ error: "user_id y anac_token son requeridos" });
    }

    try {
      const results = [];
      const logs = logs_to_sync || [];
      
      // Sort logs chronologically (Oldest first)
      logs.sort((a: any, b: any) => new Date(a.fechaHoraSalida).getTime() - new Date(b.fechaHoraSalida).getTime());

      // Flexible cookie handling
      let cookieHeader = anac_token.trim();
      // If it doesn't look like a full cookie string, wrap it in Auth.ANAC
      if (!cookieHeader.includes("=")) {
        cookieHeader = `Auth.ANAC=${cookieHeader}`;
      }

      for (const log of logs) {
        try {
          // Exact payload mapping based on your model provided in screenshot
          let authId = String(log.autoridadCertificanteID || "15");
          let obs = log.observaciones || "";

          // if authId is a name instead of an ID (common error)
          if (authId && isNaN(Number(authId))) {
            obs = authId + (obs ? " - " + obs : "");
            authId = "15"; // Default: GTE de Operaciones
          }

          // Handle Airport codes directly in ID fields as seen in successful example
          const oriID = String(log.origenID || "").trim();
          const destID = String(log.destinoID || "").trim();

          // Prepare hours as simple strings (e.g., "1" instead of "1.0" if possible)
          const formatHours = (val: any) => {
            const num = parseFloat(val || "0");
            return String(num.toFixed(1));
          };
          const discriminaciones = [];
          const ifrRealTotal = parseFloat(String(log.ifr_real_pilot || "0")) + parseFloat(String(log.ifr_real_copilot || "0"));
          
          if (parseFloat(String(log.instruccion || "0")) > 0) {
            // ID 1: INSTRUCTOR (Reverting to 1 as String as confirmed in Create screenshot)
            discriminaciones.push({ tipoDiscriminacionID: 1, horas: formatHours(log.instruccion) });
          }
          if (parseFloat(String(log.multi_engine || "0")) > 0) {
            // ID 2: MULTIMOTOR (Confirmed STRING "X.X" in Create payload)
            discriminaciones.push({ tipoDiscriminacionID: 2, horas: formatHours(log.multi_engine) });
          }
          if (parseFloat(String(log.jet || "0")) > 0) {
            // ID 3: REACTOR / JET (Confirmed STRING "X.X" in Create payload)
            discriminaciones.push({ tipoDiscriminacionID: 3, horas: formatHours(log.jet) });
          }
          if (ifrRealTotal > 0) {
            // ID 6: VUELO X INSTRUMENTO REAL (Confirmed STRING "X.X" in Create payload)
            discriminaciones.push({ tipoDiscriminacionID: 6, horas: formatHours(ifrRealTotal) });
          }

          // Sort and deduplicate
          const uniqueDiscriminaciones = Array.from(
            discriminaciones.reduce((map, item) => {
              map.set(item.tipoDiscriminacionID, item);
              return map;
            }, new Map()).values()
          ).sort((a: any, b: any) => a.tipoDiscriminacionID - b.tipoDiscriminacionID);

          // Intelligent cargoID detection
          let finalCargoID = "1"; // Default: Piloto
          
          const pilotHours = (parseFloat(String(log.cross_country_day_pilot || "0")) + 
                             parseFloat(String(log.cross_country_night_pilot || "0")) +
                             parseFloat(String(log.airfield_day_pilot || "0")) + 
                             parseFloat(String(log.airfield_night_pilot || "0")));
                             
          const copilotHours = (parseFloat(String(log.cross_country_day_copilot || "0")) + 
                               parseFloat(String(log.cross_country_night_copilot || "0")) +
                               parseFloat(String(log.airfield_day_copilot || "0")) + 
                               parseFloat(String(log.airfield_night_copilot || "0")));

          console.log(`[DEBUG_SYNC] Horas calculadas -> Piloto: ${pilotHours}, Copiloto: ${copilotHours}`);

          if (copilotHours > 0) {
            finalCargoID = "2"; // CO-PILOTO (Si hay cualquier hora de copiloto)
          } else {
            finalCargoID = "1"; // PILOTO (Para todo lo demás, incluyendo Instrucción)
          }

          console.log(`[DEBUG_SYNC] Cargo detectado: ${finalCargoID} (${finalCargoID === "2" ? "COPILOTO" : "PILOTO"})`);

          // Offset set to 0 as ANAC portal seems to display UTC values directly
          const offsetHours = 0;
          const adjustDate = (dateStr: string) => {
            const d = new Date(dateStr);
            d.setHours(d.getHours() + offsetHours);
            return d.toISOString();
          };

          const payload = {
            Discriminaciones: uniqueDiscriminaciones,
            aterrizajes: parseInt(log.aterrizajes || "1"),
            autoridadCertificanteID: parseInt(authId || "15"),
            cargoID: parseInt(finalCargoID),
            clase: log.clase || "MULT-T",
            destinoID: destID,
            destinoPersonalizado: "",
            discriminaciones: [],
            fechaHoraLlegada: adjustDate(log.fechaHoraLlegada),
            fechaHoraSalida: adjustDate(log.fechaHoraSalida),
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

          console.log("JSON_ENVIADO:" + JSON.stringify(payload));

          // ENHANCED DEBUGGING: Precise logging of the outgoing request
          console.log(`[DEBUG_SYNC] Iniciando sincronización para vuelo: ${log.fechaHoraSalida}`);
          console.log(`[DEBUG_SYNC] URL: https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create`);
          console.log(`[DEBUG_SYNC] Payload:`, JSON.stringify(payload, null, 2));
          console.log(`[DEBUG_SYNC] Cookie (masked): ${cookieHeader.substring(0, 20)}...${cookieHeader.substring(cookieHeader.length - 10)}`);

          let anacResponse;
          try {
            anacResponse = await axios.post("https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create", payload, {
              headers: {
                "Cookie": cookieHeader,
                "Content-Type": "application/json; charset=utf-8",
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://cad.anac.gob.ar",
                "Referer": "https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Create",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              },
              timeout: 15000
            });
            console.log(`[DEBUG_SYNC] Éxito:`, anacResponse.status, anacResponse.data);
          } catch (err: any) {
            console.error(`[DEBUG_SYNC] Error detectado en el primer intento:`, err.response?.status, err.response?.data || err.message);
            
            // Fallback strategy
            if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
              console.warn("[DEBUG_SYNC] Reintentando vía cadam.anac.gob.ar...");
              anacResponse = await axios.post("https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/Create", payload, {
                headers: {
                  "Cookie": cookieHeader,
                  "Content-Type": "application/json; charset=utf-8",
                  "X-Requested-With": "XMLHttpRequest",
                  "Origin": "https://cadam.anac.gob.ar",
                  "Referer": "https://cadam.anac.gob.ar/Cadam/VueloTripulante/Create",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                },
                timeout: 15000
              });
              console.log(`[DEBUG_SYNC] Éxito (fallback):`, anacResponse.status, anacResponse.data);
            } else {
              throw err;
            }
          }

          results.push({ id: log.id, status: "success", data: anacResponse.data });

          // Security Delay (2 seconds)
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (itemError: any) {
          const detail = itemError.response?.data || itemError.message;
          console.error("Individual sync error detail:", detail);
          results.push({ id: log.id, status: "error", error: detail });
        }
      }

      res.json({ results });
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

// Serving static files (only for local dev)
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
