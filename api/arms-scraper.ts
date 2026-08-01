// ═══════════════════════════════════════════════════════════════════════════
// ARMS ROSTER SCRAPER + PARSER
// ═══════════════════════════════════════════════════════════════════════════
// Este archivo contiene dos módulos principales:
//   1. SCRAPER  — Usa Playwright para hacer login en el portal ARMS
//                 (fbz.arms.aero/CREWPORTAL) y extraer el HTML del roster.
//   2. PARSER   — Convierte el HTML complejo (con rowspan/colspan) a un
//                 array limpio de ArmsDayEntry[] con tramos, tripulación
//                 y eventos de tierra.
//
// El portal ARMS usa ASP.NET WebForms con __VIEWSTATE / __EVENTVALIDATION.
// Playwright maneja estos estados automáticamente a través del DOM real.
// ═══════════════════════════════════════════════════════════════════════════

import type { Browser, BrowserContext } from 'playwright';
import { parse as parseHtml } from 'node-html-parser';
import type { ArmsDayEntry, ArmsFlightLeg, ArmsCrewMember } from '../src/types';
import * as fs from 'fs/promises';

// ─── CONSTANTES ───────────────────────────────────────────────────────────
const ARMS_LOGIN_URL = 'https://fbz.arms.aero/CREWPORTAL/loginnew.aspx';
const NAV_TIMEOUT    = 45000; // Timeout de navegación (45s)
const ELEMENT_TIMEOUT = 15000; // Timeout de espera de elementos (15s)

// ─── MAPEO DE MESES (Inglés → Numérico) ──────────────────────────────────
const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECCIÓN 1: SCRAPER — Login en ARMS + Extracción del HTML del roster    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Ejecuta el flujo completo de scraping del portal ARMS:
 *   1. Navega al login y completa credenciales
 *   2. Verifica login exitoso (redirección al dashboard)
 *   3. Navega a la sección "Crew Daily Roster"
 *   4. Configura el rango de fechas (mes completo)
 *   5. Activa checkbox de Crew Complement
 *   6. Hace clic en VIEW y extrae el HTML de la tabla
 *
 * @param browser    — Instancia global de Playwright Browser
 * @param username   — Usuario de ARMS (legajo o email)
 * @param password   — Contraseña de ARMS
 * @param month      — Mes objetivo (1-12)
 * @param year       — Año objetivo (e.g. 2026)
 * @returns          — HTML de la tabla del roster + storageState de cookies
 */
