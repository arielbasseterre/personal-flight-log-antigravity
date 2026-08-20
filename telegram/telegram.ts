const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: string | number, text: string): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.error("[TELEGRAM] TELEGRAM_BOT_TOKEN no configurado (sendMessage no enviado)");
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[TELEGRAM] sendMessage a chat ${chatId} FALLO ${res.status}: ${body}`);
      return false;
    }
    console.log(`[TELEGRAM] sendMessage OK a chat ${chatId}`);
    return true;
  } catch (e: any) {
    console.error("[TELEGRAM] sendMessage error:", e.message);
    return false;
  }
}

export async function getUpdates(offset?: number): Promise<any[]> {
  if (!BOT_TOKEN) {
    console.error("[TELEGRAM] TELEGRAM_BOT_TOKEN no configurado (getUpdates vacio)");
    return [];
  }
  try {
    const res = await fetch(`${API_BASE}/getUpdates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offset: offset ?? 0, timeout: 0 }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[TELEGRAM] getUpdates error ${res.status}: ${body}`);
      return [];
    }
    const data: any = await res.json();
    const updates = data?.result || [];
    console.log(`[TELEGRAM] getUpdates(offset=${offset ?? 0}) -> ${updates.length} updates`);
    return updates;
  } catch (e) {
    console.error("[TELEGRAM] getUpdates error:", e);
    return [];
  }
}
