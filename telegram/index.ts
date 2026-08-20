import "dotenv/config";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { sendMessage, getUpdates } from "./telegram";
import { scrapeArmsRoster, parseArmsRosterHtml } from "../api/arms-scraper";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const getLastUpdateId = async (): Promise<number> => {
  try {
    const { data } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "telegram_last_update_id")
      .maybeSingle();
    const n = Number(data?.value);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const setLastUpdateId = async (id: number) => {
  await supabase
    .from("app_config")
    .upsert({ key: "telegram_last_update_id", value: String(id) }, { onConflict: "key" });
};

const processCommands = async () => {
  const last = await getLastUpdateId();
  const updates = await getUpdates(last ? last + 1 : 0);
  if (!updates.length) {
    console.log("[TELEGRAM] No hay updates pendientes");
    return;
  }

  console.log(`[TELEGRAM] Procesando ${updates.length} update(s)`);
  for (const u of updates) {
    const msg = u.message;
    const chatId = msg?.chat?.id;
    const text = (msg?.text || "").trim();
    console.log(`[TELEGRAM] update_id=${u.update_id} chat=${chatId} text="${text}"`);
    if (chatId == null) continue;

    if (text.startsWith("/start")) {
      await sendMessage(chatId, "👋 Hola! Para vincular tu cuenta enviá:\n/registrar <codigo>\n\nEl código lo generás en la app (sección Roster ARMS).");
    } else if (text.startsWith("/registrar")) {
      const parts = text.split(/\s+/);
      const code = parts[1]?.trim();
      console.log(`[TELEGRAM] Comando /registrar con codigo="${code}"`);
      await handleRegistrar(chatId, msg?.from?.username, code);
    } else {
      console.log(`[TELEGRAM] Texto no reconocido, ignorado`);
    }
  }

  const lastId = updates[updates.length - 1]?.update_id;
  if (typeof lastId === "number") {
    await setLastUpdateId(lastId);
    console.log(`[TELEGRAM] last_update_id guardado: ${lastId}`);
  }
};

const handleRegistrar = async (chatId: number, username: string | undefined, code: string | undefined) => {
  if (!code) {
    console.log("[TELEGRAM] /registrar sin codigo");
    await sendMessage(chatId, "Uso correcto: /registrar <codigo>\nGenerá un código en la app, sección Roster ARMS.");
    return;
  }
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, telegram_code, telegram_code_expires_at")
    .eq("telegram_code", code)
    .maybeSingle();

  if (error) {
    console.error("[TELEGRAM] Error buscando perfil por codigo:", error.message);
    await sendMessage(chatId, "⚠️ Error interno al vincular. Intentalo más tarde.");
    return;
  }

  if (!profile) {
    console.log(`[TELEGRAM] Codigo "${code}" no encontrado en profiles`);
    await sendMessage(chatId, "❌ Código inválido. Generá uno nuevo en la app.");
    return;
  }
  if (profile.telegram_code_expires_at && new Date(profile.telegram_code_expires_at) < new Date()) {
    await sendMessage(chatId, "⏰ El código expiró. Generá uno nuevo en la app.");
    return;
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({
      telegram_chat_id: String(chatId),
      telegram_username: username || null,
      telegram_code: null,
      telegram_code_expires_at: null,
    })
    .eq("id", profile.id);

  if (upErr) {
    console.error("[TELEGRAM] Error vinculando chat al perfil:", upErr.message);
    await sendMessage(chatId, "⚠️ Error guardando la vinculación. Intentalo más tarde.");
    return;
  }

  console.log(`[TELEGRAM] Perfil ${profile.id} vinculado a chat ${chatId}`);
  await sendMessage(chatId, "✅ Cuenta vinculada correctamente. Te avisaré cuando haya novedades en tu programación ARMS.");
};

const checkRosters = async () => {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, telegram_chat_id")
    .not("telegram_chat_id", "is", null);

  if (!profiles || !profiles.length) return;

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
        await sendMessage(p.telegram_chat_id, "⚠️ No pude revisar tu programación ARMS (sesión expirada o error). Volvé a sincronizar desde la app.");
      }
    }
  } finally {
    await browser.close();
  }
};

const main = async () => {
  await processCommands();
  await checkRosters();
};

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[TELEGRAM_BOT] Error fatal:", e);
    process.exit(1);
  });