export async function scrapeArmsRoster(
  browser: Browser,
  username: string,
  password?: string,
  month?: number,
  year?: number,
  sessionData?: any
): Promise<{ html: string; storageState: any }> {

  let context: BrowserContext | null = null;
  
  // Usar mes y año actuales si no se especifican
  const targetMonth = month ?? (new Date().getMonth() + 1);
  const targetYear = year ?? new Date().getFullYear();

  try {
    // ── PASO 0: Crear contexto de navegador aislado ─────────────────────
    // Cada sync usa su propio contexto para evitar colisiones de cookies.
    context = await browser.newContext({
      userAgent:   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport:    { width: 1280, height: 900 },
      locale:      'es-AR',
      timezoneId:  'America/Argentina/Buenos_Aires',
      storageState: sessionData || undefined,
    });

    const page = await context.newPage();

    // ── PASO 1: Navegar a la página de login de ARMS ────────────────────
    console.log('[ARMS_SCRAPER] Paso 1/6: Navegando al portal ARMS...');
    await page.goto(ARMS_LOGIN_URL, {
      waitUntil: 'networkidle',
      timeout: NAV_TIMEOUT,
    });

    let loggedIn = false;
    if (sessionData) {
      // Si la URL ya no contiene "loginnew", fuimos redirigidos (la sesión es válida)
      const currentUrl = page.url();
      if (!currentUrl.toLowerCase().includes('login')) {
        console.log('[ARMS_SCRAPER] Sesión cargada correctamente desde storageState. Omitiendo login.');
        loggedIn = true;
      } else {
        console.log('[ARMS_SCRAPER] Las cookies de sesión expiraron. Se requiere login completo.');
      }
    }

    if (!loggedIn) {
      if (!password) {
        throw new Error('La sesión de ARMS expiró y no se proporcionó contraseña para volver a iniciar sesión.');
      }
      // ── PASO 2: Completar credenciales (ASP.NET WebForms) ───────────────
      // ARMS usa inputs con IDs generados dinámicamente por ASP.NET.
      // Buscamos por tipo y atributos genéricos para mayor robustez.
      console.log('[ARMS_SCRAPER] Paso 2/6: Completando credenciales...');
      await page.waitForSelector('input[type="text"], input[id*="user" i], input[id*="User"]', {
        state: 'visible',
        timeout: ELEMENT_TIMEOUT,
      });

      const userField = page.locator('input[type="text"]').first();
      const passField = page.locator('input[type="password"]').first();

      // .fill() limpia el campo antes de escribir (más seguro que .type())
      await userField.fill(username);
      await passField.fill(password);

      // ── PASO 3: Hacer clic en Login y esperar redirección ───────────────
      // ASP.NET mantiene el estado con __VIEWSTATE — Playwright lo maneja automáticamente.
      console.log('[ARMS_SCRAPER] Paso 3/6: Enviando formulario de login...');
      const submitBtn = page.locator(
        'input[type="submit"], button[type="submit"], input[value*="Log" i], input[value*="Sign" i]'
      ).first();

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: NAV_TIMEOUT }).catch(() => {}),
        submitBtn.click(),
      ]);
    }

    // ── Verificación de login exitoso ──────────────────────────────────
    // Si la URL sigue conteniendo "login", el login falló.
    const postLoginUrl = page.url();
    if (postLoginUrl.toLowerCase().includes('login')) {
      // Intentar capturar mensaje de error del portal
      const portalError = await page
        .locator('.error, .alert, [class*="error" i], [class*="validation" i]')
        .first()
        .innerText()
        .catch(() => '');
      throw new Error(
        `Login fallido en ARMS. ${portalError || 'Verifica tus credenciales del portal.'}`
      );
    }
    console.log('[ARMS_SCRAPER] Login exitoso. Dashboard URL:', postLoginUrl);

    // ── Detección de página de cambio de contraseña obligatorio ────────
    // ARMS redirige a ChangePassword.aspx cuando la contraseña está por
    // expirar o ya expiró. Detectamos por URL y por contenido de la página.
    const isPasswordChangePage =
      postLoginUrl.toLowerCase().includes('changepassword') ||
      postLoginUrl.toLowerCase().includes('change_password') ||
      postLoginUrl.toLowerCase().includes('passwordexpir');

    if (!isPasswordChangePage) {
      // Verificar también por contenido de la página (por si la URL no es obvia)
      const pageText = await page.textContent('body').catch(() => '');
      const hasPasswordChangeContent =
        /change\s*password/i.test(pageText) &&
        (/password\s*(is\s*)?expir/i.test(pageText) || /old\s*password/i.test(pageText));

      if (hasPasswordChangeContent) {
        console.log('[ARMS_SCRAPER] Detectada página de cambio de contraseña por contenido.');
        throw new Error(
          'ARMS_PASSWORD_EXPIRED: Tu contraseña de ARMS está por expirar o ya expiró. ' +
          'Ingresá al portal ARMS desde un navegador para actualizarla antes de sincronizar.'
        );
      }
    } else {
      console.log('[ARMS_SCRAPER] Detectada redirección a página de cambio de contraseña:', postLoginUrl);
      throw new Error(
        'ARMS_PASSWORD_EXPIRED: Tu contraseña de ARMS está por expirar o ya expiró. ' +
        'Ingresá al portal ARMS desde un navegador para actualizarla antes de sincronizar.'
      );
    }

    // ── PASO 4: Navegar DIRECTAMENTE a CrewDailyRoster.aspx por URL ─────
    // En lugar de buscar el link del menú (que varía entre versiones de ARMS
    // y puede llevar a páginas incorrectas), construimos la URL directamente
    // desde la base del portal usando la URL post-login del dashboard.
    console.log('[ARMS_SCRAPER] Paso 4/6: Navegando a Crew Daily Roster por URL directa...');
    
    const dashboardUrl = page.url(); // e.g. https://fbz.arms.aero/CREWPORTAL/indexnew.aspx
    const baseUrl = dashboardUrl.substring(0, dashboardUrl.lastIndexOf('/') + 1);
    const rosterUrl = baseUrl + 'CrewDailyRoster.aspx';
    
    console.log('[ARMS_SCRAPER] URL del Roster:', rosterUrl);
    
    try {
      await page.goto(rosterUrl, { waitUntil: 'networkidle', timeout: NAV_TIMEOUT });
    } catch {
      // Si networkidle falla (página con polling), continuar de todas formas
      await page.waitForTimeout(3000);
    }
    
    // Verificar que llegamos a la página correcta
    const rosterPageUrl = page.url();
    console.log('[ARMS_SCRAPER] URL actual tras navegación:', rosterPageUrl);
    
    // Volcar HTML de la página para diagnóstico (siempre, para ver la estructura real)
    const rosterPageHtml = await page.content().catch(() => '');
    await fs.writeFile('node_modules/arms_debug_crew_daily_roster.html', rosterPageHtml).catch(() => {});
    await page.screenshot({ path: 'node_modules/arms_debug_crew_daily_roster.png', fullPage: true }).catch(() => {});
    console.log('[ARMS_SCRAPER] Debug: HTML de CrewDailyRoster.aspx guardado en node_modules.');

    // ── PASO 5: Configurar rango de fechas (primer y último día del mes) ─
    // Los campos de fecha en CrewDailyRoster.aspx son:
    //   - txtFromDate (readonly, jQuery Datepicker, formato "DD-Mon-YYYY" e.g. "01-May-2026")
    //   - txtToDate   (readonly, jQuery Datepicker, formato "DD-Mon-YYYY" e.g. "31-May-2026")
    // Por ser readonly, usamos evaluate() para inyectar el valor directamente en el DOM.
    console.log(`[ARMS_SCRAPER] Paso 5/6: Configurando rango ${targetMonth}/${targetYear}...`);
    console.log('[ARMS_SCRAPER] URL en Paso 5:', page.url());
    
    const firstDay = new Date(targetYear, targetMonth - 1, 1);   // Primer día del mes
    const lastDay  = new Date(targetYear, targetMonth, 0);         // Último día del mes

    // Formato que usa CrewDailyRoster.aspx: "01-May-2026"
    const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatArmsDate = (d: Date): string =>
      `${String(d.getDate()).padStart(2, '0')}-${MONTH_NAMES_EN[d.getMonth()]}-${d.getFullYear()}`;

    const fromDateStr = formatArmsDate(firstDay);
    const toDateStr   = formatArmsDate(lastDay);
    console.log(`[ARMS_SCRAPER] Fechas formateadas: From=${fromDateStr} To=${toDateStr}`);

    // Setear el rango usando la API del jQuery UI Datepicker (los campos son readonly).
    // Asignar input.value directamente NO actualiza el estado interno del Datepicker
    // que ARMS usa al hacer VIEW → usaba el rango por defecto → tabla vacía.
    await page.evaluate(({ from, to }) => {
      const MONTHS: Record<string, number> = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
      const setDate = (id: string, val: string) => {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input) input.removeAttribute('readonly');
        const $ = (window as any).$;
        const $el = input ? $(input) : null;
        if ($el && $el.datepicker) {
          try {
            const p = val.split('-'); // DD-Mon-YYYY
            $el.datepicker('setDate', new Date(parseInt(p[2], 10), MONTHS[p[1]], parseInt(p[0], 10)));
            return;
          } catch { /* caer al valor directo */ }
        }
        if (input) input.value = val;
      };
      setDate('txtFromDate', from);
      setDate('txtToDate', to);
    }, { from: fromDateStr, to: toDateStr });

    // Verificar que las fechas quedaron aplicadas en los inputs
    const dateCheck = await page.evaluate(() => {
      const f = document.getElementById('txtFromDate') as HTMLInputElement | null;
      const t = document.getElementById('txtToDate') as HTMLInputElement | null;
      return { from: f?.value || '', to: t?.value || '' };
    }).catch(() => ({ from: '', to: '' }));
    console.log(`[ARMS_SCRAPER] Fechas configuradas via JS eval. Verificación: From=${dateCheck.from} To=${dateCheck.to}`);

    // ── PASO 6A: Activar checkbox "Show Crew Complement" ────────────────
    // Este checkbox es INDISPENSABLE: sin él, los nombres de la tripulación
    // no aparecen en las celdas expandidas de la tabla.
    console.log('[ARMS_SCRAPER] Paso 6/6: Activando Crew Complement y haciendo clic en VIEW...');
    const checkboxSelectors = [
      'input[type="checkbox"][id*="crew" i]',
      'input[type="checkbox"][id*="Crew" i]',
      'input[type="checkbox"][id*="complement" i]',
      'input[type="checkbox"][id*="Complement" i]',
      'input[type="checkbox"][id*="show" i]',
    ];

    for (const sel of checkboxSelectors) {
      try {
        const cb = page.locator(sel).first();
        if (await cb.isVisible({ timeout: 2000 })) {
          const isChecked = await cb.isChecked();
          if (isChecked) await cb.uncheck();
          console.log('[ARMS_SCRAPER] Checkbox Crew Complement configurado.');
          break;
        }
      } catch { continue; }
    }

    // ── PASO 6B: Clic en botón VIEW ─────────────────────────────────────
    // ID real confirmado del HTML: btnView (input type="submit" value="View")
    console.log('[ARMS_SCRAPER] Haciendo clic en VIEW...');
    let viewClicked = false;
    
    // Intentar primero por ID exacto (lo más fiable)
    try {
      const btnById = page.locator('#btnView');
      if (await btnById.isVisible({ timeout: 3000 })) {
        await btnById.click();
        await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
        viewClicked = true;
        console.log('[ARMS_SCRAPER] Botón VIEW clickeado por ID #btnView.');
      }
    } catch { /* intentar fallbacks */ }

    // Fallbacks si el ID cambió
    if (!viewClicked) {
      const viewBtnSelectors = [
        'input[type="submit"][value*="View" i]',
        'input[type="button"][value*="View" i]',
        'input[name="btnView"]',
        'button:has-text("View")',
      ];
      for (const sel of viewBtnSelectors) {
        try {
          const btn = page.locator(sel).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT });
            viewClicked = true;
            console.log('[ARMS_SCRAPER] Botón VIEW clickeado por selector:', sel);
            break;
          }
        } catch { continue; }
      }
    }

    if (!viewClicked) {
      console.log('[ARMS_SCRAPER] Error encontrando botón VIEW. Guardando HTML y screenshot para debug...');
      await page.screenshot({ path: 'node_modules/arms_debug_roster.png', fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => '');
      await fs.writeFile('node_modules/arms_debug_roster.html', html).catch(() => {});
      throw new Error('No se encontró el botón VIEW (btnView) en la sección de Crew Daily Roster.');
    }

    // ── Esperar a que el grid tenga datos reales (no tiempo fijo) ─────────
    // ARMS puede llenar la tabla vía AJAX después del VIEW; capturar antes = tabla vacía.
    const dataSelectors = [
      'table#SpreadMask_viewTable',
      'table#sprFlightDuties_viewTable',
      'table[id*="SpreadMask" i]',
      'table[id*="FlightDuties" i]',
      'table#sprDeadHead_viewTable',
    ];
    const dataDeadline = Date.now() + 15000;
    let rowsReady = false;
    while (Date.now() < dataDeadline && !rowsReady) {
      try {
        const rowCount = await page.evaluate((sels) => {
          for (const s of sels) {
            const el = document.querySelector(s);
            if (el) {
              const rows = el.querySelectorAll('tr').length;
              if (rows > 1) return rows;
            }
          }
          return 0;
        }, dataSelectors).catch(() => 0);
        if (rowCount > 1) {
          rowsReady = true;
          console.log(`[ARMS_SCRAPER] Grid con datos listo (${rowCount} filas).`);
        }
      } catch { /* continuar polling */ }
      if (!rowsReady) await page.waitForTimeout(500);
    }
    if (!rowsReady) {
      console.warn('[ARMS_SCRAPER] El grid no mostró filas de datos tras 15s. Se extraerá igual (posible tabla vacía).');
    }

    // ── Extraer HTML completo de la tabla de resultados ──────────────────
    // ARMS renderiza la tabla del roster en distintos contenedores según versión.
    // Usamos los IDs de los controles FarPoint Spread que tienen los datos.
    const tableSelectors = [
      'table#SpreadMask_viewTable',
      'table#sprFlightDuties_viewTable',
      'table[id*="SpreadMask" i]',
      'table[id*="FlightDuties" i]',
      'table#sprDeadHead_viewTable',
      '#divResults table',
      '.roster-table',
      'table[id*="roster" i]',
      'table[id*="grid" i]',
      'table',
    ];

    let tableHtml = '';
    for (const sel of tableSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 5000 })) {
          // Esperar un momento adicional para que los datos carguen dentro del Grid si es dinámico
          await page.waitForTimeout(2000);
          tableHtml = await el.innerHTML();
          if (tableHtml.length > 500) {
            console.log(`[ARMS_SCRAPER] Tabla encontrada con selector: ${sel}`);
            break;
          }
        }
      } catch { continue; }
    }

    if (!tableHtml || tableHtml.length < 50) {
      throw new Error('No se pudo extraer la tabla del roster de ARMS. El contenido parece vacío.');
    }

    console.log(`[ARMS_SCRAPER] HTML del roster extraído exitosamente (${tableHtml.length} caracteres).`);

    // Diagnóstico: contar filas y mostrar un snippet para ver si hay datos
    const trCount = (tableHtml.match(/<tr[ >]/gi) || []).length;
    console.log(`[ARMS_SCRAPER] Filas (<tr>) en la tabla: ${trCount}. Snippet: ${tableHtml.substring(0, 300)}`);

    // ── Capturar cookies para sesiones futuras (cron job) ────────────────
    const storageState = await context.storageState();
    await context.close();

    return { html: tableHtml, storageState };

  } catch (error) {
    // Limpieza: cerrar contexto en caso de error
    if (context) await context.close().catch(() => {});
    throw error;
  }
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECCIÓN 2: PARSER — Convierte el HTML de la tabla a ArmsDayEntry[]     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Parsea el HTML extraído de la tabla del roster de ARMS.
 *
 * La tabla de ARMS tiene una estructura compleja con:
 *   - Celdas con `rowspan` para fechas que cubren múltiples tramos
 *   - Celdas con `colspan` para eventos que no son vuelo (OFF, STB, etc.)
 *   - Celdas expandidas de "Crew Complement" con nombres y roles
 *
 * El algoritmo:
 *   1. Recorre cada <tr> de la tabla
 *   2. Detecta cambios de fecha (celda con rowspan o patrón de fecha)
 *   3. Clasifica el tipo de evento (vuelo, OFF, standby, layover)
 *   4. Extrae los campos de cada tramo de vuelo
 *   5. Agrupa múltiples tramos bajo la misma fecha
 *   6. Calcula turn times entre tramos consecutivos
 *
 * @param html — innerHTML de la tabla del roster
 * @returns    — Array ordenado cronológicamente de ArmsDayEntry[]
 */
