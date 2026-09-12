export type AuthbridgeBulkOutcome = "success" | "no_data" | "provider_error";

export type AuthbridgeBulkFields = Record<string, string | number | boolean | null>;

export function getAuthbridgeBusinessCode(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).status;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getAuthbridgeMessage(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const object = raw as Record<string, unknown>;
  for (const key of ["message", "message_code"]) {
    const value = object[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 300);
  }
  return null;
}

export function classifyAuthbridgeResponse(raw: unknown): AuthbridgeBulkOutcome {
  const code = getAuthbridgeBusinessCode(raw);
  if (code === 1) return "success";
  if (code === 9) return "no_data";
  return "provider_error";
}

export function flattenAuthbridgeResponse(raw: unknown): AuthbridgeBulkFields {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const root = raw as Record<string, unknown>;
  const msg = root.msg;
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return {};

  const output: AuthbridgeBulkFields = {};
  flattenValue(msg, "", output, 0);
  return output;
}

function flattenValue(value: unknown, prefix: string, output: AuthbridgeBulkFields, depth: number) {
  if (depth > 8 || value == null) {
    if (prefix && value == null) output[prefix] = null;
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) output[prefix] = typeof value === "string" ? value.trim() : value;
    return;
  }

  if (Array.isArray(value)) {
    if (!prefix) return;
    if (value.every((item) => item == null || ["string", "number", "boolean"].includes(typeof item))) {
      output[prefix] = value.filter((item) => item != null).map(String).join(" | ");
      return;
    }
    output[prefix] = safeJson(value);
    return;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length && prefix) {
      output[prefix] = "";
      return;
    }
    for (const [key, nested] of entries) {
      const nextPrefix = prefix ? `${prefix} :: ${key}` : key;
      if (nested && typeof nested === "object" && !Array.isArray(nested) && depth >= 4) {
        output[nextPrefix] = safeJson(nested);
      } else {
        flattenValue(nested, nextPrefix, output, depth + 1);
      }
    }
  }
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}
