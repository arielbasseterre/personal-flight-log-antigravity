import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { sendMessage } from "./telegram";
import { scrapeArmsRoster, parseArmsRosterHtml } from "../api/arms-scraper";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const checkRosters = async () => {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || !profiles.length) {
    console.log("[ROSTER_CHECK] No hay usuarios vinculados a Telegram");
    return;
  }

  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  const browser = await chromium.launch();

  try {
    for (const p of profiles) {
      try {
        const { data: session } = await supabase
          .from("arms_sessions")
          .select("session_data, arms_username")
          .eq("user_id", p.id)
          .maybeSingle();

        if (!session?.session_data) {
          await sendMessage(p.telegram_chat_id, "⚠️ No tengo tu sesión de ARMS guardada. Sincronizá tu roster una vez desde la app.");
          continue;
        }

        const { html } = await scrapeArmsRoster(browser, session.arms_username, undefined, month, year, session.session_data);
        const entries = parseArmsRosterHtml(html);
        const hash = crypto.createHash("sha256").update(JSON.stringify(entries)).digest("hex");

        const { data: existing } = await supabase
          .from("arms_roster")
          .select("roster_hash")
          .eq("user_id", p.id)
          .eq("month", month)
          .eq("year", year)
          .maybeSingle();

        if (existing && existing.roster_hash && existing.roster_hash !== hash) {
          await sendMessage(p.telegram_chat_id, "📅 Hay novedades en tu programación ARMS. Actualizá tu roster en la app.");
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
        await sendMessage(p.telegram_chat_id, `⚠️ No pude revisar tu programación ARMS.\nDetalle: ${detalle}\n\nSi es de sesión, volvé a sincronizar desde la app.`);
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
