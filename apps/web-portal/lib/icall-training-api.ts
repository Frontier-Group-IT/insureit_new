type IcallRegistrationRequest = {
  pan: string;
  pospFirstName: string;
  pospLastName?: string;
  dob?: string;
  email_id: string;
  mobile: string;
  internalPOSCode?: string;
};

type IcallRegistrationResponse = {
  statusCode: number;
  status: string;
  message?: string;
  new_users?: Array<{
    statusCode: number;
    status: string;
    loginid: string;
    candidateName: string;
    message?: string;
  }>;
  skipped_user?: {
    status?: string;
    loginid?: string;
    candidateName?: string;
    message?: string;
  };
};

export type IcallTrainingStatusResponse = {
  statusCode: number;
  status: string;
  message?: string;
  data?: {
    mobileNumber?: string;
    candidate_name?: string;
    internal_pos_code?: string;
    login_id?: string;
    issue_date?: string;
    expiry_date?: string;
    start_date?: string;
    end_date?: string;
    training_completion_date?: string;
    hours_allotted?: string;
    hours_completed?: string;
    hours_remaining?: string;
    training_status?: string;
    final_exam?: {
      completion_date?: string | null;
      score?: string | number | null;
      result?: string | null;
    };
  };
};

export type IcallSsoResponse = {
  statusCode: number;
  status: string;
  message?: string;
  redirectUrl?: string;
  redirectURL?: string;
  redirect_url?: string;
  data?: {
    redirectUrl?: string;
    redirectURL?: string;
    redirect_url?: string;
  };
};

export type IcallTccResponse = {
  statusCode: number;
  status: string;
  message?: string;
  data?: unknown;
};

function configuration() {
  const gatewayUrl = process.env.ICALL_GATEWAY_URL?.trim().replace(/\/$/, "");
  const gatewaySecret = process.env.ICALL_GATEWAY_SECRET?.trim();

  if (!gatewayUrl) throw new Error("ICALL_GATEWAY_URL is not configured.");
  if (!gatewaySecret) throw new Error("ICALL_GATEWAY_SECRET is not configured.");

  return { gatewayUrl, gatewaySecret };
}

async function postGateway<T>(path: string, body: unknown): Promise<T> {
  const { gatewayUrl, gatewaySecret } = configuration();
  const response = await fetch(`${gatewayUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${gatewaySecret}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(35_000),
  });

  const text = await response.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`iCall gateway returned a non-JSON response (HTTP ${response.status}).`);
  }

  const normalized = unwrapPayload(parsed);

  if (!response.ok) {
    const message =
      typeof normalized === "object" && normalized && "message" in normalized
        ? String((normalized as { message?: unknown }).message || "")
        : "";
    throw new Error(message || `iCall gateway HTTP ${response.status}.`);
  }

  return normalized as T;
}

function unwrapPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  const payload = record.payload;
  if (typeof payload !== "string" || !payload.trim()) return value;

  try {
    const decoded = Buffer.from(payload.trim(), "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    return parsed && typeof parsed === "object"
      ? { ...record, ...(parsed as Record<string, unknown>), payload: undefined }
      : parsed;
  } catch {
    return value;
  }
}

export async function registerIcallPosp(input: IcallRegistrationRequest) {
  return postGateway<IcallRegistrationResponse>("/uat/icall/register", input);
}

export async function getIcallPospTrainingStatus(loginId: string) {
  return postGateway<IcallTrainingStatusResponse>("/uat/icall/status", { loginId });
}

export async function getIcallSso(loginId: string) {
  return postGateway<IcallSsoResponse>("/uat/icall/sso", { loginId });
}

export async function getIcallTcc(tccFromDate: string, tccToDate: string) {
  return postGateway<IcallTccResponse>("/uat/icall/tcc", {
    tcc_from_date: tccFromDate,
    tcc_to_date: tccToDate,
  });
}
