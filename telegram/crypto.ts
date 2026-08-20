import crypto from "crypto";

const getKey = (): Buffer | null => {
  const secret = process.env.ARMS_PASSWORD_SECRET || "";
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
};

export function encryptPassword(plain?: string | null): string | null {
  if (!plain) return null;
  const key = getKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptPassword(payload?: string | null): string | null {
  if (!payload) return null;
  const key = getKey();
  if (!key) return null;
  try {
    const [ivB64, tagB64, encB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !encB64) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
