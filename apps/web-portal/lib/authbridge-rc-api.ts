import { isValidVehicleRegistrationNumber, normalizeVehicleRegistrationNumber } from "@/lib/vehicle-registration";

export { normalizeVehicleRegistrationNumber };

export type AuthbridgeRcLookupResponse = {
  statusCode: number;
  status: string;
  message?: string;
  provider?: "authbridge";
  transactionId?: string;
  registrationNumber?: string;
  lookedUpAt?: string;
  data?: unknown;
};

export type AuthbridgeRcLookupOptions = {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 65_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 65_000;

function configuration() {
  const gatewayUrl = process.env.ICALL_GATEWAY_URL?.trim().replace(/\/$/, "");
  const gatewaySecret = process.env.ICALL_GATEWAY_SECRET?.trim();

  if (!gatewayUrl) throw new Error("ICALL_GATEWAY_URL is not configured.");
  if (!gatewaySecret) throw new Error("ICALL_GATEWAY_SECRET is not configured.");

  return { gatewayUrl, gatewaySecret };
}

export async function lookupAuthbridgeRc(
  registrationNumber: string,
  options: AuthbridgeRcLookupOptions = {},
): Promise<AuthbridgeRcLookupResponse> {
  const normalized = normalizeVehicleRegistrationNumber(registrationNumber);
  if (!isValidVehicleRegistrationNumber(normalized)) {
    throw new Error("Enter a valid vehicle registration number.");
  }

  const requestedTimeout = Number.isFinite(options.timeoutMs) ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const timeoutMs = Math.min(Math.max(Math.trunc(requestedTimeout), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);

  const { gatewayUrl, gatewaySecret } = configuration();
  const response = await fetch(`${gatewayUrl}/authbridge/rc-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${gatewaySecret}`,
    },
    body: JSON.stringify({ registrationNumber: normalized }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  let parsed: AuthbridgeRcLookupResponse;

  try {
    parsed = JSON.parse(text) as AuthbridgeRcLookupResponse;
  } catch {
    throw new Error(`AuthBridge gateway returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok || parsed.status !== "success") {
    throw new Error(parsed.message || `AuthBridge gateway HTTP ${response.status}.`);
  }

  return parsed;
}
