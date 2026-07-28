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

const DEFAULT_BASE_URL = "https://www.icallinsurance.com/API/SANKALP/UAT";

function configuration() {
  const authToken = process.env.ICALL_UAT_AUTH_TOKEN?.trim();
  if (!authToken) throw new Error("ICALL_UAT_AUTH_TOKEN is not configured.");
  return {
    authToken,
    baseUrl: (process.env.ICALL_UAT_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`iCall returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(`iCall HTTP ${response.status}.`);
  return parsed as T;
}

function decodeBase64Json<T>(payload: string): T {
  return JSON.parse(Buffer.from(payload.trim(), "base64").toString("utf8")) as T;
}

export async function registerIcallPosp(input: IcallRegistrationRequest) {
  const { authToken, baseUrl } = configuration();
  const encoded = Buffer.from(JSON.stringify({ authToken, ...input }), "utf8").toString("base64");
  const wrapper = await postJson<{ payload?: string }>(`${baseUrl}/RegisterPOSPTraining`, { payload: encoded });
  if (!wrapper.payload) throw new Error("iCall registration response did not contain payload.");
  return decodeBase64Json<IcallRegistrationResponse>(wrapper.payload);
}

export async function getIcallPospTrainingStatus(loginId: string) {
  const { authToken, baseUrl } = configuration();
  return postJson<IcallTrainingStatusResponse>(`${baseUrl}/POSPTrainingStatus`, { authToken, loginId });
}
