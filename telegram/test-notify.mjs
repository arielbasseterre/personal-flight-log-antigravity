// Prueba manual de notificaciones por Telegram.
//
// Uso local:  TEST_EMAIL=tu@email.com node telegram/test-notify.mjs
// En GitHub:  Actions -> "Telegram Test" -> Run workflow (ingresás tu email)
//
// Requiere: SUPABASE_URL (o VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN
//
// Qué valida: que el token del bot funcione, que tu perfil tenga telegram_chat_id
// vinculado y que el mensaje llegue a tu chat. Es el mismo sendMessage que usa
// el cron (telegram/telegram.ts), sin instalar dependencias (fetch nativo de Node 22).

const email = (process.env.TEST_EMAIL || "").trim();
const sbUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const token = process.env.TELEGRAM_BOT_TOKEN || "";

const stop = (msg) => {
  console.error(`[TEST] ❌ ${msg}`);
  process.exit(1);
};

const main = async () => {
  console.log(`[TEST] Iniciando prueba de notificación | Supabase set=${!!sbUrl} | service key set=${!!sbKey} | token set=${!!token}`);

  if (!email) stop("Falta TEST_EMAIL (el email de tu cuenta en la app)");
  if (!sbUrl) stop("Falta SUPABASE_URL / VITE_SUPABASE_URL");
  if (!sbKey) stop("Falta SUPABASE_SERVICE_ROLE_KEY");
  if (!token) stop("Falta TELEGRAM_BOT_TOKEN");

  const url = `${sbUrl}/rest/v1/profiles?select=email,telegram_chat_id,first_name,last_name&email=eq.${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
  });
  if (!res.ok) {
    stop(`Supabase respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    stop(`No existe un perfil con el email "${email}"`);
  }

  const profile = rows[0];
  const chatId = profile.telegram_chat_id;
  if (!chatId) {
    stop(`El perfil "${email}" no tiene Telegram vinculado. Abrí la app -> Roster ARMS -> Telegram y generá el código para vincular.`);
  }

  const masked = String(chatId).replace(/.(?=.{4})/g, "•");
  const nombre = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  console.log(`[TEST] Perfil encontrado: ${profile.email}${nombre ? ` (${nombre})` : ""} | chat_id: ${masked}`);

  const text = [
    "✅ *Prueba de notificación del bot de roster*",
    "",
    "Si estás leyendo esto, los avisos de cambios en tu programación ARMS te están llegando bien.",
    "",
    `Enviado: ${new Date().toISOString()}`,
  ].join("\n");

  const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: "Markdown" }),
  });

  if (!tg.ok) {
    const body = await tg.text();
    stop(`Telegram respondió ${tg.status}: ${body.slice(0, 300)}`);
  }

  const data = await tg.json();
  console.log(`[TEST] ✅ Mensaje enviado OK (message_id=${data?.result?.message_id})`);
};

main().catch((e) => stop(e?.message || String(e)));
