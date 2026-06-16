import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import axios from "axios";
import dns from "dns";
import { chromium } from "playwright";

import crypto from "crypto";
import { scrapeArmsRoster, parseArmsRosterHtml } from "./api/arms-scraper";

// Fix for ENOTFOUND errors in some environments
dns.setDefaultResultOrder('ipv4first');

dotenv.config();



const app = express();
app.use(express.json());

// --- CORS Middleware para permitir peticiones desde Capacitor (Móvil) ---
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Solo aplicamos cabeceras CORS si la petición proviene de un origen diferente (ej. Móvil o Cross-Origin)
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// --- Rate Limiting ---
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Demasiadas solicitudes de autenticación. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Demasiadas solicitudes de sincronización. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/auth-anac", authLimiter);
app.use("/api/sync-anac", syncLimiter);
app.use("/api/arms/sync-roster", authLimiter);

  // --- Instancia global de Playwright para evitar cold-starts ---
  let globalBrowser: any = null;
  let browserTimeout: any = null;

  const getBrowser = async () => {
    if (!globalBrowser) {
      console.log("[PLAYWRIGHT] Iniciando nueva instancia global de Chromium...");
      globalBrowser = await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-features=IsolateOrigins,site-per-process'
        ]
      });
    }
    
    // Reiniciar temporizador de auto-cierre
    if (browserTimeout) clearTimeout(browserTimeout);
    browserTimeout = setTimeout(async () => {
      if (globalBrowser) {
        console.log("[PLAYWRIGHT] Cerrando instancia global de Chromium por inactividad...");
        await globalBrowser.close();
        globalBrowser = null;
      }
    }, 300000); // 5 minutos de inactividad

    return globalBrowser;
  };

  // Supabase Admin/Client setup for backend
  // Uses service_role key to bypass RLS for server-side operations (e.g. user_remote_sessions upsert)
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --- Connectivity Test API ---
  app.get("/ping", (req, res) => res.send("pong"));

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
      console.error("[TEST_CONNECTIVITY]", error.stack || error.message);
      res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Error interno del servidor" : error.message });
    }
  });

  // --- ANAC Auth API (Playwright) ---
  app.post("/api/auth-anac", async (req, res) => {
    const { user_id, cuil, password, rememberMe } = req.body;

    if (!user_id || !cuil || !password) {
      return res.status(400).json({ error: "user_id, cuil y password son requeridos" });
    }

    console.log(`[AUTH_ANAC] Iniciando login para CUIL: ${cuil}`);
    let context;
    try {
      const browser = await getBrowser();
      
      context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
        locale: "es-AR",
        timezoneId: "America/Argentina/Buenos_Aires"
      });

      const page = await context.newPage();
      
      // Pre-check DNS rápido para evitar timeout de 30s si ANAC está bloqueado desde Render
      const ANAC_DOMAINS = ['cad.anac.gob.ar', 'cadam.anac.gob.ar'];
      let anacUrl: string | null = null;
      for (const domain of ANAC_DOMAINS) {
        try {
          await Promise.race([
            dns.promises.lookup(domain),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
          ]);
          anacUrl = `https://${domain}/portalApp`;
          console.log(`[AUTH_ANAC] DNS resuelto: ${domain}`);
          break;
        } catch {
          console.log(`[AUTH_ANAC] DNS no disponible para: ${domain}`);
        }
      }
      if (!anacUrl) {
        throw new Error("No se puede conectar con el portal ANAC desde este servidor. Verifica que cad.anac.gob.ar sea accesible.");
      }
      
      console.log(`[AUTH_ANAC] Navegando a ${anacUrl}...`);
      await page.goto(anacUrl, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#Username", { state: "visible", timeout: 15000 });

      console.log("[AUTH_ANAC] Completando credenciales...");
      await page.type("#Username", cuil, { delay: 50 });
      await page.type("#Password", password, { delay: 50 });

      console.log("[AUTH_ANAC] Enviando formulario...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => {}),
        page.click("#loginButton")
      ]);

      // --- VALIDACIÓN DE ÉXITO (Solo cookies reales de portal) ---
      let hasAuthCookie = false;
      
      // Polling más fino y rápido: 20 chequeos de 250ms (mismo tiempo total, pero reacciona el doble de rápido)
      for (let i = 0; i < 20; i++) {
        const cookies = await context.cookies();
        hasAuthCookie = cookies.some(c => 
          c.name.includes("Auth.ANAC") || 
          c.name.includes("ASPXROLES")
        );
        if (hasAuthCookie) break;
        console.log(`[AUTH_ANAC] Verificando cookie de sesión... (Intento ${i + 1}/20)`);
        await page.waitForTimeout(250); // esperar 250ms antes del próximo chequeo
      }

      if (!hasAuthCookie) {
        const portalError = await page.locator(".text-danger, .validation-summary-errors").first().innerText().catch(() => null);
        throw new Error(portalError || "No se pudo detectar la sesión del portal. Verifica tus datos.");
      }

      console.log("[AUTH_ANAC] Login exitoso confirmado.");

      // Capturar cookies y localStorage
      const storageState = await context.storageState();
      console.log(`[AUTH_ANAC] Finalizado. Cookies capturadas: ${storageState.cookies.length}`);

      // Persistencia en Supabase
      if (rememberMe) {
        try {
          const { error: dbError } = await supabase
            .from('user_remote_sessions')
            .upsert({
              user_id: user_id,
              session_data: storageState,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          if (dbError) console.error("[AUTH_ANAC] Error DB:", dbError.message);
        } catch (e) {}
      }

      // Solo cerramos el contexto (la pestaña), NO el navegador completo
      await context.close();
      res.json({ success: true, storageState });

    } catch (error: any) {
      if (context) await context.close();
      console.error("[AUTH_ANAC] Error:", error.message);
      res.status(error.message.includes("Credenciales") ? 401 : 500).json({ 
        error: error.message 
      });
    }
  });

  // --- ANAC Sincronización API ---
  app.post("/api/sync-anac", async (req, res) => {
    const { user_id, anac_token, storageState, logs_to_sync } = req.body;

    if (!user_id || (!anac_token && !storageState)) {
      return res.status(400).json({ error: "user_id y sesión son requeridos" });
    }

    try {
      const results = [];
      const logs = logs_to_sync || [];
      
      // Construir Cookie Header completo
      let cookieHeader = "";
      if (storageState && storageState.cookies) {
        cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      } else {
        cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
      }

      console.log(`[SYNC_ANAC] Iniciando sincronización con ${storageState ? 'sesión completa' : 'token simple'}`);

      // ANAC exige orden cronológico estricto (el más antiguo primero)
      const sortedLogs = [...logs].sort((a: any, b: any) => {
        const dateA = new Date(a.fechaHoraSalida || 0).getTime();
        const dateB = new Date(b.fechaHoraSalida || 0).getTime();
        return dateA - dateB;
      });

      for (const log of sortedLogs) {
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
          const mapAirportCode = (code: string) => {
            const c = code.trim().toUpperCase();
            
            // Diccionario local de códigos oficiales de ANAC (basado en airports.csv)
            const ANAC_MAPPINGS: Record<string, string> = {
              "AEP": "AER", "SABE": "AER", // Aeroparque
              "EZE": "EZE", "SAEZ": "EZE", // Ezeiza
              "COR": "CBA", "SACO": "CBA", // Córdoba
              "MDZ": "DOZ", "SAMM": "DOZ", // Mendoza
              "BRC": "BAR", "SAZS": "BAR", // Bariloche
              "IGR": "IGU", "SARI": "IGU", // Puerto Iguazú
              "SLA": "SAL", "SASA": "SAL", // Salta
              "NQN": "NEU", "SAZN": "NEU", // Neuquén
              "TUC": "TUC", "SANT": "TUC", // Tucumán
              "USH": "USU", "SAWH": "USU", // Ushuaia
              "FTE": "CAL", "SAWC": "CAL", // El Calafate
              "JUJ": "JUJ", "SASJ": "JUJ", // Jujuy
              "PSS": "POS", "SARP": "POS", // Posadas
              "CNQ": "CRR", "SARC": "CRR", // Corrientes
              "RES": "SIS", "SARE": "SIS", // Resistencia
              "UAQ": "JUA", "SANU": "JUA", // San Juan
              "LUQ": "UIS", "SAOU": "UIS", // San Luis
              "CTC": "CAT", "SANC": "CAT", // Catamarca
              "IRJ": "LAR", "SANL": "LAR", // La Rioja
              "SFN": "SVO", "SAAV": "SVO", // Santa Fe
              "PRA": "PAR", "SAAP": "PAR", // Paraná
              "ROS": "ROS", "SAAR": "ROS", // Rosario
              "VDM": "VIE", "SAVN": "VIE", // Viedma
              "BHI": "BAI", "SAZB": "BAI", // Bahía Blanca
              "MDQ": "MDP", "SAZM": "MDP", // Mar del Plata
              "REL": "TRW", "SAVT": "TRW", // Trelew
              "PMY": "MAD", "SAVY": "MAD", // Puerto Madryn
              "CRV": "CRV", "SAVC": "CRV", // Comodoro Rivadavia
              "RGL": "GAL", "SAWG": "GAL", // Río Gallegos
              "RGA": "GRA", "SAWE": "GRA", // Río Grande
              "CPC": "CHA", "SAZY": "CHA", // Chapelco / San Martín de los Andes
              "EQS": "ESQ", "SAVV": "ESQ", // Esquel
              "LGS": "MAL", "SAMO": "MAL", // Malargüe
              "AFA": "SRA", "SAMR": "SRA", // San Rafael
              "RSA": "OSA", "SAWR": "OSA", // Santa Rosa
            };

            return ANAC_MAPPINGS[c] || c;
          };

          const oriID = mapAirportCode(String(log.origenID || ""));
          const destID = mapAirportCode(String(log.destinoID || ""));

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
            return d;
          };

          const dSalida = adjustDate(log.fechaHoraSalida);
          const dLlegada = adjustDate(log.fechaHoraLlegada);

          // Si el horario de llegada quedó registrado antes que el de salida (cruzó medianoche), le sumamos un día
          if (dLlegada < dSalida) {
            dLlegada.setDate(dLlegada.getDate() + 1);
          }

          const isSimLog = String(log.tipoVueloID) === "3";

          const payload = isSimLog ? {
            Discriminaciones: [],
            discriminaciones: [],
            horasDia: 0,
            horasNoche: 0,
            tipoVueloID: "3",
            fechaHoraSalida: dSalida.toISOString(),
            fechaHoraLlegada: dLlegada.toISOString(),
            aterrizajes: 0,
            autoridadCertificanteID: String(authId || "5"),
            observaciones: obs,
            finalidadID: String(log.finalidadID || "63"),
            potencia: "",
            clase: log.clase || "D",
            cargoID: String(log.cargoID || "6"),
            simulador: {
              simuladorID: String(log.matriculaAvion || "86"),
              nombre: log.Marca_Modelo || "",
              modeloID: "",
              modelo: ""
            }
          } : {
            Discriminaciones: uniqueDiscriminaciones,
            aterrizajes: parseInt(log.aterrizajes || "1"),
            autoridadCertificanteID: parseInt(authId || "15"),
            cargoID: parseInt(finalCargoID),
            clase: log.clase || "MULT-T",
            destinoID: destID,
            destinoPersonalizado: "",
            discriminaciones: [],
            fechaHoraLlegada: dLlegada.toISOString(),
            fechaHoraSalida: dSalida.toISOString(),
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

  // --- ANAC Get Logs API ---
  app.post("/api/get-anac-logs", async (req, res) => {
    const { anac_token, storageState, pageNumber = 1, rowsPerPage = 50 } = req.body;

    if (!anac_token && !storageState) {
      return res.status(400).json({ error: "Sesión de ANAC es requerida" });
    }

    try {
      // Construir Cookie Header completo
      let cookieHeader = "";
      if (storageState && storageState.cookies) {
        cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      } else {
        cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
      }

      console.log(`[GET_ANAC_LOGS] Solicitando página ${pageNumber} de ANAC...`);

      const url = `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/GetPagedList?descripcion=&tipoTrip=TM&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}&mostrarIngresados=true&solicitudFoliadoId=null`;
      
      let anacResponse;
      try {
        anacResponse = await axios.get(url, {
          headers: {
            "Cookie": cookieHeader,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://cad.anac.gob.ar",
            "Referer": "https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Index",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          },
          timeout: 15000
        });
      } catch (err: any) {
        // Fallback strategy
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
          const fallbackUrl = `https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/GetPagedList?description=&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}`;
          anacResponse = await axios.get(fallbackUrl, {
            headers: {
              "Cookie": cookieHeader,
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
            },
            timeout: 15000
          });
        } else {
          throw err;
        }
      }

      res.json(anacResponse.data);
    } catch (error: any) {
      console.error("[GET_ANAC_LOGS] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ARMS ROSTER SYNC APIs
  // ═══════════════════════════════════════════════════════════════════════════



  app.post("/api/arms/sync-roster", async (req, res) => {
    const { user_id, username, password, month, year, rememberMe, rememberSession } = req.body;
    const shouldRemember = rememberMe || rememberSession;

    if (!user_id || !username || (!password && !req.body.sessionData)) {
      return res.status(400).json({ error: "user_id, username y password o sesión son requeridos" });
    }

    const targetMonth = parseInt(String(month || (new Date().getMonth() + 1)));
    const targetYear = parseInt(String(year || new Date().getFullYear()));

    console.log(`[ARMS_SYNC] Iniciando sync manual para usuario ${user_id} (${username}) - Período ${targetMonth}/${targetYear}`);

    let browserInstance;
    try {
      browserInstance = await getBrowser();
      
      // Intentar obtener sesión existente si no viene password
      let sessionData = req.body.sessionData;
      if (!sessionData && !password) {
        const { data: existingSession } = await supabase
          .from('arms_sessions')
          .select('session_data')
          .eq('user_id', user_id)
          .single();
        sessionData = existingSession?.session_data;
      }

      const { html, storageState } = await scrapeArmsRoster(
        browserInstance,
        username,
        password,
        targetMonth,
        targetYear,
        sessionData
      );

      // Parsear HTML a estructuras estructuradas
      const rosterEntries = parseArmsRosterHtml(html);
      
      // Calcular hash SHA-256 para detección de cambios
      const rosterHash = crypto.createHash("sha256").update(JSON.stringify(rosterEntries)).digest("hex");

      // Guardar el roster mensual en Supabase
      const { error: dbError } = await supabase
        .from('arms_roster')
        .upsert({
          user_id,
          month: targetMonth,
          year: targetYear,
          roster_json: rosterEntries,
          roster_hash: rosterHash,
          synced_at: new Date().toISOString()
        }, { onConflict: 'user_id,month,year' });

      if (dbError) {
        console.error("[ARMS_SYNC] Error al guardar roster en DB:", dbError.message);
        throw dbError;
      }

      // Guardado de sesión para sincronización automática / offline
      if (shouldRemember || sessionData) {
        const { error: sessionError } = await supabase
          .from('arms_sessions')
          .upsert({
            user_id,
            session_data: storageState,
            arms_username: username,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (sessionError) {
          console.error("[ARMS_SYNC] Error al guardar sesión de ARMS:", sessionError.message);
        }
      }

      console.log(`[ARMS_SYNC] Sincronización manual exitosa para ${username}. Tramos guardados: ${rosterEntries.length}`);
      res.json({ success: true, entries: rosterEntries });

    } catch (error: any) {
      console.error("[ARMS_SYNC] Error en sincronización:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Endpoint para obtener el Roster guardado en la base de datos
  app.get("/api/arms/roster", async (req, res) => {
    const { user_id, month, year } = req.query;

    if (!user_id || !month || !year) {
      return res.status(400).json({ error: "user_id, month y year son requeridos" });
    }

    try {
      const { data, error } = await supabase
        .from('arms_roster')
        .select('roster_json, synced_at')
        .eq('user_id', user_id)
        .eq('month', parseInt(month as string))
        .eq('year', parseInt(year as string))
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      res.json({
        success: true,
        roster: data?.roster_json || [],
        syncedAt: data?.synced_at || null
      });
    } catch (error: any) {
      console.error("[GET_ROSTER] Error al leer roster:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Endpoint para registrar/actualizar tokens de notificaciones push (FCM)
  app.post("/api/arms/register-token", async (req, res) => {
    const { user_id, fcm_token, platform = "android" } = req.body;

    if (!user_id || !fcm_token) {
      return res.status(400).json({ error: "user_id y fcm_token son requeridos" });
    }

    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id,
          fcm_token,
          platform,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      console.log(`[PUSH] Token FCM registrado exitosamente para usuario ${user_id}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[REGISTER_TOKEN] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // [DESHABILITADO] CRON JOB: Sincronización automática del Roster
  // ═══════════════════════════════════════════════════════════════════════════
  // La sincronización automática del roster ha sido completamente deshabilitada.
  // Solo se permite la sincronización manual desde la UI.
  //
  // Para reactivar: descomentar la función runBackgroundRosterSync,
  // el setInterval y el setTimeout al final de esta sección.
  // ═══════════════════════════════════════════════════════════════════════════

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false })); // Disable default index.html serving
    
    app.get("*", async (req, res) => {
      try {
        const html = await fs.readFile(path.join(distPath, "index.html"), 'utf-8');
        // Inject environment variables into the <head>
        const injectedHtml = html.replace(
          '<head>',
          `<head>
            <script>
              window.VITE_SUPABASE_URL = ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')};
              window.VITE_SUPABASE_ANON_KEY = ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')};
            </script>`
        );
        res.send(injectedHtml);
      } catch (e) {
        res.status(500).send("Error loading index.html");
      }
    });
  }

  // Reporte de errores
  app.post("/api/report", async (req, res) => {
    console.log("[REPORT] Recibido reporte de error");
    const { title, description, userEmail } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length < 5 || title.trim().length > 100) {
      return res.status(400).json({ error: "El título debe tener entre 5 y 100 caracteres" });
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 1000) {
      return res.status(400).json({ error: "La descripción debe tener entre 10 y 1000 caracteres" });
    }
    try {
      console.log("[REPORT] Insertando en bug_reports...");
      const { error: insertError } = await supabase
        .from('bug_reports')
        .insert({ title: title.trim(), description: description.trim(), user_email: userEmail || '' });
      if (insertError) {
        console.error("[REPORT_ERR]", insertError.message);
        throw insertError;
      }
      console.log("[REPORT] Reporte insertado correctamente");
      res.json({ success: true });
    } catch (error: any) {
      console.error("[REPORT_ERR]", error.message);
      res.status(500).json({ error: error.message });
    }
  });

// Start the server if not in a serverless environment like Vercel
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
