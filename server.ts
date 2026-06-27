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
import nodemailer from "nodemailer";

import crypto from "crypto";
import helmet from "helmet";
import { scrapeArmsRoster, parseArmsRosterHtml } from "./api/arms-scraper";

// Fix for ENOTFOUND errors in some environments
dns.setDefaultResultOrder('ipv4first');

dotenv.config();



const app = express();
app.use(express.json());

// --- Helmet: seguridad HTTP headers (producción con CSP, dev sin CSP para Vite HMR) ---
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      workerSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https://mexnmpbpqtccaulekupo.supabase.co"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      manifestSrc: ["'self'"],
      formAction: ["'self'"],
    },
  } : false,
}));

// --- CORS Middleware restringido a orígenes conocidos ---
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://personal-flight-log-antigravity-render.onrender.com',
    'https://personal-flight-log-backend.onrender.com',
    'capacitor://localhost',
    'http://localhost',
    'http://localhost:5173',
  ];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
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
  const brevoApiKey = process.env.BREVO_API_KEY || "";

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
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    const sendProgress = (message: string, progress: number) => {
      res.write(JSON.stringify({ type: 'progress', message, progress }) + '\n');
    };
    sendProgress('Verificando conexión con el portal ANAC...', 10);
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
      
      sendProgress('Iniciando navegador seguro...', 25);
      console.log(`[AUTH_ANAC] Navegando a ${anacUrl}...`);
      await page.goto(anacUrl, { waitUntil: "domcontentloaded" });

      await page.waitForSelector("#Username", { state: "visible", timeout: 15000 });

      sendProgress('Accediendo al portal ANAC...', 40);
      console.log("[AUTH_ANAC] Completando credenciales...");
      await page.type("#Username", cuil, { delay: 50 });
      await page.type("#Password", password, { delay: 50 });

      sendProgress('Enviando credenciales...', 55);
      console.log("[AUTH_ANAC] Enviando formulario...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 60000 }).catch(() => {}),
        page.click("#loginButton")
      ]);

      sendProgress('Esperando respuesta de ANAC...', 75);
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

      sendProgress('Guardando sesión...', 90);
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
      sendProgress('¡Sesión capturada correctamente!', 100);
      res.write(JSON.stringify({ type: 'success', storageState }) + '\n');
      res.end();

    } catch (error: any) {
      if (context) await context.close();
      console.error("[AUTH_ANAC] Error:", error.message);
      res.write(JSON.stringify({ type: 'error', message: error.message }) + '\n');
      res.end();
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

  app.post("/api/send-welcome-email", async (req, res) => {
    try {
      const { type, record } = req.body;
      
      if (type !== "INSERT") {
        return res.json({ success: true, message: "Ignorado (no es INSERT)" });
      }

      const email = record?.email;
      const firstName = record?.first_name || "Piloto";

      if (!email) {
        return res.status(400).json({ error: "No email found in record" });
      }

      console.log(`[WELCOME-EMAIL] Descargando la guía del usuario en PDF para ${email}...`);
      const pdfUrl = "https://mexnmpbpqtccaulekupo.supabase.co/storage/v1/object/sign/guia/FlightLog_Guia_Usuario.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMWFlYjExMS03NDk0LTQzOGItYWJhNy0wMDQ4NWRlMTJhNDMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJndWlhL0ZsaWdodExvZ19HdWlhX1VzdWFyaW8ucGRmIiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MjAyMzM2NCwiZXhwIjoxMTI0MjgyMzM2NH0.zvjW8ktswkOPuNOgZkezC-o-Ce_Q3URBziE-U5VCt-I";
      const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

      console.log(`[WELCOME-EMAIL] Enviando correo de bienvenida a ${email} vía Brevo...`);
      await axios.post("https://api.brevo.com/v3/smtp/email", {
        sender: {
          name: "Personal Flight Log",
          email: "gringo.soft.ar@gmail.com"
        },
        to: [{ email: email, name: firstName }],
        subject: "¡Bienvenido a Personal Flight Log! ✈️",
        htmlContent: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            
            <div style="background-color: #2563eb; padding: 40px 20px; text-align: center;">
              <img src="https://flightlog-sin-roster.onrender.com/icons/icon-512.png" alt="Personal Flight Log Logo" style="width: 80px; height: 80px; margin-bottom: 15px; border-radius: 20%; box-shadow: 0 4px 6px rgba(0,0,0,0.1); background-color: white; padding: 10px;" />
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Personal Flight Log</h1>
            </div>

            <div style="padding: 40px 30px; background-color: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 20px; font-size: 20px;">¡Hola, ${firstName}! 👋</h2>
              <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">Te damos una cálida bienvenida a <strong>Personal Flight Log</strong>, tu plataforma profesional para el registro y control de horas de vuelo.</p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #334155; font-size: 15px;">A partir de ahora podrás llevar un control detallado de tus actividades, consultar estadísticas y sincronizar todos tus datos en la nube.</p>
              </div>

              <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">Adjunto a este correo encontrarás la <strong>Guía del Usuario</strong> en formato PDF, la cual te ayudará a dar tus primeros pasos y sacarle el máximo provecho a la aplicación.</p>

              <div style="text-align: center; margin: 35px 0;">
                <a href="https://flightlog-sin-roster.onrender.com" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">Ingresar a la plataforma</a>
              </div>

              <p style="color: #475569; font-size: 15px; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">Si tienes alguna consulta o necesitas soporte, no dudes en responder este correo o escribirnos a <a href="mailto:gringo.soft.ar@gmail.com" style="color: #2563eb; text-decoration: none;">gringo.soft.ar@gmail.com</a>.</p>
            </div>

            <div style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px;">
              <p style="margin: 0;">¡Buenos vuelos! ✈️</p>
              <p style="margin: 5px 0 0 0;">El equipo de Personal Flight Log</p>
            </div>
          </div>
        `,
        attachment: [{ name: "FlightLog_Guia_Usuario.pdf", content: pdfBase64 }]
      }, {
        headers: {
          "api-key": brevoApiKey,
          "Content-Type": "application/json"
        }
      });

      console.log(`[WELCOME-EMAIL] Correo enviado con éxito a ${email} vía Brevo.`);

      // Notificar al administrador
      try {
        console.log(`[WELCOME-EMAIL] Enviando notificación de nuevo registro al administrador...`);
        await axios.post("https://api.brevo.com/v3/smtp/email", {
          sender: {
            name: "Personal Flight Log",
            email: "gringo.soft.ar@gmail.com"
          },
          to: [{ email: "gringo.soft.ar@gmail.com", name: "Admin" }],
          subject: `Nuevo usuario registrado: ${firstName}`,
          htmlContent: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color:#2563eb;">Nuevo registro en Personal Flight Log</h2>
              <table style="width:100%; border-collapse:collapse; margin-top:16px;">
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Nombre</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${firstName} ${record?.last_name || ''}</td></tr>
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Email</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${email}</td></tr>
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">ID</td><td style="padding:8px 12px; border:1px solid #e2e8f0; font-size:12px;">${record?.id || ''}</td></tr>
              </table>
              <p style="margin-top:20px; color:#64748b; font-size:13px;">Recibido automáticamente desde el webhook de Supabase.</p>
            </div>
          `
        }, {
          headers: {
            "api-key": brevoApiKey,
            "Content-Type": "application/json"
          }
        });
        console.log(`[WELCOME-EMAIL] Notificación al administrador enviada con éxito.`);
      } catch (adminErr: any) {
        console.error("[WELCOME-EMAIL] Error al notificar al administrador:", adminErr.response?.data || adminErr.message);
      }

      return res.json({ success: true, message: "Correo enviado con éxito" });

    } catch (error: any) {
      console.error("[WELCOME-EMAIL] Error:", error.response?.data || error.message);
      return res.status(500).json({ error: error.response?.data || error.message });
    }
  });

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

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR SUBSCRIPTION — WebCal endpoint para suscripción de roster
  // ═══════════════════════════════════════════════════════════════════════════

  function toICSDatetime(dateISO: string, timeUTC: string | undefined): string {
    if (!timeUTC) return '';
    const [h, m] = timeUTC.split(':');
    return `${dateISO.replace(/-/g, '')}T${h}${m}00Z`;
  }

  function toICSDate(dateISO: string): string {
    return dateISO.replace(/-/g, '');
  }

  function addMinutesToUtcTime(dateISO: string, timeUTC: string, minutes: number): string {
    if (!timeUTC) return '';
    const [h, m] = timeUTC.split(':').map(Number);
    const date = new Date(Date.UTC(
      parseInt(dateISO.substring(0, 4)),
      parseInt(dateISO.substring(5, 7)) - 1,
      parseInt(dateISO.substring(8, 10)),
      h,
      m,
      0
    ));
    date.setUTCMinutes(date.getUTCMinutes() + minutes);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  function escapeICS(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  function formatCrewForLeg(leg: any): string {
    if (!leg.crewComplement || leg.crewComplement.length === 0) return '';
    const roles: Record<string, string> = {
      CPT: 'Comandante',
      FO: 'Primer Oficial',
      CC: 'TCP',
      PU: 'Purser',
      OTHER: 'Tripulante',
    };
    return leg.crewComplement
      .map((c: any) => `${roles[c.role] || c.role}: ${c.name.trim()}`)
      .join('\n');
  }

  function adjustLocalTime(timeStr: string, minutes: number): string {
    if (!timeStr || minutes <= 0) return timeStr;
    const cleaned = timeStr.replace(':', '');
    if (cleaned.length < 4) return timeStr;
    const h = parseInt(cleaned.substring(0, 2), 10);
    const m = parseInt(cleaned.substring(2, 4), 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const totalMinutes = (h * 60 + m + minutes) % 1440;
    const nh = Math.floor(totalMinutes / 60);
    const nm = totalMinutes % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  function timeToMinutes(timeStr: string): number {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  function toFloatingDatetime(dateISO: string, timeLoc: string): string {
    if (!timeLoc) return '';
    const cleaned = timeLoc.replace(':', '');
    return `${dateISO.replace(/-/g, '')}T${cleaned.substring(0, 4)}00`;
  }

  function addDays(dateISO: string, days: number): string {
    const d = new Date(dateISO + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().substring(0, 10);
  }

  function getUtcForLoc(leg: any, locTime: string): string {
    if (locTime && locTime === leg.reportTimeLoc && leg.reportTimeUtc) return leg.reportTimeUtc;
    if (locTime && locTime === leg.departureTimeLoc && leg.departureTimeUtc) return leg.departureTimeUtc;
    if (locTime && leg.departureTimeLoc && leg.departureTimeUtc) {
      const offset = (timeToMinutes(leg.departureTimeUtc) - timeToMinutes(leg.departureTimeLoc) + 1440) % 1440;
      const utcMin = (timeToMinutes(locTime) + offset + 1440) % 1440;
      return `${String(Math.floor(utcMin / 60)).padStart(2, '0')}:${String(utcMin % 60).padStart(2, '0')}`;
    }
    return leg.departureTimeUtc || locTime;
  }

  function generateRosterICSForUser(
    monthsData: { entries: any[]; month: number; year: number }[],
    customSettings: any
  ): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Personal Flight Log//ARMS Roster//ES',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:flightlog Roster',
    ];

    const defaultSettings = {
      exportTodayOnwards: false,
      excludeStandby: false,
      excludeDayOff: false,
      excludeLayover: false,
      excludeLeave: false,
      excludeNDA: false,
      excludeGTR: false,
    excludeOTH: false,
    aggregateFlights: false,
    postFlightMinutes: 0,
    excludeCrew: false,
    flightEventFormat: "route_flight_times",
    reportEventFormat: "type_info",
  };

  const settings = { ...defaultSettings, ...customSettings };

    for (const md of monthsData) {
      for (const entry of md.entries) {
        // Temporal Filter: exportTodayOnwards
        if (settings.exportTodayOnwards) {
          const todayStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().substring(0, 10);
          if (entry.dateISO < todayStr) continue;
        }

        const isDH = entry.eventType === 'FLIGHT_DH';
        const isFlight = entry.eventType === 'FLIGHT_OP' || isDH;
        const isStandby = entry.eventType === 'STANDBY';
        const isDayOff = entry.eventType === 'OFF';
        const isGtr = entry.eventType === 'GTR';
        const isLayover = entry.eventType === 'LAYOVER';
        const isLeave = entry.eventType === 'LEAVE' || entry.rawTask?.toUpperCase().startsWith('LEAVE') || (entry.eventType === 'NDA' && entry.rawTask?.toUpperCase().includes('LEAVE'));
        const isNDA = entry.eventType === 'NDA' && !isLeave;
        const isOther = entry.eventType === 'UNKNOWN';

        // Filtering
        if (isStandby && settings.excludeStandby) continue;
        if (isDayOff && settings.excludeDayOff) continue;
        if (isLayover && settings.excludeLayover) continue;
        if (isLeave && settings.excludeLeave) continue;
        if (isNDA && settings.excludeNDA) continue;
        if (isOther && settings.excludeOTH) continue;
        if (isGtr && settings.excludeGTR) continue;

        if (isFlight) {
          const legs = entry.legs || [];
          if (legs.length === 0) continue;

          if (settings.aggregateFlights) {
            const firstLeg = legs[0];
            const lastLeg = legs[legs.length - 1];
            if (!firstLeg.departureTimeUtc || !lastLeg.arrivalTimeUtc) continue;

            const suffix = isDH ? ' (DH)' : '';
            const flightNumbers = legs.map((l: any) => l.flightNumber).join('-');

            const routeStr = [...legs.map((l: any) => l.origin), lastLeg.destination].join('-');

            let summary = '';
            const location = '';
            if (settings.flightEventFormat === 'route_flight_times') {
              summary = `${routeStr} / ${flightNumbers}${suffix}`;
            } else if (settings.flightEventFormat === 'flight_route_times') {
              summary = `${flightNumbers} / ${routeStr}${suffix}`;
            } else if (settings.flightEventFormat === 'route_times') {
              summary = `${routeStr}${suffix}`;
            } else {
              summary = `${flightNumbers}${suffix}`;
            }
            summary = `✈️ ${summary}`;

            const descParts: string[] = [];
            legs.forEach((leg: any, idx: number) => {
              const isLastLeg = idx === legs.length - 1;
              descParts.push(`--- Tramo ${idx + 1}: ${leg.origin} - ${leg.destination} (${leg.flightNumber}) ---`);
              if (leg.reportTimeLoc) {
                descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
              }
              const depLoc = leg.departureTimeLoc || '';
              const arrLoc = leg.arrivalTimeLoc || '';
              const adjArrLoc = isLastLeg && settings.postFlightMinutes > 0
                ? adjustLocalTime(arrLoc, settings.postFlightMinutes)
                : arrLoc;
              descParts.push(
                `Horario: ${leg.origin} ${depLoc} → ${leg.destination} ${adjArrLoc} local${isLastLeg && settings.postFlightMinutes > 0 ? ` (+${settings.postFlightMinutes} min)` : ''}`,
                `Block: ${leg.blockTime || ''}`
              );
              const crew = formatCrewForLeg(leg);
              if (crew && !settings.excludeCrew) {
                descParts.push(`Tripulación:\n${crew}`);
              }
              if (leg.remarks?.trim()) {
                descParts.push(`Remarks: ${leg.remarks.trim()}`);
              }
            });

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:arms-${entry.dateISO}-aggregate@flightlog`);
            lines.push(`DTSTAMP:${now}`);
            const startLoc = firstLeg.reportTimeLoc || firstLeg.departureTimeLoc;
            const startUtc = getUtcForLoc(firstLeg, startLoc);
            const startDayShift = timeToMinutes(startUtc) < timeToMinutes(startLoc) ? 1 : 0;
            const dtStartDate = addDays(entry.dateISO, startDayShift);

            const adjArrUtc = settings.postFlightMinutes > 0
              ? adjustLocalTime(lastLeg.arrivalTimeUtc, settings.postFlightMinutes)
              : lastLeg.arrivalTimeUtc;
            const arrDayShift = timeToMinutes(adjArrUtc) < timeToMinutes(startUtc) ? 1 : 0;
            const dtEndDate = addDays(dtStartDate, arrDayShift);

            lines.push(`DTSTART:${toICSDatetime(dtStartDate, startUtc)}`);
            lines.push(`DTEND:${toICSDatetime(dtEndDate, adjArrUtc)}`);
            lines.push(`SUMMARY:${escapeICS(summary)}`);
            lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
            lines.push(`LOCATION:${escapeICS(location)}`);
            lines.push('END:VEVENT');

          } else {
            legs.forEach((leg: any, idx: number) => {
              if (!leg.departureTimeUtc || !leg.arrivalTimeUtc) return;

              const suffix = isDH ? ' (DH)' : '';
              const routeStr = `${leg.origin} - ${leg.destination}`;

              let summary = '';
              const location = '';
              if (settings.flightEventFormat === 'route_flight_times') {
                summary = `${routeStr} / ${leg.flightNumber}${suffix}`;
              } else if (settings.flightEventFormat === 'flight_route_times') {
                summary = `${leg.flightNumber} / ${routeStr}${suffix}`;
              } else if (settings.flightEventFormat === 'route_times') {
                summary = `${routeStr}${suffix}`;
              } else {
                summary = `${leg.flightNumber}${suffix}`;
              }
              summary = `✈️ ${summary}`;

              const descParts: string[] = [
                `Vuelo: ${leg.flightNumber}${suffix}`,
                `Ruta: ${leg.origin} - ${leg.destination}`
              ];
          if (leg.reportTimeLoc) {
            descParts.push(`Presentación: ${leg.reportTimeLoc} local`);
          }
          const isLastLeg = idx === legs.length - 1;
          const depLoc = leg.departureTimeLoc || '';
          const arrLoc = leg.arrivalTimeLoc || '';
          const adjArrLoc = isLastLeg && settings.postFlightMinutes > 0
            ? adjustLocalTime(arrLoc, settings.postFlightMinutes)
            : arrLoc;
          descParts.push(
            `Horario: ${leg.origin} ${depLoc} → ${leg.destination} ${adjArrLoc} local${isLastLeg && settings.postFlightMinutes > 0 ? ` (+${settings.postFlightMinutes} min)` : ''}`,
            `Block: ${leg.blockTime || ''}`
          );
          const crew = formatCrewForLeg(leg);
          if (crew) {
            descParts.push(`Tripulación:\n${crew}`);
          }
          if (leg.remarks?.trim()) {
            descParts.push(`Remarks: ${leg.remarks.trim()}`);
          }

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:arms-${entry.dateISO}-${leg.flightNumber}-${idx}@flightlog`);
          lines.push(`DTSTAMP:${now}`);
          const startLoc = leg.reportTimeLoc || leg.departureTimeLoc;
          const startUtc = getUtcForLoc(leg, startLoc);
          const startDayShift = timeToMinutes(startUtc) < timeToMinutes(startLoc) ? 1 : 0;
          const dtStartDate = addDays(entry.dateISO, startDayShift);

          const adjArrUtc = isLastLeg && settings.postFlightMinutes > 0
            ? adjustLocalTime(leg.arrivalTimeUtc, settings.postFlightMinutes)
            : leg.arrivalTimeUtc;
          const arrDayShift = timeToMinutes(adjArrUtc) < timeToMinutes(startUtc) ? 1 : 0;
          const dtEndDate = addDays(dtStartDate, arrDayShift);

          lines.push(`DTSTART:${toICSDatetime(dtStartDate, startUtc)}`);
          lines.push(`DTEND:${toICSDatetime(dtEndDate, adjArrUtc)}`);
              lines.push(`SUMMARY:${escapeICS(summary)}`);
              lines.push(`DESCRIPTION:${escapeICS(descParts.join('\n'))}`);
              lines.push(`LOCATION:${escapeICS(location)}`);
              lines.push('END:VEVENT');
            });
          }
        } else if (isStandby) {
          const uid = `arms-${entry.dateISO}-standby@flightlog`;
          let title = settings.reportEventFormat === 'type_only' ? 'Guardia' : `Guardia (STB) - ${entry.rawTask || ''}`;
          let description = settings.reportEventFormat === 'type_info' ? (entry.rawTask || 'Guardia de Roster') : '';
          let location = settings.reportEventFormat === 'type_info' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          if (entry.startTimeUtc && entry.endTimeUtc) {
            lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
            lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
          } else {
            lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
            lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          }
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
          if (location) lines.push(`LOCATION:${escapeICS(location)}`);
          lines.push('END:VEVENT');
        } else if (isGtr) {
          const uid = `arms-${entry.dateISO}-gtr@flightlog`;
          const isSim = (entry.rawTask || '').toLowerCase().includes('sim') || entry.eventType === 'SIMULATOR';
          let title = isSim
            ? (settings.reportEventFormat === 'type_only' ? 'Simulador' : `Simulador - ${entry.rawTask || ''}`)
            : (settings.reportEventFormat === 'type_only' ? 'Curso' : `GTR - ${entry.rawTask || 'Entrenamiento Terrestre'}`);
          let description = settings.reportEventFormat === 'type_info' ? (entry.rawTask || '') : '';
          let location = settings.reportEventFormat === 'type_info' ? `${entry.startTimeUtc || ''} - ${entry.endTimeUtc || ''} UTC` : '';

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          if (entry.startTimeUtc && entry.endTimeUtc) {
            lines.push(`DTSTART:${toICSDatetime(entry.dateISO, entry.startTimeUtc)}`);
            lines.push(`DTEND:${toICSDatetime(entry.dateISO, entry.endTimeUtc)}`);
          } else {
            lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
            lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          }
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
          if (location) lines.push(`LOCATION:${escapeICS(location)}`);
          lines.push('END:VEVENT');
        } else if (isLayover) {
          const uid = `arms-${entry.dateISO}-layover-${entry.layoverAirport || 'NA'}@flightlog`;
          let title = `Escala - ${entry.layoverAirport || ''}`;
          let description = `Duración en destino: ${entry.layoverDuration || ''}`;

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          lines.push(`DESCRIPTION:${escapeICS(description)}`);
          lines.push('END:VEVENT');
        } else if (isDayOff) {
          const uid = `arms-${entry.dateISO}-off@flightlog`;
          let title = settings.reportEventFormat === 'type_only' ? 'Libre' : 'Libre (OFF)';

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          lines.push('END:VEVENT');
        } else if (isLeave) {
          const uid = `arms-${entry.dateISO}-leave@flightlog`;
          let title = `Licencia: ${entry.rawTask || ''}`;

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        } else if (isNDA) {
          const uid = `arms-${entry.dateISO}-nda@flightlog`;
          let title = `Actividad (NDA) - ${entry.rawTask || ''}`;

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        } else if (isOther) {
          const uid = `arms-${entry.dateISO}-oth@flightlog`;
          let title = `Otro: ${entry.rawTask || ''}`;

          lines.push('BEGIN:VEVENT');
          lines.push(`UID:${uid}`);
          lines.push(`DTSTAMP:${now}`);
          lines.push(`DTSTART;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`DTEND;VALUE=DATE:${toICSDate(entry.dateISO)}`);
          lines.push(`SUMMARY:${escapeICS(title)}`);
          if (entry.rawTask) lines.push(`DESCRIPTION:${escapeICS(entry.rawTask)}`);
          lines.push('END:VEVENT');
        }
      }
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // ── Calendar subscription tokens ────────────────────────────────────
  // POST /api/roster/generate-token — create a new token with snapshot of current settings
  app.post("/api/roster/generate-token", async (req, res) => {
    const { user_id, label } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id es requerido" });
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('calendar_settings, email')
        .eq('id', user_id)
        .single();

      if (profileError) throw profileError;

      const token = crypto.randomBytes(24).toString('hex');
      const savedSettings = profile?.calendar_settings;
      const settings = savedSettings || {
        exportTodayOnwards: false,
        excludeStandby: false,
        excludeDayOff: false,
        excludeLeave: false,
        excludeNDA: false,
        excludeGTR: false,
        excludeOTH: false,
        excludeCrew: false,
        excludeLayover: false,
        aggregateFlights: false,
        flightEventFormat: 'route_flight_times',
        reportEventFormat: 'type_only',
        postFlightMinutes: 0,
      };
      const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.headers.host || 'localhost:5173'}`;

      const { error: insertError } = await supabase
        .from('calendar_tokens')
        .insert({
          user_id,
          user_email: profile?.email || null,
          token,
          label: label || 'Sin nombre',
          settings,
        });

      if (insertError) throw insertError;

      const subUrl = `${baseUrl}/api/roster/calendar/${token}`;
      res.json({ success: true, token, subscriptionUrl: subUrl });
    } catch (error: any) {
      console.error("[ROSTER_TOKEN_ERR]", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/roster/my-tokens — list all tokens for a user
  app.get("/api/roster/my-tokens", async (req, res) => {
    const user_id = req.query.user_id as string;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id es requerido" });
    }

    try {
      const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.headers.host || 'localhost:5173'}`;

      const { data: tokens, error } = await supabase
        .from('calendar_tokens')
        .select('id, token, label, settings, created_at')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = (tokens || []).map(t => ({
        ...t,
        url: `${baseUrl}/api/roster/calendar/${t.token}`,
      }));

      res.json({ success: true, tokens: list });
    } catch (error: any) {
      console.error("[ROSTER_MY_TOKENS_ERR]", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/roster/revoke-token — revoke a specific token
  app.post("/api/roster/revoke-token", async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: "token es requerido" });
    }

    try {
      const { error } = await supabase
        .from('calendar_tokens')
        .delete()
        .eq('token', token);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[ROSTER_REVOKE_ERR]", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // POST /api/roster/revoke-all-tokens — revoke all tokens for a user
  app.post("/api/roster/revoke-all-tokens", async (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ success: false, error: "user_id es requerido" });
    }

    try {
      const { error } = await supabase
        .from('calendar_tokens')
        .delete()
        .eq('user_id', user_id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error("[ROSTER_REVOKE_ALL_ERR]", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/roster/calendar/:token — serve the ICS file for subscription
  app.get("/api/roster/calendar/:token", async (req, res) => {
    const { token } = req.params;

    try {
      const { data: link, error: linkError } = await supabase
        .from('calendar_tokens')
        .select('user_id, label, settings')
        .eq('token', token)
        .single();

      if (linkError || !link) {
        return res.status(404).json({ error: "Token inválido o expirado" });
      }

      const { data: rosterData, error: rosterError } = await supabase
        .from('arms_roster')
        .select('month, year, roster_json')
        .eq('user_id', link.user_id);

      if (rosterError) throw rosterError;

      if (!rosterData || rosterData.length === 0) {
        return res.status(200)
          .set('Content-Type', 'text/calendar; charset=utf-8')
          .set('Content-Disposition', 'inline; filename="flightlog-roster.ics"')
          .send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Personal Flight Log//ARMS Roster//ES\r\nX-WR-CALNAME:flightlog Roster\r\nEND:VCALENDAR\r\n');
      }

      const icsContent = generateRosterICSForUser(
        rosterData.map(r => ({ entries: r.roster_json, month: r.month, year: r.year })),
        link.settings
      );

      res
        .set('Content-Type', 'text/calendar; charset=utf-8')
        .set('Content-Disposition', 'inline; filename="flightlog-roster.ics"')
        .set('Cache-Control', 'no-cache, no-store, must-revalidate')
        .send(icsContent);
    } catch (error: any) {
      console.error("[ROSTER_CALENDAR_ERR]", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  // ── End calendar subscription tokens ────────────────────────────────

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");

    // Serve sw.js with no-cache headers so Safari/iOS always fetches the latest version
    app.get('/sw.js', async (req, res) => {
      try {
        const swPath = path.join(distPath, 'sw.js');
        const content = await fs.readFile(swPath, 'utf-8');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.type('.js');
        res.send(content);
      } catch {
        res.status(404).send('Not found');
      }
    });

    app.use(express.static(distPath, { index: false })); // Disable default index.html serving

    app.get("*", async (req, res) => {
      try {
        let html = await fs.readFile(path.join(distPath, "index.html"), 'utf-8');
        // Inject environment variables into the <head>
        html = html.replace(
          '<head>',
          `<head>
            <script>
              window.VITE_SUPABASE_URL = ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')};
              window.VITE_SUPABASE_ANON_KEY = ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')};
            </script>`
        );
        res.send(html);
      } catch (e) {
        res.status(500).send("Error loading index.html");
      }
    });
  }

// Start the server if not in a serverless environment like Vercel
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