export function parseArmsRosterHtml(html: string): ArmsDayEntry[] {
  // ── Parsear HTML a DOM virtual ────────────────────────────────────────
  const root = parseHtml(`<table>${html}</table>`);
  const rows = root.querySelectorAll('tr');

  const entries: ArmsDayEntry[] = [];

  // Estado de tracking: la fecha actual que cubre los tramos con rowspan
  let currentDate    = '';  // Fecha original de ARMS (e.g. "02-May-2026")
  let currentDateISO = '';  // ISO normalizada (e.g. "2026-05-02")

  // ── Recorrer cada fila de la tabla ────────────────────────────────────
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const cells = rows[rowIdx].querySelectorAll('td, th');
    if (cells.length === 0) continue; // Fila vacía, saltar

    // ── 2.1: Detectar si esta fila introduce una nueva fecha ────────────
    // ARMS usa un <td rowspan="N"> con la fecha al inicio de un grupo de tramos.
    // Dependiendo de la versión de ARMS, la fecha puede estar en la celda 0 o 1.
    const dateRegex = /(\d{1,2})[-\/]([A-Za-z]{3}|\d{1,2})[-\/](\d{4})/;
    let foundDate = false;
    
    for (let i = 0; i < Math.min(6, cells.length); i++) {
      const cellText = cells[i].innerText.trim();
      const dateMatch = cellText.match(dateRegex);
      if (dateMatch) {
        currentDate    = cellText;
        currentDateISO = convertArmsDateToISO(cellText);
        foundDate = true;
        break;
      }
    }

    // Si no tenemos fecha válida aún, saltar esta fila
    if (!currentDateISO) continue;

    // ── 2.2: Identificar el tipo de tarea de esta fila ────────────
    // Buscar la celda que contiene el código de tarea (OP, DH, OFF, STB, NDA, OTH, GTR, LEAVE)
    const taskCell = findCellContaining(cells, /\b(OP|DH|OFF|STB|STBY|NDA|OTH|GTR|LEAVE)\b/i);
    const rawTask  = taskCell?.innerText.trim() || '';

    // Si no hay task reconocible, es una fila de cabecera/separador — saltar
    if (!rawTask) continue;

    // ── 2.3: Clasificar el evento ───────────────────────────────────────
    const eventType = classifyArmsTask(rawTask);

    // ════════════════════════════════════════════════════════════════════
    // CASO A: VUELO (FLIGHT_OP o FLIGHT_DH)
    // ════════════════════════════════════════════════════════════════════
    if (eventType === 'FLIGHT_OP' || eventType === 'FLIGHT_DH') {
      const leg = extractFlightLegFromCells(cells, rawTask);

      // Verificar si ya existe una entrada para esta fecha (multi-leg day)
      const existingIdx = entries.findIndex(e => e.dateISO === currentDateISO);
      if (existingIdx >= 0) {
        // ── Multi-tramo: añadir leg al día existente ────────────────
        const existing = entries[existingIdx];

        // Calcular turn time (tiempo en tierra entre el tramo anterior y este)
        if (existing.legs.length > 0) {
          const prevLeg = existing.legs[existing.legs.length - 1];
          leg.turnTime = calculateTurnTime(prevLeg.arrivalTimeLoc, leg.departureTimeLoc);
        }

        existing.legs.push(leg);
        // Recalcular total de bloque del día
        existing.dailyBlockTotal = accumulateBlockTimes(existing.legs);
      } else {
        // ── Primer tramo del día: crear nueva entrada ───────────────
        entries.push({
          date: currentDate,
          dateISO: currentDateISO,
          eventType,
          isFlight: true,
          legs: [leg],
          dailyBlockTotal: leg.blockTime,
          rawTask,
        });
      }

    // ════════════════════════════════════════════════════════════════════
    // CASO B: NO-VUELO (OFF / STANDBY / LAYOVER / UNKNOWN)
    // ════════════════════════════════════════════════════════════════════
    } else {
      // Evitar duplicados si ya hay una entrada para este día
      if (entries.find(e => e.dateISO === currentDateISO)) continue;

      // Extract remarks (second to last column, since last is Crew Complement)
      let rawRemarks = cells[cells.length - 2]?.innerText || '';
      if (!rawRemarks.replace(/&nbsp;/gi, ' ').trim() && cells.length > 0) {
          // Fallback just in case Crew Complement is missing
          rawRemarks = cells[cells.length - 1]?.innerText || '';
      }
      const remarks = rawRemarks.replace(/&nbsp;/gi, ' ').trim();

      // Extract times for STANDBY and GTR
      let startTimeLoc, startTimeUtc, endTimeLoc, endTimeUtc;
      if (eventType === 'STANDBY' || eventType === 'GTR') {
        const extractTimeLoc = (idx: number) => {
          const text = cells[idx]?.innerText || '';
          const match = text.match(/\d{1,2}:\d{2}(?=\s*\(?L\)?)/i);
          if (match) return match[0];
          const allMatches = text.match(/\d{1,2}:\d{2}/g);
          if (allMatches && allMatches.length > 1) return allMatches[1];
          if (allMatches) return allMatches[0];
          return '';
        };
        const extractTimeUtc = (idx: number) => {
          const text = cells[idx]?.innerText || '';
          const match = text.match(/\d{1,2}:\d{2}(?=\s*\(?Z\)?)/i);
          if (match) return match[0];
          const allMatches = text.match(/\d{1,2}:\d{2}/g);
          if (allMatches && allMatches.length > 1) return allMatches[0];
          return '';
        };
        
        const taskIdx = cells.findIndex(c => /\b(OP|DH|OFF|STB|STBY|NDA|OTH|GTR)\b/i.test(c.innerText));
        if (taskIdx >= 0) {
          const isGtr = eventType === 'GTR';
          const startOffset = isGtr ? 2 : 3;
          const endOffset = 4;
          if (taskIdx + startOffset < cells.length) {
            startTimeLoc = extractTimeLoc(taskIdx + startOffset);
            startTimeUtc = extractTimeUtc(taskIdx + startOffset);
          }
          if (taskIdx + endOffset < cells.length) {
            endTimeLoc   = extractTimeLoc(taskIdx + endOffset);
            endTimeUtc   = extractTimeUtc(taskIdx + endOffset);
          }
        }
      }

      const entry: ArmsDayEntry = {
        date: currentDate,
        dateISO: currentDateISO,
        eventType,
        isFlight: false,
        legs: [],
        dailyBlockTotal: '00:00',
        rawTask,
        remarks,
        startTimeLoc,
        startTimeUtc,
        endTimeLoc,
        endTimeUtc,
      };

      // ── Detección de Layover (pernocte fuera de base) ─────────────
      // Un layover se identifica por "NDA/Layover" o "NDA" + mención de aeropuerto
      if (eventType === 'LAYOVER') {
        // Buscar código ICAO (4 letras) o IATA (3 letras) en las celdas
        const allCellText = Array.from(cells).map(c => c.innerText).join(' ');
        const airportMatch = allCellText.match(/\b([A-Z]{4})\b/) || allCellText.match(/\b([A-Z]{3})\b/);
        entry.layoverAirport = airportMatch?.[1] || '';
        entry.layoverDuration = extractLayoverDurationFromCells(cells);
      }

      entries.push(entry);
    }
  }

  // ── Ordenar entradas cronológicamente ──────────────────────────────────
  entries.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // ── Post-procesamiento: detectar tramos que son continuación del día ───
  // anterior (mismo servicio). Si el último aterrizaje del día anterior
  // está a ≤13h de la salida del primer vuelo del día actual, se marca
  // como continuación y se calcula el turnTime cross-day.
  const MAX_CONTINUATION_MINUTES = 13 * 60; // 13 horas

  for (let i = 1; i < entries.length; i++) {
    const curr = entries[i];
    const prev = entries[i - 1];

    // Solo aplica si ambos días son vuelo y el día actual tiene legs
    if (!curr.isFlight || curr.legs.length === 0) continue;
    if (!prev.isFlight || prev.legs.length === 0) continue;

    // Verificar que sean días consecutivos
    const prevDate = new Date(prev.dateISO + 'T00:00:00');
    const currDate = new Date(curr.dateISO + 'T00:00:00');
    const dayDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    if (dayDiff !== 1) continue;

    // Calcular la diferencia real cruzando medianoche
    const prevLastLeg = prev.legs[prev.legs.length - 1];
    const currFirstLeg = curr.legs[0];

    const toMin = (t: string): number => {
      const p = t.split(':').map(Number);
      return (p[0] || 0) * 60 + (p[1] || 0);
    };

    // Si la llegada del día anterior (prev) ocurrió después de su salida, fue el mismo día prev.
    // Si la llegada es numéricamente menor que la salida, cruzó la medianoche (es del día curr).
    const prevLastArrivalMins = toMin(prevLastLeg.arrivalTimeLoc);
    const prevLastDepartureMins = toMin(prevLastLeg.departureTimeLoc);
    const currFirstDepartureMins = toMin(currFirstLeg.departureTimeLoc);

    let diffMins = 0;
    if (prevLastArrivalMins < prevLastDepartureMins) {
      // Ya cruzó la medianoche, ambos eventos ocurrieron el mismo día (curr)
      diffMins = currFirstDepartureMins - prevLastArrivalMins;
    } else {
      // La llegada ocurrió en el día anterior (prev)
      diffMins = (24 * 60 - prevLastArrivalMins) + currFirstDepartureMins;
    }

    // Si por alguna razón da negativo, sumar un día
    if (diffMins < 0) diffMins += 24 * 60;

    if (diffMins <= MAX_CONTINUATION_MINUTES) {
      currFirstLeg.isContinuation = true;
      // Calcular y asignar el turnTime cross-day
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      currFirstLeg.turnTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return entries;
}


// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECCIÓN 3: FUNCIONES HELPER DE PARSEO                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Convierte una fecha en formato ARMS a ISO 8601.
 * Ejemplo: "02-May-2026" → "2026-05-02"
 *          "15/06/2026"  → "2026-06-15"
 */
function convertArmsDateToISO(raw: string): string {
  const m = raw.match(/(\d{1,2})[-\/]([A-Za-z]{3}|\d{1,2})[-\/](\d{4})/);
  if (!m) return '';

  const day   = m[1].padStart(2, '0');
  const month = MONTH_MAP[m[2].toLowerCase()] || m[2].padStart(2, '0');
  const year  = m[3];

  return `${year}-${month}-${day}`;
}

/**
 * Clasifica el raw task string de ARMS en un ArmsDayEventType.
 *
 * Reglas de clasificación (orden de prioridad):
 *   - Contiene "OP"                      → FLIGHT_OP (vuelo operativo)
 *   - Contiene "DH"                      → FLIGHT_DH (deadhead/posicionamiento)
 *   - Exactamente "OFF"                  → OFF (día libre)
 *   - Contiene "LAYOVER"                 → LAYOVER (pernocte fuera de base)
 *   - Contiene "STB"/"STBY"/"NDA" solos  → STANDBY (guardia)
 *   - Cualquier otro                     → UNKNOWN
 */
function classifyArmsTask(task: string): ArmsDayEntry['eventType'] {
  const t = task.toUpperCase().trim();

  if (t.includes('OP'))                              return 'FLIGHT_OP';
  if (t.includes('DH'))                              return 'FLIGHT_DH';
  if (t === 'OFF')                                   return 'OFF';
  if (t.includes('LAYOVER'))                         return 'LAYOVER';
  if (t.includes('STB') || t.includes('STBY'))       return 'STANDBY';
  if (t.includes('GTR'))                             return 'GTR';
  if (t.includes('NDA') && !t.includes('LAYOVER'))   return 'NDA';
  if (t.includes('OTH'))                             return 'NDA';
  if (t.includes('LEAVE'))                           return 'LEAVE';

  return 'UNKNOWN';
}

/**
 * Busca la primera celda cuyo texto coincida con un patrón regex.
 * Usado para encontrar la celda de "task", "crew complement", etc.
 */
function findCellContaining(cells: any[], pattern: RegExp): any | null {
  for (const cell of cells) {
    if (pattern.test(cell.innerText)) return cell;
  }
  return null;
}

/**
 * Extrae los datos de un tramo de vuelo (leg) desde las celdas de una fila.
 *
 * Estructura típica de las celdas en ARMS (puede variar):
 *   [0] Fecha (o vacío si rowspan del día anterior)
 *   [1] Task type (OP, DH, etc.)
 *   [2] Vuelo + Ruta ("FO5210 AEP-TUC" o "FO5210 AEP TUC")
 *   [3] Hora Report Local
 *   [4] Hora Report UTC
 *   [5] STD Local (salida)
 *   [6] STD UTC
 *   [7] STA Local (llegada)
 *   [8] STA UTC
 *   [9] Block time
 *   [10] Day total (acumulado del día)
 *   [último] Crew Complement (nombres y roles)
 *
 * NOTA: Los índices se ajustan dinámicamente buscando patrones.
 */
function extractFlightLegFromCells(cells: any[], rawTask: string): ArmsFlightLeg {
  // Helper: extraer texto limpio de una celda por índice (safe)
  const getText = (idx: number): string => {
    if (idx < 0 || idx >= cells.length) return '';
    return cells[idx].innerText.trim();
  };

  // ── Buscar la celda de ruta de vuelo ("FO5210 AEP-TUC") ──────────────
  // Patrón: letras/números seguidos de un par de códigos IATA/ICAO
  let flightNumber = '';
  let origin       = '';
  let destination  = '';
  let routeCellIdx = -1;

  for (let i = 0; i < cells.length; i++) {
    const text = cells[i].innerText.trim();
    // Patrón flexible: "FO5210 AEP-TUC", "AR1234 SABE-SAEZ", "FOLV-KEF EZE-AEP"
    const routeMatch = text.match(/([A-Z0-9\-]+)\s+([A-Z]{3,4})[\s\-]+([A-Z]{3,4})/);
    if (routeMatch) {
      flightNumber = routeMatch[1];
      origin       = routeMatch[2];
      destination  = routeMatch[3];
      routeCellIdx = i;
      break;
    }
  }

  // Si no encontramos la ruta con el patrón, usar texto del índice dinámico según la celda de tarea
  if (!flightNumber) {
    const taskCell = findCellContaining(cells, /\b(OP|DH|OFF|STB|STBY|NDA|OTH|GTR|LEAVE)\b/i);
    const taskCellIdx = taskCell ? cells.indexOf(taskCell) : -1;
    // La celda de detalles de vuelo está inmediatamente después de la de tarea (Type of Duty)
    const fallbackIdx = taskCellIdx >= 0 ? taskCellIdx + 1 : 2;
    const fallback = getText(fallbackIdx);
    const parts = fallback.split(/[\s\-]+/).filter(Boolean);
    flightNumber = parts[0] || rawTask;
    origin       = parts[1] || '';
    destination  = parts[2] || '';
  }

  // ── Buscar celdas de horarios ─────────────────────────────────────────
  // Los horarios están típicamente en las columnas siguientes a la ruta.
  // Pueden incluir fechas ("02-May-2026 01:55") o sufijos ("01:55 L").
  // Extraemos la porción "HH:MM". Si la celda tiene (L) y (Z), las diferenciamos.
  const extractTimeLoc = (idx: number) => {
    const text = getText(idx);
    const match = text.match(/\d{1,2}:\d{2}(?=\s*\(?L\)?)/i);
    if (match) return match[0];
    // Fallback: si hay dos tiempos pero sin sufijo claro, asumimos el local es el segundo
    const allMatches = text.match(/\d{1,2}:\d{2}/g);
    if (allMatches && allMatches.length > 1) return allMatches[1];
    if (allMatches) return allMatches[0];
    return '';
  };

  const extractTimeUtc = (idx: number) => {
    const text = getText(idx);
    const match = text.match(/\d{1,2}:\d{2}(?=\s*\(?Z\)?)/i);
    if (match) return match[0];
    // Fallback: si hay dos tiempos, asumimos el UTC es el primero
    const allMatches = text.match(/\d{1,2}:\d{2}/g);
    if (allMatches && allMatches.length > 1) return allMatches[0];
    return '';
  };

  const extractBlockTime = (idx: number) => {
    const text = getText(idx);
    const match = text.match(/\d{1,2}:\d{2}/);
    return match ? match[0] : '';
  };

  // Si encontramos la ruta en routeCellIdx, los horarios vienen después
  let reportTimeLoc = '';
  let departureTimeLoc = '';
  let arrivalTimeLoc = '';
  let reportTimeUtc = '';
  let departureTimeUtc = '';
  let arrivalTimeUtc = '';
  let blockTime = '';

  if (routeCellIdx >= 0) {
    reportTimeLoc    = extractTimeLoc(routeCellIdx + 1);
    reportTimeUtc    = extractTimeUtc(routeCellIdx + 1);
    departureTimeLoc = extractTimeLoc(routeCellIdx + 2);
    departureTimeUtc = extractTimeUtc(routeCellIdx + 2);
    arrivalTimeLoc   = extractTimeLoc(routeCellIdx + 3);
    arrivalTimeUtc   = extractTimeUtc(routeCellIdx + 3);
    blockTime        = extractBlockTime(routeCellIdx + 4);
    
    // Fallback: a veces el block time está en la columna siguiente
    if (!blockTime || blockTime === '00:00') {
      const nextTime = extractBlockTime(routeCellIdx + 5);
      if (nextTime) blockTime = nextTime;
    }
  } else {
    // Fallback original si no encontramos la ruta por patrón
    const times = cells.map(c => {
      const m = c.innerText.trim().match(/\d{1,2}:\d{2}/g);
      return m ? m[m.length - 1] : null; // Tomar el último (asumiendo que es L)
    }).filter(Boolean) as string[];
    
    if (times.length >= 3) {
      reportTimeLoc = times[0];
      departureTimeLoc = times[1];
      arrivalTimeLoc = times[2];
      blockTime = times[3] || '';
    }
  }

  // ── Buscar block time (Fallback final) ────────────────────────────────
  // Si no hay block time separado, calcularlo de STD a STA
  if (!blockTime && departureTimeLoc && arrivalTimeLoc) {
    blockTime = calculateTurnTime(departureTimeLoc, arrivalTimeLoc);
  }

  // ── Extraer Crew Complement (última celda grande) ─────────────────────
  // La tripulación está en la última celda que contiene múltiples líneas
  const crewCell = cells[cells.length - 1]?.innerText || '';
  const crewComplement = parseCrewComplementText(crewCell);

  return {
    flightNumber,
    origin,
    destination,
    reportTimeLoc,
    reportTimeUtc,
    departureTimeLoc,
    departureTimeUtc,
    arrivalTimeLoc,
    arrivalTimeUtc,
    blockTime: blockTime || '00:00',
    crewComplement,
  };
}

/**
 * Parsea el texto de la celda de Crew Complement a un array de ArmsCrewMember.
 *
 * Formato típico del texto (cada línea = un tripulante):
 *   "CPT GONZALEZ MARTIN"
 *   "FO BASSETERRE ARIEL"
 *   "CC RODRIGUEZ LAURA"
 *   "PU FERNANDEZ MARIA"
 *
 * También puede venir como: "CAPTAIN - GONZALEZ MARTIN\nFIRST OFFICER - BASSETERRE ARIEL"
 */
function parseCrewComplementText(raw: string): ArmsCrewMember[] {
  if (!raw || raw.trim().length < 3) return [];

  // Separar por saltos de línea, <br>, o pipe |
  const lines = raw
    .replace(/<br\s*\/?>/gi, '\n')     // Convertir <br> HTML a newline
    .split(/[\n|]/)                      // Separar por newline o pipe
    .map(l => l.trim())                  // Limpiar espacios
    .filter(l => l.length > 2);          // Filtrar líneas vacías/cortas

  return lines.map(line => {
    // ── Detectar rol por palabras clave ────────────────────────────────
    const roleMatch = line.match(
      /\b(CPT|CAPTAIN|CMD|COMMANDER|FO|FIRST\s*OFFICER|COPILOT|CC|CABIN\s*CREW|PU|PURSER|COMISARIO)\b/i
    );

    const role = mapRoleToEnum(roleMatch?.[1] || '');

    // ── Extraer nombre (todo lo que no sea el rol) ─────────────────────
    const name = line
      .replace(/\b(CPT|CAPTAIN|CMD|COMMANDER|FO|FIRST\s*OFFICER|COPILOT|CC|CABIN\s*CREW|PU|PURSER|COMISARIO)\b/gi, '')
      .replace(/[-–—]/g, '')  // Limpiar separadores
      .trim();

    return { name, role };
  });
}

/**
 * Mapea el texto del rol aeronáutico al enum ArmsCrewMember['role'].
 */
function mapRoleToEnum(raw: string): ArmsCrewMember['role'] {
  const r = raw.toUpperCase().trim();
  if (r.includes('CPT') || r.includes('CAPTAIN') || r.includes('CMD') || r.includes('COMMANDER') || r === 'LS') return 'CPT';
  if (r.includes('FO')  || r.includes('FIRST')   || r.includes('COPILOT') || r === 'RS')                        return 'FO';
  if (r.includes('PU')  || r.includes('PURSER')   || r.includes('COMISARIO'))                                   return 'PU';
  if (r.includes('CC')  || r.includes('CABIN'))                                                                  return 'CC';
  return 'OTHER';
}

/**
 * Calcula el tiempo entre dos horarios locales HH:MM.
 * Ejemplo: calcTurnTime("17:50", "20:10") → "02:20"
 * Maneja cruces de medianoche automáticamente.
 */
function calculateTurnTime(arrival: string, departure: string): string {
  const toMinutes = (t: string): number => {
    const parts = t.split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  let diff = toMinutes(departure) - toMinutes(arrival);
  // Si es negativo, el siguiente tramo es al día siguiente (cruce de medianoche)
  if (diff < 0) diff += 24 * 60;

  const hours = Math.floor(diff / 60);
  const mins  = diff % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Suma todos los block times de un array de legs.
 * Ejemplo: ["03:20", "02:10"] → "05:30"
 */
function accumulateBlockTimes(legs: ArmsFlightLeg[]): string {
  const totalMinutes = legs.reduce((acc, leg) => {
    const parts = leg.blockTime.split(':').map(Number);
    return acc + (parts[0] || 0) * 60 + (parts[1] || 0);
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins  = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Intenta extraer la duración del layover de las celdas.
 * Busca patrones como "1d 4h", "24h", o calcula basado en horas.
 */
function extractLayoverDurationFromCells(cells: any[]): string {
  const allText = Array.from(cells).map(c => c.innerText).join(' ');

  // Patrón directo: "1d 4h" o "2d 6h"
  const directMatch = allText.match(/(\d+d)\s*(\d+h)/i);
  if (directMatch) return directMatch[0].trim();

  // Patrón de horas: "24h" o "48h"
  const hoursMatch = allText.match(/(\d+)\s*h/i);
  if (hoursMatch) {
    const totalHours = parseInt(hoursMatch[1]);
    if (totalHours >= 24) {
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;
      return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
    return `${totalHours}h`;
  }

  return '';
}
