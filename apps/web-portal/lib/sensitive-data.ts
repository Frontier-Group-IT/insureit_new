import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKeys() {
  const secrets = [
    process.env.POSP_MISP_DATA_ENCRYPTION_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ].filter((secret, index, values): secret is string => Boolean(secret) && values.indexOf(secret) === index);
  if (!secrets.length) throw new Error("Missing POSP_MISP_DATA_ENCRYPTION_KEY.");
  return secrets.map((secret) => createHash("sha256").update(secret).digest());
}

export function encryptSensitiveValue(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKeys()[0], iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSensitiveValue(value?: string | null) {
  if (!value) return null;
  const [version, encodedIv, encodedTag, encodedPayload] = value.split(".");
  if (version !== VERSION || !encodedIv || !encodedTag || !encodedPayload) return null;
  for (const key of encryptionKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64url"));
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encodedPayload, "base64url")),
        decipher.final()
      ]).toString("utf8");
    } catch {
      // Try the fallback key to keep existing records readable during key rollout.
    }
  }
  return null;
}
