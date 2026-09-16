import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const CAPTCHA_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CAPTCHA_LENGTH = 5;
const CAPTCHA_TTL_MS = 2 * 60 * 1000;

type CaptchaTokenPayload = {
  nonce: string;
  expiresAt: number;
  signature: string;
};

function getCaptchaSecret() {
  const secret = process.env.LOGIN_CAPTCHA_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("LOGIN_CAPTCHA_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function signCaptcha(nonce: string, expiresAt: number, answer: string) {
  return createHmac("sha256", getCaptchaSecret())
    .update(`${nonce}.${expiresAt}.${answer.toUpperCase()}`)
    .digest("base64url");
}

function generateCode() {
  return Array.from({ length: CAPTCHA_LENGTH }, () => CAPTCHA_ALPHABET[randomInt(0, CAPTCHA_ALPHABET.length)]).join("");
}

function renderCaptchaSvg(code: string) {
  const width = 320;
  const height = 70;
  const glyphs = code.split("").map((character, index) => {
    const x = 76 + index * 42 + randomInt(-4, 5);
    const y = 45 + randomInt(-5, 6);
    const rotation = randomInt(-18, 19);
    return `<text x="${x}" y="${y}" transform="rotate(${rotation} ${x} ${y})" font-family="Georgia, serif" font-size="30" font-weight="600" fill="#25324a">${character}</text>`;
  }).join("");

  const lines = Array.from({ length: 7 }, () => {
    const y1 = randomInt(8, height - 8);
    const y2 = randomInt(8, height - 8);
    return `<line x1="${randomInt(0, 80)}" y1="${y1}" x2="${randomInt(width - 80, width)}" y2="${y2}" stroke="#9aa8ba" stroke-width="0.7" opacity="0.45" />`;
  }).join("");

  const dots = Array.from({ length: 54 }, () => `<circle cx="${randomInt(4, width - 4)}" cy="${randomInt(4, height - 4)}" r="${randomInt(1, 3) / 2}" fill="#9aa8ba" opacity="0.45" />`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="10" fill="#fbfcfe" />${lines}${dots}${glyphs}</svg>`;
}

export function createLoginCaptcha() {
  const answer = generateCode();
  const nonce = randomBytes(18).toString("base64url");
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  const payload: CaptchaTokenPayload = {
    nonce,
    expiresAt,
    signature: signCaptcha(nonce, expiresAt, answer),
  };
  const token = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const svg = renderCaptchaSvg(answer);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  return { token, image, expiresAt };
}

export function verifyLoginCaptcha(token: string, answer: string) {
  try {
    const normalizedAnswer = answer.trim().toUpperCase();
    if (!new RegExp(`^[A-Z2-9]{${CAPTCHA_LENGTH}}$`).test(normalizedAnswer)) return false;

    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Partial<CaptchaTokenPayload>;
    if (typeof payload.nonce !== "string" || typeof payload.expiresAt !== "number" || typeof payload.signature !== "string") return false;
    if (payload.expiresAt < Date.now() || payload.expiresAt > Date.now() + CAPTCHA_TTL_MS + 10_000) return false;

    const expected = Buffer.from(signCaptcha(payload.nonce, payload.expiresAt, normalizedAnswer), "utf8");
    const supplied = Buffer.from(payload.signature, "utf8");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
