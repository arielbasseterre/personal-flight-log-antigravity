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
import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from "mercadopago";
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
app.use("/api/sync-anac-tcp", syncLimiter);
app.use("/api/get-anac-logs-tcp", syncLimiter);

  // --- Instancia global de Playwright para evitar cold-starts ---
  let globalBrowser: any = null;
  let browserTimeout: any = null;
  let browserLaunchPromise: Promise<any> | null = null;

  const getBrowser = async () => {
    if (!globalBrowser) {
      if (!browserLaunchPromise) {
        console.log("[PLAYWRIGHT] Iniciando nueva instancia global de Chromium...");
        browserLaunchPromise = chromium.launch({ 
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
      try {
        globalBrowser = await browserLaunchPromise;
      } finally {
        browserLaunchPromise = null;
      }
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

  const sendBrevoEmail = async (to: { email: string, name: string }[], subject: string, htmlContent: string, attachment?: { name: string, content: string }[]) => {
    await axios.post("https://api.brevo.com/v3/smtp/email", {
      sender: { name: "Personal Flight Log", email: "gringo.soft.ar@gmail.com" },
      to,
      subject,
      htmlContent,
      ...(attachment ? { attachment } : {})
    }, {
      headers: { "api-key": brevoApiKey, "Content-Type": "application/json" }
    });
  };

  const notifyNewUser = async (email: string, firstName: string, lastName?: string, record?: Record<string, any>) => {
    try {
      console.log(`[NOTIFY] Descargando guía PDF para ${email}...`);
      const pdfUrl = "https://mexnmpbpqtccaulekupo.supabase.co/storage/v1/object/sign/guia/Guia%20final%20Web%20App%20Flightlog%20con%20roster%20ARMS.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMWFlYjExMS03NDk0LTQzOGItYWJhNy0wMDQ4NWRlMTJhNDMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJndWlhL0d1aWEgZmluYWwgV2ViIEFwcCBGbGlnaHRsb2cgY29uIHJvc3RlciBBUk1TLnBkZiIsInNjb3BlIjoiZG93bmxvYWQiLCJpYXQiOjE3ODQ0MjE1NDYsImV4cCI6MjUwOTc0OTU0Nn0.Yps1PExzFPsFnecSGoyphtOL3Q5BacFkml76-cptgaU";
      const pdfResponse = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
      const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

      console.log(`[NOTIFY] Enviando welcome email a ${email}...`);
      const userName = `${firstName}${lastName ? ' ' + lastName : ''}`;
      await sendBrevoEmail(
        [{ email, name: firstName }],
        "¡Bienvenido a Personal Flight Log! ✈️",
        `
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
        [{ name: "FlightLog_Guia_Usuario.pdf", content: pdfBase64 }]
      );

      console.log(`[NOTIFY] Enviando notificación a admin para ${firstName}...`);
      const safeRecord = record || {};
      await sendBrevoEmail(
        [{ email: "gringo.soft.ar@gmail.com", name: "Admin" }],
        `Nuevo usuario registrado: ${firstName}`,
        `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color:#2563eb;">Nuevo registro en Personal Flight Log</h2>
            <table style="width:100%; border-collapse:collapse; margin-top:16px;">
              <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Nombre</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${firstName} ${lastName || safeRecord?.last_name || ''}</td></tr>
              <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Email</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${email}</td></tr>
              <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">ID</td><td style="padding:8px 12px; border:1px solid #e2e8f0; font-size:12px;">${safeRecord?.id || ''}</td></tr>
            </table>
            <p style="margin-top:20px; color:#64748b; font-size:13px;">Notificación automática del sistema.</p>
          </div>
        `
      );

      console.log(`[NOTIFY] Notificaciones completadas para ${email}.`);
    } catch (err: any) {
      console.error(`[NOTIFY] Error al notificar a ${email}:`, err.response?.data || err.message);
    }
  };

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
      sendProgress('Preparando navegador...', 20);
      const browser = await getBrowser();
      
      context = await browser.newContext({
        ignoreHTTPSErrors: true,
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
            dns.promises.resolve4(domain),
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
              // Internacionales → OACI (código 4 letras)
              "VVI": "SLVR", "SCL": "SCEL", "MVD": "SUMU", "PDP": "SULS",
              "ASU": "SGAS", "GRU": "SBGR", "GIG": "SBGL", "FLN": "SBFL",
              "SSA": "SBSV", "MCZ": "SBMO", "REC": "SBRF", "FOR": "SBFZ",
              "LIM": "SPJC", "BOG": "SKBO", "UIO": "SEQM", "PTY": "MPTO",
              "CUN": "MMUN", "MEX": "MMMX", "PUJ": "MDPC", "HAV": "MUHA",
              "MIA": "KMIA", "JFK": "KJFK", "MAD": "LEMD", "FCO": "LIRF",
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

  // --- ANAC TCP Sincronización API ---
  app.post("/api/sync-anac-tcp", async (req, res) => {
    const { user_id, anac_token, storageState, logs_to_sync } = req.body;

    if (!user_id || (!anac_token && !storageState)) {
      return res.status(400).json({ error: "user_id y sesión son requeridos" });
    }

    try {
      const results = [];
      const logs = logs_to_sync || [];

      let cookieHeader = "";
      if (storageState && storageState.cookies) {
        cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      } else {
        cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
      }

      console.log(`[SYNC_ANAC_TCP] Iniciando sincronización TCP con ${storageState ? 'sesión completa' : 'token simple'}`);

      const sortedLogs = [...logs].sort((a: any, b: any) => {
        return new Date(a.fechaHoraSalida || 0).getTime() - new Date(b.fechaHoraSalida || 0).getTime();
      });

      for (const log of sortedLogs) {
        try {
          const mapAirportCode = (code: string) => {
            const c = code.trim().toUpperCase();
            const ANAC_MAPPINGS: Record<string, string> = {
              "AEP": "AER", "SABE": "AER",
              "EZE": "EZE", "SAEZ": "EZE",
              "COR": "CBA", "SACO": "CBA",
              "MDZ": "DOZ", "SAMM": "DOZ",
              "BRC": "BAR", "SAZS": "BAR",
              "IGR": "IGU", "SARI": "IGU",
              "SLA": "SAL", "SASA": "SAL",
              "NQN": "NEU", "SAZN": "NEU",
              "TUC": "TUC", "SANT": "TUC",
              "USH": "USU", "SAWH": "USU",
              "FTE": "CAL", "SAWC": "CAL",
              "JUJ": "JUJ", "SASJ": "JUJ",
              "PSS": "POS", "SARP": "POS",
              "CNQ": "CRR", "SARC": "CRR",
              "RES": "SIS", "SARE": "SIS",
              "UAQ": "JUA", "SANU": "JUA",
              "LUQ": "UIS", "SAOU": "UIS",
              "CTC": "CAT", "SANC": "CAT",
              "IRJ": "LAR", "SANL": "LAR",
              "SFN": "SVO", "SAAV": "SVO",
              "PRA": "PAR", "SAAP": "PAR",
              "ROS": "ROS", "SAAR": "ROS",
              "VDM": "VIE", "SAVN": "VIE",
              "BHI": "BAI", "SAZB": "BAI",
              "MDQ": "MDP", "SAZM": "MDP",
              "REL": "TRW", "SAVT": "TRW",
              "PMY": "MAD", "SAVY": "MAD",
              "CRV": "CRV", "SAVC": "CRV",
              "RGL": "GAL", "SAWG": "GAL",
              "RGA": "GRA", "SAWE": "GRA",
              "CPC": "CHA", "SAZY": "CHA",
              "EQS": "ESQ", "SAVV": "ESQ",
              "LGS": "MAL", "SAMO": "MAL",
              "AFA": "SRA", "SAMR": "SRA",
              "RSA": "OSA", "SAWR": "OSA",
              "VVI": "SLVR", "SCL": "SCEL", "MVD": "SUMU", "PDP": "SULS",
              "ASU": "SGAS", "GRU": "SBGR", "GIG": "SBGL", "FLN": "SBFL",
              "SSA": "SBSV", "MCZ": "SBMO", "REC": "SBRF", "FOR": "SBFZ",
              "LIM": "SPJC", "BOG": "SKBO", "UIO": "SEQM", "PTY": "MPTO",
              "CUN": "MMUN", "MEX": "MMMX", "PUJ": "MDPC", "HAV": "MUHA",
              "MIA": "KMIA", "JFK": "KJFK", "MAD": "LEMD", "FCO": "LIRF",
            };
            return ANAC_MAPPINGS[c] || c;
          };

          const oriID = mapAirportCode(String(log.origenID || ""));
          const destID = mapAirportCode(String(log.destinoID || ""));

          let obs = log.observaciones || "";
          let authId = String(log.autoridadCertificanteID || "15");
          if (authId && isNaN(Number(authId))) {
            obs = authId + (obs ? " - " + obs : "");
            authId = "15";
          }

          const dSalida = new Date(log.fechaHoraSalida);
          const dLlegada = new Date(log.fechaHoraLlegada);
          if (dLlegada < dSalida) {
            dLlegada.setDate(dLlegada.getDate() + 1);
          }

          const payload = {
            Discriminaciones: [],
            discriminaciones: [],
            horasDia: String(parseFloat(log.horasDia || "0")),
            horasNoche: String(parseFloat(log.horasNoche || "0")),
            cargoID: 5,
            origenID: oriID,
            destinoID: destID,
            origenPersonalizado: "",
            destinoPersonalizado: "",
            fechaHoraSalida: dSalida.toISOString(),
            fechaHoraLlegada: dLlegada.toISOString(),
            aterrizajes: parseInt(log.aterrizajes || "1"),
            autoridadCertificanteID: String(authId),
            observaciones: obs,
            matriculaAvion: log.matriculaAvion,
            finalidadID: String(log.finalidadID || "79")
          };

          console.log("[SYNC_ANAC_TCP] Payload:", JSON.stringify(payload));

          let anacResponse;
          try {
            anacResponse = await axios.post(
              "https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/Create",
              payload,
              {
                headers: {
                  "Cookie": cookieHeader,
                  "Content-Type": "application/json; charset=utf-8",
                  "X-Requested-With": "XMLHttpRequest",
                  "Accept": "application/json, text/plain, */*",
                  "Origin": "https://cad.anac.gob.ar",
                  "Referer": "https://cad.anac.gob.ar/vuelotripulantetcp/create",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
                },
                timeout: 15000
              }
            );
          } catch (err: any) {
            if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
              anacResponse = await axios.post(
                "https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/Create",
                payload,
                {
                  headers: {
                    "Cookie": cookieHeader,
                    "Content-Type": "application/json; charset=utf-8",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": "https://cadam.anac.gob.ar",
                    "Referer": "https://cadam.anac.gob.ar/Cadam/vuelotripulantetcp/create",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36"
                  },
                  timeout: 15000
                }
              );
            } else {
              throw err;
            }
          }

          results.push({ id: log.id, status: "success", data: anacResponse.data });
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (itemError: any) {
          results.push({ id: log.id, status: "error", error: itemError.response?.data || itemError.message });
        }
      }

      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- ANAC TCP Get Logs API ---
  app.post("/api/get-anac-logs-tcp", async (req, res) => {
    const { anac_token, storageState, pageNumber = 1, rowsPerPage = 50 } = req.body;

    if (!anac_token && !storageState) {
      return res.status(400).json({ error: "Sesión de ANAC es requerida" });
    }

    try {
      let cookieHeader = "";
      if (storageState && storageState.cookies) {
        cookieHeader = storageState.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
      } else {
        cookieHeader = anac_token.includes("=") ? anac_token : `Auth.ANAC.localhost=${anac_token}`;
      }

      console.log(`[GET_ANAC_LOGS_TCP] Solicitando página ${pageNumber} de ANAC TCP...`);

      const url = `https://cad.anac.gob.ar/foliadoweb/api/VueloTripulante/GetPagedList?descripcion=&tipoTrip=TCP&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}&mostrarIngresados=true&solicitudFoliadoId=null`;

      let anacResponse;
      try {
        anacResponse = await axios.get(url, {
          headers: {
            "Cookie": cookieHeader,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/plain, */*",
            "Origin": "https://cad.anac.gob.ar",
            "Referer": "https://cad.anac.gob.ar/foliadoweb/VueloTripulante/Index",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
          },
          timeout: 15000
        });
      } catch (err: any) {
        if (err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED' || (err.response && err.response.status === 404)) {
          const fallbackUrl = `https://cadam.anac.gob.ar/Cadam/api/VueloTripulante/GetPagedList?descripcion=&tipoTrip=TCP&sortField=fechaSalida&sortDirection=DESC&pageNumber=${pageNumber}&rowsPerPage=${rowsPerPage}&mostrarIngresados=true&solicitudFoliadoId=null`;
          anacResponse = await axios.get(fallbackUrl, {
            headers: {
              "Cookie": cookieHeader,
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150.0.0.0 Safari/537.36"
            },
            timeout: 15000
          });
        } else {
          throw err;
        }
      }

      res.json(anacResponse.data);
    } catch (error: any) {
      console.error("[GET_ANAC_LOGS_TCP] Error:", error);
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

      await notifyNewUser(email, firstName, record?.last_name, record);
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

      try {
        const safeTitle = title.trim();
        const safeDesc = description.trim().substring(0, 500);
        await sendBrevoEmail(
          [{ email: "gringo.soft.ar@gmail.com", name: "Admin" }],
          `Bug Report: ${safeTitle}`,
          `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color:#dc2626;">Nuevo reporte de error</h2>
              <table style="width:100%; border-collapse:collapse; margin-top:16px;">
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Título</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${safeTitle}</td></tr>
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Descripción</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${safeDesc}${description.trim().length > 500 ? '...' : ''}</td></tr>
                <tr><td style="padding:8px 12px; background:#f8fafc; font-weight:bold; border:1px solid #e2e8f0;">Usuario</td><td style="padding:8px 12px; border:1px solid #e2e8f0;">${userEmail || 'No especificado'}</td></tr>
              </table>
            </div>
          `
        );
        console.log("[REPORT] Notificación enviada al admin");
      } catch (notifyErr: any) {
        console.error("[REPORT] Error enviando notificación:", notifyErr.response?.data || notifyErr.message);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[REPORT_ERR]", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Verificar si un email existe en la base de datos
  app.post("/api/check-email-exists", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: "Email requerido" });
    }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      res.json({ exists: !!data });
    } catch (error: any) {
      console.error("[CHECK_EMAIL]", error.message);
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
      'NAME:flightlog Roster',
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
          .send('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Personal Flight Log//ARMS Roster//ES\r\nNAME:flightlog Roster\r\nX-WR-CALNAME:flightlog Roster\r\nEND:VCALENDAR\r\n');
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

  // ══════════════════════════════════════════════════════════════════════
  // IMPORTACION MASIVA DE VUELOS
  // ══════════════════════════════════════════════════════════════════════

  const normalizeMatricula = (input: string): string => {
    const letters = (input || '').replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (letters.length !== 5) return letters;
    return `${letters.slice(0, 2)}-${letters.slice(2)}`;
  };

  const minutesToOACI = (m: number): number => {
    if (m <= 2) return 0;
    if (m <= 8) return 0.1;
    if (m <= 14) return 0.2;
    if (m <= 20) return 0.3;
    if (m <= 26) return 0.4;
    if (m <= 33) return 0.5;
    if (m <= 39) return 0.6;
    if (m <= 45) return 0.7;
    if (m <= 51) return 0.8;
    if (m <= 57) return 0.9;
    return 1.0;
  };

  const elapsedToOACI = (totalMinutes: number): number => {
    const hours = Math.floor(totalMinutes / 60);
    return hours + minutesToOACI(totalMinutes % 60);
  };

  const validateImportLog = (log: any, mode: string): string[] => {
    const errs: string[] = [];
    if (!log.fechaHoraSalida) errs.push('Fecha de salida requerida');
    if (!log.fechaHoraLlegada) errs.push('Fecha de llegada requerida');
    try {
      const sal = new Date(log.fechaHoraSalida);
      const lle = new Date(log.fechaHoraLlegada);
      if (isNaN(sal.getTime())) errs.push('Fecha de salida inválida');
      if (isNaN(lle.getTime())) errs.push('Fecha de llegada inválida');
      if (!isNaN(sal.getTime()) && !isNaN(lle.getTime())) {
        let diffMin = (lle.getTime() - sal.getTime()) / 60000;
        const hDia = Number(log.horasDia) || 0;
        const hNoche = Number(log.horasNoche) || 0;
        const totalH = hDia + hNoche;
        if (diffMin <= 0) {
          if (totalH > 0) diffMin += 1440;
          else errs.push('Salida debe ser anterior a llegada');
        }
        if (diffMin > 0 && totalH > 0) {
          const totalRef = elapsedToOACI(diffMin);
          if (totalH > totalRef + 0.01)
            errs.push(`Horas exceden el vuelo. Máximo: ${totalRef.toFixed(1)}h (declaraste ${totalH.toFixed(1)}h)`);
        }
      }
      if (sal > new Date()) errs.push('Fecha de salida futura');
    } catch { errs.push('Fechas inválidas'); }
    if (!log.origenID) errs.push('Origen requerido');
    if (!log.destinoID) errs.push('Destino requerido');
    if (!log.matriculaAvion) errs.push('Matrícula requerida');
    const matriculaLetters = (log.matriculaAvion || '').replace(/[^a-zA-Z]/g, '');
    if (log.matriculaAvion && matriculaLetters.length !== 5)
      errs.push('Matrícula inválida (debe tener 5 letras, ej: LVABC)');
    if (isNaN(Number(log.horasDia)) || Number(log.horasDia) < 0) errs.push('Horas día inválidas');
    if (isNaN(Number(log.horasNoche)) || Number(log.horasNoche) < 0) errs.push('Horas noche inválidas');
    if (isNaN(Number(log.aterrizajes)) || Number(log.aterrizajes) < 0) errs.push('Aterrizajes inválidos');
    return errs;
  };

  app.post("/api/import-flight-logs", async (req, res) => {
    try {
      const { user_id, logs, mode } = req.body;
      if (!user_id || !logs || !Array.isArray(logs)) {
        return res.status(400).json({ success: false, error: "user_id y logs son requeridos" });
      }

      // 1. Verificar suscripción de pago
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_id, subscription_end_date')
        .eq('id', user_id)
        .single();

      if (profileError) throw profileError;
      if (!profile?.subscription_id || !profile?.subscription_end_date || new Date(profile.subscription_end_date) <= new Date()) {
        return res.status(403).json({ success: false, error: "Se requiere suscripción activa de pago" });
      }

      // 2. Re-validar cada log
      const validated: any[] = [];
      const errors: { index: number; messages: string[] }[] = [];
      logs.forEach((log: any, i: number) => {
        const fieldErrs = validateImportLog(log, mode);
        if (fieldErrs.length > 0) {
          errors.push({ index: i, messages: fieldErrs });
        } else {
          validated.push({ ...log });
        }
      });

      // 3. Obtener max folio_number
      const { data: maxFolioData } = await supabase
        .from('flight_logs')
        .select('folio_number')
        .eq('user_id', user_id)
        .order('folio_number', { ascending: false })
        .limit(1);

      let nextFolio = (maxFolioData?.[0]?.folio_number || 0) + 1;

      // 4. Normalizar y asignar folio_numbers
      validated.forEach(log => {
        log.matriculaAvion = normalizeMatricula(log.matriculaAvion);
        log.horasDia = String(Number(log.horasDia).toFixed(1));
        log.horasNoche = String(Number(log.horasNoche).toFixed(1));
        log.aterrizajes = Number(log.aterrizajes);
        log.potencia = Number(log.potencia || 0);
        log.folio_number = nextFolio++;
        log.user_id = user_id;
        log.created_at = new Date().toISOString();
        // Ensure defaults
        if (mode === 'tcp') {
          log.cargoID = '5';
          log.tipoVueloID = '2';
          log.clase = log.clase || '';
          log.airfield_day_pilot = 0;
          log.airfield_day_copilot = 0;
          log.airfield_night_pilot = 0;
          log.airfield_night_copilot = 0;
          log.cross_country_day_pilot = 0;
          log.cross_country_day_copilot = 0;
          log.cross_country_night_pilot = 0;
          log.cross_country_night_copilot = 0;
          log.ifr_real_pilot = 0;
          log.ifr_real_copilot = 0;
          log.ifr_hood = 0;
          log.sim_instructor = 0;
          log.sim_student = 0;
          log.instruccion = 0;
          log.ifr_instrument = 0;
          log.multi_engine = 0;
          log.jet = 0;
          log.turboprop = 0;
          log.ag_application = 0;
        } else {
          log.cargoID = log.cargoID || '1';
          log.tipoVueloID = log.tipoVueloID || '2';
          log.clase = log.clase || 'D';
        }
      });

      // 5. Detectar duplicados
      const { data: existingLogs } = await supabase
        .from('flight_logs')
        .select('fechaHoraSalida, matriculaAvion, origenID, destinoID')
        .eq('user_id', user_id);

      const existingSet = new Set(
        (existingLogs || []).map(l => `${l.fechaHoraSalida}|${l.matriculaAvion}|${l.origenID}|${l.destinoID}`)
      );

      const toInsert: any[] = [];
      validated.forEach((log, i) => {
        const key = `${log.fechaHoraSalida}|${log.matriculaAvion}|${log.origenID}|${log.destinoID}`;
        if (existingSet.has(key)) {
          errors.push({ index: logs.indexOf(log), messages: ['Duplicado (misma fecha+matrícula+origen+destino)'] });
        } else {
          toInsert.push(log);
          existingSet.add(key);
        }
      });

      if (toInsert.length === 0) {
        return res.json({ success: true, inserted: 0, errors, total: logs.length });
      }

      // 6. Batch insert (max 500 por lote)
      const BATCH_SIZE = 500;
      let inserted = 0;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('flight_logs').insert(batch);
        if (insertError) {
          errors.push({ index: -1, messages: [`Error de base de datos en lote: ${insertError.message}`] });
        } else {
          inserted += batch.length;
        }
      }

      res.json({ success: true, inserted, errors, total: logs.length });
    } catch (error: any) {
      console.error("[IMPORT_LOGS_ERR]", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // MERCADO PAGO — Suscripción anual (redirect checkout)
  // ══════════════════════════════════════════════════════════════════════

  const mpClient = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || ""
  });


  let annualPlan: { id: string; initPoint: string; amount: number } | null = null;

  const getOrCreateAnnualPlan = async (backUrl: string) => {
    const { data: config, error: configError } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'subscription_amount')
      .maybeSingle();
    const amount = Number(config?.value) || 12000;

    if (annualPlan && annualPlan.amount === amount) return annualPlan;
    annualPlan = null;

    try {
      const plan = new PreApprovalPlan(mpClient);
      const result = await plan.create({
        body: {
          reason: `Suscripción Anual Personal Flight Log - $${amount.toLocaleString('es-AR')} ARS`,
          auto_recurring: {
            frequency: 12,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "ARS"
          },
          back_url: backUrl
        }
      });
      annualPlan = { id: result.id!, initPoint: result.init_point!, amount };
      console.log(`[MERCADOPAGO] Plan anual creado: ${annualPlan.id}, monto: $${amount}`);
      return annualPlan;
    } catch (error: any) {
      console.error("[MERCADOPAGO] Error al crear el plan:", error.response?.data || error.message);
      throw error;
    }
  };

  app.post("/api/mercadopago/register-with-trial", async (req, res) => {
    const { email, password, firstName, lastName, license, dni, legajo, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" });
    }

    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName }
      });

      if (authError) throw new Error(`Error creando usuario: ${authError.message}`);
      if (!authUser?.user?.id) throw new Error("No se pudo crear el usuario");

      const userId = authUser.user.id;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          first_name: firstName || "",
          last_name: lastName || "",
          license: license || "",
          dni: dni || "",
          legajo: legajo || "",
          subscription_end_date: trialEnd.toISOString(),
          subscription_status: 'trial',
          subscription_id: null,
          role: role || null
        }, { onConflict: 'id' });

      if (profileError) throw new Error(`Error guardando perfil: ${profileError.message}`);

      console.log(`[TRIAL] Usuario creado: ${email}, vence: ${trialEnd.toISOString()}`);

      notifyNewUser(email, firstName || "", lastName);

      const session = (authUser as any).session;
      res.json({
        success: true,
        access_token: session?.access_token || null,
        refresh_token: session?.refresh_token || null
      });
    } catch (error: any) {
      console.error("[TRIAL] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mercadopago/create-subscription", async (req, res) => {
    const { userId, email, password, firstName, lastName, license, dni, legajo } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" });
    }

    let backUrl = process.env.APP_URL || "http://localhost:5173";
    const hostHeader = req.headers.origin || req.headers.referer;
    if (hostHeader) {
      try {
        backUrl = new URL(hostHeader).origin;
      } catch (e) {}
    }

    if (backUrl.includes("localhost") || backUrl.includes("127.0.0.1")) {
      backUrl = process.env.VITE_API_URL || "https://personal-flight-log-antigravity-render.onrender.com";
      backUrl = backUrl.replace(/\/api$/i, "");
    }

    try {
      let externalRefId = userId;

      if (!externalRefId) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', email)
          .maybeSingle();

        if (existingUser) {
          externalRefId = existingUser.id;
        }
      }

      const { data: config } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'subscription_amount')
        .maybeSingle();
      const amount = Number(config?.value) || 12000;

      if (!externalRefId) {
        const { data: pendingReg, error: pendingError } = await supabase
          .from('pending_registrations')
          .upsert({
            email,
            password_hash: password,
            first_name: firstName || "",
            last_name: lastName || "",
            license: license || "",
            dni: dni || "",
            legajo: legajo || ""
          }, { onConflict: 'email' })
          .select('id')
          .single();

        if (pendingError) {
          throw new Error(`Error guardando registro temporal: ${pendingError.message}`);
        }
        externalRefId = pendingReg.id;
      }

      const callbackUrl = `${backUrl}/api/mercadopago/subscription-callback?external_reference=${encodeURIComponent(externalRefId)}&frontend_url=${encodeURIComponent(backUrl)}`;

      const dynamicPlan = new PreApprovalPlan(mpClient);
      const planResult = await dynamicPlan.create({
        body: {
          reason: `Suscripción Anual Personal Flight Log - $${amount.toLocaleString('es-AR')} ARS`,
          external_reference: externalRefId,
          auto_recurring: {
            frequency: 12,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "ARS"
          },
          back_url: callbackUrl
        } as any
      });

      let checkoutUrl = planResult.init_point!;
      checkoutUrl += `&external_reference=${encodeURIComponent(externalRefId)}&back_url=${encodeURIComponent(callbackUrl)}`;
      console.log(`[MERCADOPAGO] Plan dinámico creado: ${planResult.id}, Checkout URL: ${checkoutUrl}`);

      res.json({
        success: true,
        init_point: checkoutUrl
      });

    } catch (error: any) {
      console.error("[MERCADOPAGO_SUBSCRIBE_ERR]", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mercadopago/webhook", async (req, res) => {
    const { action, data, type } = req.body;
    console.log(`[MERCADOPAGO_WEBHOOK] Action: ${action}, Type: ${type}, Data ID: ${data?.id}`);

    if (type === "subscription" || (action && action.includes("subscription")) || req.body.resource) {
      try {
        const subscriptionId = data?.id || req.body.resource?.split("/").pop();
        if (!subscriptionId) {
          return res.status(400).send("No subscription ID found");
        }

        const preApproval = new PreApproval(mpClient);
        const subscription = await preApproval.get({ id: subscriptionId });

        const status = subscription.status;
        let pendingRegId = subscription.external_reference;
        if (!pendingRegId && subscription.back_url) {
          try {
            const urlObj = new URL(subscription.back_url);
            pendingRegId = urlObj.searchParams.get("external_reference") || undefined;
            console.log(`[MERCADOPAGO_WEBHOOK] Ref de fallback obtenida de back_url: ${pendingRegId}`);
          } catch (e) {}
        }

        console.log(`[MERCADOPAGO_WEBHOOK] Subscription: ${subscriptionId}, Status: ${status}, Ref: ${pendingRegId}`);

        if ((status === "authorized" || status === "approved") && pendingRegId) {
          let endDate: string;
          const { data: existingProfileCheck } = await supabase
            .from('profiles')
            .select('subscription_end_date')
            .eq('id', pendingRegId)
            .maybeSingle();

          if (existingProfileCheck?.subscription_end_date && new Date(existingProfileCheck.subscription_end_date) > new Date()) {
            const existingEnd = new Date(existingProfileCheck.subscription_end_date);
            existingEnd.setFullYear(existingEnd.getFullYear() + 1);
            endDate = existingEnd.toISOString();
            console.log(`[MERCADOPAGO_WEBHOOK] Stack: sumando 12 meses a end_date existente ${existingProfileCheck.subscription_end_date} → ${endDate}`);
          } else {
            endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const mpDate = subscription.next_payment_date || (subscription as any).end_date;
            if (mpDate && new Date(mpDate) > new Date()) {
              endDate = new Date(mpDate).toISOString();
            }
          }

          let { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              subscription_id: subscription.id,
              subscription_end_date: endDate,
              subscription_status: status,
              mp_payer_email: (subscription as any).payer_email || null
            })
            .eq('id', pendingRegId)
            .select('id')
            .maybeSingle();

          if (updateError) {
            console.error(`[MERCADOPAGO_WEBHOOK] Error al actualizar perfil: ${updateError.message}`);
          }

          if (updatedProfile) {
            console.log(`[MERCADOPAGO_WEBHOOK] Suscripción renovada/actualizada para usuario existente: ${pendingRegId}`);
          } else {
            const { data: pendingReg, error: getError } = await supabase
              .from('pending_registrations')
              .select('*')
              .eq('id', pendingRegId)
              .maybeSingle();

            if (getError) {
              console.error(`[MERCADOPAGO_WEBHOOK] Error al buscar registro temporal: ${getError.message}`);
              return res.status(500).send("DB Error");
            }

            if (pendingReg) {
              const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email: pendingReg.email,
                password: pendingReg.password_hash,
                email_confirm: true,
                user_metadata: {
                  first_name: pendingReg.first_name,
                  last_name: pendingReg.last_name,
                  license: pendingReg.license,
                  dni: pendingReg.dni,
                  legajo: pendingReg.legajo
                }
              });

              if (authError) {
                console.error(`[MERCADOPAGO_WEBHOOK] Error al crear usuario: ${authError.message}`);
              }

              if (authUser?.user) {
                const { error: profileUpdateError } = await supabase
                  .from('profiles')
                  .update({
                    subscription_id: subscription.id,
                    subscription_end_date: endDate,
                    subscription_status: status,
                    mp_payer_email: (subscription as any).payer_email || null
                  })
                  .eq('id', authUser.user.id)
                  .select('id')
                  .maybeSingle();

                if (profileUpdateError) {
                  console.error(`[MERCADOPAGO_WEBHOOK] Error al actualizar perfil: ${profileUpdateError.message}`);
                }

                const { data: checkProfile } = await supabase.from('profiles').select('id').eq('id', authUser.user.id).maybeSingle();
                if (!checkProfile) {
                   await supabase.from('profiles').insert({
                     id: authUser.user.id,
                     email: pendingReg.email,
                     first_name: pendingReg.first_name,
                     last_name: pendingReg.last_name,
                     license: pendingReg.license,
                     dni: pendingReg.dni,
                     legajo: pendingReg.legajo,
                     subscription_id: subscription.id,
                     subscription_end_date: endDate,
                     subscription_status: status,
                     mp_payer_email: (subscription as any).payer_email || null
                   });
                }
              }

              await supabase
                .from('pending_registrations')
                .delete()
                .eq('id', pendingRegId);

              console.log(`[MERCADOPAGO_WEBHOOK] Registro completo exitosamente para nuevo usuario: ${pendingReg.email}`);
              notifyNewUser(pendingReg.email, pendingReg.first_name || "", pendingReg.last_name);
            }
          }
        }
      } catch (err: any) {
        console.error("[MERCADOPAGO_WEBHOOK_ERR]", err.stack || err.message);
        return res.status(500).send(err.message);
      }
    } else if (type === "payment" || (action && action.includes("payment")) || req.body.resource) {
      try {
        const paymentId = data?.id || req.body.resource?.split("/").pop();
        if (paymentId) {
          const accessToken = process.env.MP_ACCESS_TOKEN;
          const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          const payment = response.data;
          const status = payment.status;
          let externalRef = payment.external_reference;
          let subscriptionId = payment.metadata?.preapproval_id || payment.subscription_id || payment.point_of_interaction?.transaction_data?.subscription_id || null;

          if (!externalRef && subscriptionId) {
            console.log(`[MERCADOPAGO_WEBHOOK_PAYMENT] Ref no encontrada en pago. Buscando en suscripción: ${subscriptionId}`);
            try {
              const preApproval = new PreApproval(mpClient);
              const sub = await preApproval.get({ id: subscriptionId });
              externalRef = sub.external_reference;
              if (!externalRef && sub.back_url) {
                const urlObj = new URL(sub.back_url);
                externalRef = urlObj.searchParams.get("external_reference");
                console.log(`[MERCADOPAGO_WEBHOOK_PAYMENT] Ref de fallback obtenida de back_url de suscripción: ${externalRef}`);
              }
            } catch (subErr: any) {
              console.error(`[MERCADOPAGO_WEBHOOK_PAYMENT] Error al obtener detalles de suscripción para ref:`, subErr.message);
            }
          }

          console.log(`[MERCADOPAGO_WEBHOOK_PAYMENT] Payment: ${paymentId}, Status: ${status}, Ref: ${externalRef}`);

          if (status === "approved" && externalRef) {
            let endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const payerEmail = (payment as any)?.payer?.email || null;

            let { data: updatedProfile, error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_id: subscriptionId,
                subscription_end_date: endDate,
                subscription_status: "authorized",
                mp_payer_email: payerEmail
              })
              .eq('id', externalRef)
              .select('id')
              .maybeSingle();

            if (updateError) {
              console.error(`[MERCADOPAGO_WEBHOOK_PAYMENT] Error al actualizar perfil: ${updateError.message}`);
            }

            if (updatedProfile) {
              console.log(`[MERCADOPAGO_WEBHOOK_PAYMENT] Suscripción renovada/actualizada para usuario existente: ${externalRef}`);
            } else {
              const { data: pendingReg, error: getError } = await supabase
                .from('pending_registrations')
                .select('*')
                .eq('id', externalRef)
                .maybeSingle();

              if (getError) {
                console.error(`[MERCADOPAGO_WEBHOOK_PAYMENT] Error al buscar registro temporal: ${getError.message}`);
                return res.status(500).send("DB Error");
              }

              if (pendingReg) {
                const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                  email: pendingReg.email,
                  password: pendingReg.password_hash,
                  email_confirm: true,
                  user_metadata: {
                    first_name: pendingReg.first_name,
                    last_name: pendingReg.last_name,
                    license: pendingReg.license,
                    dni: pendingReg.dni,
                    legajo: pendingReg.legajo
                  }
                });

                if (authUser?.user) {
                  const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({
                      subscription_id: subscriptionId,
                      subscription_end_date: endDate,
                      subscription_status: "authorized",
                      mp_payer_email: payerEmail
                    })
                    .eq('id', authUser.user.id);

                  const { data: checkProfile } = await supabase.from('profiles').select('id').eq('id', authUser.user.id).maybeSingle();
                  if (!checkProfile) {
                     await supabase.from('profiles').insert({
                       id: authUser.user.id,
                       email: pendingReg.email,
                       first_name: pendingReg.first_name,
                       last_name: pendingReg.last_name,
                       license: pendingReg.license,
                       dni: pendingReg.dni,
                       legajo: pendingReg.legajo,
                       subscription_id: subscriptionId,
                       subscription_end_date: endDate,
                       subscription_status: "authorized",
                       mp_payer_email: payerEmail
                     });
                  }
                }

                await supabase
                  .from('pending_registrations')
                  .delete()
                  .eq('id', externalRef);

                console.log(`[MERCADOPAGO_WEBHOOK_PAYMENT] Registro completo exitosamente para nuevo usuario: ${pendingReg.email}`);
                notifyNewUser(pendingReg.email, pendingReg.first_name || "", pendingReg.last_name);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[MERCADOPAGO_WEBHOOK_PAYMENT_ERR]", err.stack || err.message);
      }
    }

    res.status(200).send("OK");
  });

  const cancelHandler = async (req: any, res: any) => {
    const { user_id, subscription_id } = req.body;
    if (!user_id || !subscription_id) {
      return res.status(400).json({ error: "user_id y subscription_id son requeridos" });
    }

    try {
      const preApproval = new PreApproval(mpClient);
      await preApproval.update({
        id: subscription_id,
        body: {
          status: "cancelled"
        }
      });

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: "cancelled"
        })
        .eq('id', user_id);

      if (updateError) {
        throw updateError;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[MERCADOPAGO_CANCEL_ERR]", error.response?.data || error.message);
      res.status(500).json({ error: error.message });
    }
  };

  app.post("/api/mercadopago/cancel-subscription", cancelHandler);
  app.put("/api/mercadopago/cancel-subscription", cancelHandler);

  app.get("/api/mercadopago/subscription-callback", async (req, res) => {
    let preapproval_id = (req.query.preapproval_id || req.query.id) as string;
    let external_reference = req.query.external_reference as string;
    const status = req.query.status as string;

    const urlStr = req.url || "";
    console.log(`[MP_CALLBACK] Raw request URL: ${urlStr}`);

    const resolveFrontendUrl = () => {
      const frontendParam = req.query.frontend_url as string;
      if (frontendParam) {
        try { return new URL(frontendParam).origin; } catch (e) {}
      }
      let frontendUrl = process.env.VITE_API_URL || "https://personal-flight-log-antigravity-render.onrender.com";
      return frontendUrl.replace(/\/api$/i, "");
    };

    const userAgent = req.headers["user-agent"] || "";
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /ipad|iphone|ipod/i.test(userAgent);
    const isMobileParam = req.query.is_mobile === 'true';
    const finalIsMobile = isMobileParam || isAndroid || isIOS;

    const sendResponse = (paymentStatus: 'success' | 'error', params: Record<string, string>) => {
      const frontendUrl = resolveFrontendUrl();
      const queryParams = new URLSearchParams({ payment: paymentStatus, ...params }).toString();
      
      if (finalIsMobile) {
        if (isAndroid) {
          // Android Intent: Fuerza a abrir en el navegador predeterminado del sistema (Chrome/etc)
          const cleanHost = frontendUrl.replace(/^https?:\/\//i, '');
          const intentUrl = `intent://${cleanHost}/?${queryParams}#Intent;scheme=https;action=android.intent.action.VIEW;end`;
          console.log(`[MP_CALLBACK] Android detectado. Redirigiendo a intent: ${intentUrl}`);
          return res.redirect(intentUrl);
        } else {
          // iOS / Otros dispositivos móviles:
          // Redirigimos al frontend con el flag webview=true para mostrar la guía de escape en Safari
          console.log(`[MP_CALLBACK] iOS/Móvil detectado. Redirigiendo a webview helper: ${frontendUrl}?${queryParams}&webview=true`);
          return res.redirect(`${frontendUrl}?${queryParams}&webview=true`);
        }
      }
      
      console.log(`[MP_CALLBACK] Desktop detectado. Redirigiendo normalmente a: ${frontendUrl}?${queryParams}`);
      return res.redirect(`${frontendUrl}?${queryParams}`);
    };

    if (!preapproval_id || !external_reference) {
      const matchPreapproval = urlStr.match(/[?&](?:preapproval_id|id)=([^&?]+)/);
      if (matchPreapproval) {
        preapproval_id = decodeURIComponent(matchPreapproval[1]);
      }
      const matchExtRef = urlStr.match(/[?&]external_reference=([^&?]+)/);
      if (matchExtRef) {
        external_reference = decodeURIComponent(matchExtRef[1]);
      }
    }

    console.log(`[MP_CALLBACK] Parsed params - preapproval: ${preapproval_id}, ref: ${external_reference}, status: ${status}`);

    if (!preapproval_id) {
      return sendResponse("error", { reason: "missing_params" });
    }

    try {
      const preApproval = new PreApproval(mpClient);
      const sub = await preApproval.get({ id: preapproval_id as string });

      let finalExtRef = (external_reference as string) || sub.external_reference;
        if (!finalExtRef && sub.back_url) {
          try {
            const urlObj = new URL(sub.back_url);
            finalExtRef = urlObj.searchParams.get("external_reference") || undefined;
            console.log(`[MP_CALLBACK] Ref de fallback obtenida de back_url de suscripción: ${finalExtRef}`);
          } catch (e) {}
        }

        if (!finalExtRef) {
          console.error(`[MP_CALLBACK] No se pudo encontrar el external_reference para preapproval: ${preapproval_id}`);
          return sendResponse("error", { reason: "missing_reference" });
        }

        if (sub.status === "authorized" || sub.status === "approved") {
          let endDate: string;
          const { data: existingProfileCheck } = await supabase
            .from('profiles')
            .select('subscription_end_date')
            .eq('id', finalExtRef)
            .maybeSingle();

          if (existingProfileCheck?.subscription_end_date && new Date(existingProfileCheck.subscription_end_date) > new Date()) {
            const existingEnd = new Date(existingProfileCheck.subscription_end_date);
            existingEnd.setFullYear(existingEnd.getFullYear() + 1);
            endDate = existingEnd.toISOString();
            console.log(`[MP_CALLBACK] Stack: sumando 12 meses a end_date existente ${existingProfileCheck.subscription_end_date} → ${endDate}`);
          } else {
            endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const mpDate = (sub as any).next_payment_date || (sub as any).end_date;
            if (mpDate && new Date(mpDate) > new Date()) {
              endDate = new Date(mpDate).toISOString();
            }
          }

          let { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              subscription_id: sub.id,
              subscription_end_date: endDate,
              subscription_status: sub.status,
              mp_payer_email: (sub as any).payer_email || null
            })
            .eq('id', finalExtRef)
            .select('id')
            .maybeSingle();

          if (updateError) {
            console.error(`[MP_CALLBACK] Error al actualizar perfil existente: ${updateError.message}`);
          }

          if (updatedProfile) {
            try {
              const preApproval = new PreApproval(mpClient);
              await preApproval.update({
                id: sub.id!,
                body: {
                  external_reference: finalExtRef
                }
              });
              console.log(`[MP_CALLBACK] Asociado external_reference en MP para usuario existente: ${finalExtRef}`);
            } catch (mpErr: any) {
              console.error(`[MP_CALLBACK] Error al actualizar external_reference en MP para usuario existente:`, mpErr.response?.data || mpErr.message);
            }

            console.log(`[MP_CALLBACK] Suscripción renovada para: ${finalExtRef}`);
            return sendResponse("success", { renewal: "true" });
          }

          const { data: pendingReg } = await supabase
            .from('pending_registrations')
            .select('email, password_hash, first_name, last_name, license, dni, legajo')
            .eq('id', finalExtRef)
            .single();

          if (pendingReg) {
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: pendingReg.email,
              password: pendingReg.password_hash,
              email_confirm: true,
              user_metadata: {
                first_name: pendingReg.first_name || "",
                last_name: pendingReg.last_name || "",
                license: pendingReg.license || "",
                dni: pendingReg.dni || "",
                legajo: pendingReg.legajo || ""
              }
            });

            if (authError) {
              console.error(`[MP_CALLBACK] Error creando usuario: ${authError.message}`);
            }

            if (authUser?.user) {
              const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update({
                  subscription_id: sub.id,
                  subscription_end_date: endDate,
                  subscription_status: sub.status,
                  mp_payer_email: (sub as any).payer_email || null
                })
                .eq('id', authUser.user.id)
                .select('id')
                .maybeSingle();

              if (profileUpdateError) {
                console.error(`[MP_CALLBACK] Error al actualizar perfil post-creacion: ${profileUpdateError.message}`);
              }

              const { data: checkProfile } = await supabase.from('profiles').select('id').eq('id', authUser.user.id).maybeSingle();
              if (!checkProfile) {
                await supabase.from('profiles').insert({
                  id: authUser.user.id,
                  email: pendingReg.email,
                  first_name: pendingReg.first_name,
                  last_name: pendingReg.last_name,
                  license: pendingReg.license,
                  dni: pendingReg.dni,
                  legajo: pendingReg.legajo,
                  subscription_id: sub.id,
                  subscription_end_date: endDate,
                  subscription_status: sub.status,
                  mp_payer_email: (sub as any).payer_email || null
                });
              }

              try {
                const preApproval = new PreApproval(mpClient);
                await preApproval.update({
                  id: sub.id!,
                  body: {
                    external_reference: authUser.user.id
                  }
                });
                console.log(`[MP_CALLBACK] Actualizado external_reference en MP al UUID del nuevo usuario: ${authUser.user.id}`);
              } catch (mpErr: any) {
                console.error(`[MP_CALLBACK] Error al actualizar external_reference en MP para nuevo usuario:`, mpErr.response?.data || mpErr.message);
              }
            }

            await supabase
              .from('pending_registrations')
              .delete()
              .eq('id', finalExtRef);

            console.log(`[MP_CALLBACK] Usuario creado: ${authUser.user?.id || 'error'}`);
            notifyNewUser(pendingReg.email, pendingReg.first_name || "", pendingReg.last_name);
            return sendResponse("success", { newUser: "true" });
          }

          const { data: authUserCheck } = await supabase.auth.admin.getUserById(finalExtRef).catch(() => ({ data: null }));
          if (authUserCheck?.user) {
             try {
                await supabase.from('profiles').insert({
                   id: authUserCheck.user.id,
                   email: authUserCheck.user.email,
                   subscription_id: sub.id,
                   subscription_end_date: endDate,
                   subscription_status: sub.status,
                   mp_payer_email: (sub as any).payer_email || null
                });
             } catch (e) {
                console.error(e);
             }

             try {
               const preApproval = new PreApproval(mpClient);
               await preApproval.update({
                 id: sub.id!,
                 body: {
                   external_reference: authUserCheck.user.id
                 }
               });
               console.log(`[MP_CALLBACK] Actualizado external_reference en MP al UUID de authUserCheck: ${authUserCheck.user.id}`);
             } catch (mpErr: any) {
               console.error(`[MP_CALLBACK] Error al actualizar external_reference en MP para authUserCheck:`, mpErr.response?.data || mpErr.message);
             }

             return sendResponse("success", { renewal: "true" });
          }

          const { data: profileBySub } = await supabase
            .from('profiles')
            .select('id, email')
            .eq('subscription_id', sub.id)
            .maybeSingle();

          if (profileBySub) {
            console.log(`[MP_CALLBACK] Profile encontrado por subscription_id: ${profileBySub.id}`);
            return sendResponse("success", { renewal: "true" });
          }

          return sendResponse("error", { reason: "not_found" });
        } else {
          return sendResponse("error", { reason: sub.status || "unknown" });
        }
      } catch (error: any) {
        console.error("[MP_CALLBACK_ERR]", error.message);
        return sendResponse("error", { reason: "server_error" });
      }
  });

  // ══════════════════════════════════════════════════════════════════════
  // FIN — Mercado Pago
  // ══════════════════════════════════════════════════════════════════════

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
