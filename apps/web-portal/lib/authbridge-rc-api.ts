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

function configuration() {
  const gatewayUrl = process.env.ICALL_GATEWAY_URL?.trim().replace(/\/$/, "");
  const gatewaySecret = process.env.ICALL_GATEWAY_SECRET?.trim();

  if (!gatewayUrl) throw new Error("ICALL_GATEWAY_URL is not configured.");
  if (!gatewaySecret) throw new Error("ICALL_GATEWAY_SECRET is not configured.");

  return { gatewayUrl, gatewaySecret };
}

export function normalizeVehicleRegistrationNumber(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidVehicleRegistrationNumber(value: string) {
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(normalizeVehicleRegistrationNumber(value));
}

export async function lookupAuthbridgeRc(registrationNumber: string): Promise<AuthbridgeRcLookupResponse> {
  const normalized = normalizeVehicleRegistrationNumber(registrationNumber);
  if (!isValidVehicleRegistrationNumber(normalized)) {
    throw new Error("Enter a valid vehicle registration number.");
  }

  const { gatewayUrl, gatewaySecret } = configuration();
  const response = await fetch(`${gatewayUrl}/uat/authbridge/rc-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${gatewaySecret}`,
    },
    body: JSON.stringify({ registrationNumber: normalized }),
    cache: "no-store",
    signal: AbortSignal.timeout(65_000),
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
