import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium, type BrowserContext } from "playwright";
import { sendMessage } from "./telegram";
import { decryptPassword } from "./crypto";
import { scrapeArmsRoster, parseArmsRosterHtml } from "../api/arms-scraper";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const formatDay = (dateISO: string): string => {
  const [, m, d] = String(dateISO || "").split("-");
  return `${d}/${m}`;
};

const changedDaysText = (oldEntries: any[], newEntries: any[]): string => {
  const dates = (list: any[]) => new Set((list || []).map((e) => String(e?.dateISO || "")).filter(Boolean));
  const oldSet = dates(oldEntries);
  const newSet = dates(newEntries);
  const changed = new Set<string>();
  for (const d of newSet) if (!oldSet.has(d)) changed.add(d);
  for (const d of oldSet) if (!newSet.has(d)) changed.add(d);
  const sorted = [...changed].sort();
  if (!sorted.length) return "";
  if (sorted.length <= 5) return ` (días: ${sorted.map(formatDay).join(", ")})`;
  return ` (${sorted.length} días con cambios: ${sorted.slice(0, 3).map(formatDay).join(", ")}…)`;
};

const checkRosters = async () => {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || !profiles.length) {
    console.log("[ROSTER_CHECK] No hay usuarios vinculados a Telegram");
    return;
  }

  const WARN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
  const warn = async (userId: string, chatId: string, message: string) => {
    const key = `telegram_warn_${userId}`;
    const { data: prev } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
    const lastWarn = prev?.value ? parseInt(prev.value) : 0;
    if (Date.now() - lastWarn < WARN_COOLDOWN_MS) {
      console.log(`[ROSTER_CHECK] Aviso para ${userId} suprimido por cooldown`);
      return;
    }
    await sendMessage(chatId, message);
    await supabase.from("app_config").upsert({ key, value: String(Date.now()) }, { onConflict: "key" });
  };

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const browser = await chromium.launch();

  try {
    for (const p of profiles) {
      let context: BrowserContext | null = null;
      try {
        const { data: session } = await supabase
          .from("arms_sessions")
          .select("session_data, arms_username, arms_password_enc")
          .eq("user_id", p.id)
          .maybeSingle();

        if (!session?.session_data) {
          await warn(p.id, p.telegram_chat_id, "⚠️ No tengo tu sesión de ARMS guardada. Sincronizá tu roster una vez desde la app (marcá 'recordar sesión').");
          continue;
        }

        const password = decryptPassword(session.arms_password_enc) || undefined;
        console.log(`[ROSTER_CHECK] Usuario ${p.id} | password disponible: ${!!password} | arms_password_enc: ${session.arms_password_enc ? "si" : "no"}`);

        // Crear contexto aislado por usuario (cookies/sesión separadas)
        context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 900 },
          locale: 'es-AR',
          timezoneId: 'America/Argentina/Buenos_Aires',
          storageState: session.session_data,
        });

        const { html } = await scrapeArmsRoster(browser, session.arms_username, password, month, year, session.session_data, context);
        const entries = parseArmsRosterHtml(html);
        const hash = crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex");

        const { data: existing } = await supabase
          .from("arms_roster")
          .select("roster_hash, roster_json")
          .eq("user_id", p.id)
          .eq("month", month)
          .eq("year", year)
          .maybeSingle();

        if (existing && existing.roster_hash && existing.roster_hash !== hash) {
          const days = changedDaysText(existing.roster_json, entries);
          await sendMessage(p.telegram_chat_id, `📅 Hubo cambios en tu programación ARMS${days}. Ya actualizamos tu roster en la app.`);
        }

        await supabase
          .from("arms_roster")
          .upsert(
            { user_id: p.id, month, year, roster_json: entries, roster_hash: hash, synced_at: new Date().toISOString() },
            { onConflict: "user_id,month,year" }
          );
      } catch (e: any) {
        console.error(`[ROSTER_CHECK] Error usuario ${p.id}:`, e.message);
        const detalle = (e?.message || "").toString().slice(0, 120);
        await warn(p.id, p.telegram_chat_id, `⚠️ No pude revisar tu programación ARMS (sesión vencida o error).\nDetalle: ${detalle}\n\nRe-sincronizá tu roster en la app marcando 'recordar sesión'.`);
      } finally {
        // Cerrar contexto del usuario (libera cookies), NO el browser
        if (context) await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close();
  }
};

const main = async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const ref = url.replace(/^https:\/\//, "").split(".")[0];
  console.log(`[TELEGRAM_BOT] Iniciando chequeo de roster | Supabase ref=${ref} | token set=${!!process.env.TELEGRAM_BOT_TOKEN}`);
  await checkRosters();
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[TELEGRAM_BOT] Error fatal:", e);
    process.exit(1);
  });
