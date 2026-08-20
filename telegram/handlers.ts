import { sendMessage } from "./telegram";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function handleTelegramUpdate(supabase: SupabaseClient, update: any): Promise<void> {
  const msg = update.message || update.edited_message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text || "").trim();
  if (chatId == null) return;

  if (text.startsWith("/start")) {
    await sendMessage(chatId, "👋 Hola! Para vincular tu cuenta enviá:\n/registrar <codigo>\n\nEl código lo generás en la app (sección Roster ARMS).");
  } else if (text.startsWith("/registrar")) {
    await handleRegistrar(supabase, chatId, msg?.from?.username, text.split(/\s+/)[1]?.trim());
  }
}

async function handleRegistrar(
  supabase: SupabaseClient,
  chatId: number,
  username: string | undefined,
  code: string | undefined
): Promise<void> {
  if (!code) {
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
}
