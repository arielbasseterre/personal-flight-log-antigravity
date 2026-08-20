import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const url =
  process.env.TELEGRAM_WEBHOOK_URL ||
  "https://personal-flight-log-antigravity-render.onrender.com/api/telegram/webhook";

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN no configurado");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url, allowed_updates: ["message"] }),
});
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
