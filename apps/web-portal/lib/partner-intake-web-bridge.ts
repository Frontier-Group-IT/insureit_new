import "server-only";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_TICKET_AGE_MS = 90_000;

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unbase64(value: string): Uint8Array<ArrayBuffer> {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard.padEnd(Math.ceil(standard.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
async function key(): Promise<CryptoKey> {
  const secret = process.env.PARTNER_INTAKE_BRIDGE_KEY;
  if (!secret) throw new Error("Partner intake bridge is not configured.");
  const raw = unbase64(secret);
  if (raw.byteLength !== 32) throw new Error("Partner intake bridge key must be 32 bytes.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export function bridgeReady(): boolean {
  return Boolean(process.env.PARTNER_INTAKE_BRIDGE_KEY);
}
export function newBridgeCode(): string {
  return base64(crypto.getRandomValues(new Uint8Array(32)));
}
export async function bridgeCodeHash(code: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error("Invalid handoff reference.");
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(code));
  return base64(new Uint8Array(hash));
}
export async function sealBridgePayload(value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), encoder.encode(JSON.stringify(value)));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}
export async function openBridgePayload<T>(sealed: string): Promise<T> {
  const [iv, encrypted, extra] = sealed.split(".");
  if (!iv || !encrypted || extra) throw new Error("Invalid handoff payload.");
  const decoded = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(iv) }, await key(), unbase64(encrypted));
  return JSON.parse(decoder.decode(decoded)) as T;
}
export function bridgeExpiry(): string {
  return new Date(Date.now() + MAX_TICKET_AGE_MS).toISOString();
}
export type BridgeSession = { access_token: string; refresh_token: string; user_id: string; expires_at: number };
export type BridgeIntent = {
  intake_id: string;
  user_id: string;
  expected_reviewer_id: string | null;
  take_over: boolean;
  expires_at: number;
};
export const BRIDGE_INTENT_COOKIE = "insureit-partner-intake-bridge-intent";
export const bridgeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
export function responseNoCache<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
