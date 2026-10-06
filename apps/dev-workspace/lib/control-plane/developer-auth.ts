import { createClient } from "@supabase/supabase-js";

export type DeveloperIdentity = Readonly<{
  authenticated: boolean;
  authorized: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: string | null;
  isActive: boolean;
  assuranceLevel: "aal1" | "aal2" | "unknown";
  capabilities: readonly string[];
  writeEligible: false;
  reason: string;
}>;

function getEnvironment() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

function decodeAal(accessToken: string): DeveloperIdentity["assuranceLevel"] {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return "unknown";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { aal?: unknown };
    return decoded.aal === "aal2" ? "aal2" : decoded.aal === "aal1" ? "aal1" : "unknown";
  } catch {
    return "unknown";
  }
}

export async function resolveDeveloperIdentity(accessToken: string | null): Promise<DeveloperIdentity> {
  if (!accessToken) {
    return {
      authenticated: false,
      authorized: false,
      userId: null,
      email: null,
      fullName: null,
      role: null,
      isActive: false,
      assuranceLevel: "unknown",
      capabilities: [],
      writeEligible: false,
      reason: "No app-level Supabase Auth session was supplied."
    };
  }

  const env = getEnvironment();
  if (!env) {
    return {
      authenticated: false,
      authorized: false,
      userId: null,
      email: null,
      fullName: null,
      role: null,
      isActive: false,
      assuranceLevel: "unknown",
      capabilities: [],
      writeEligible: false,
      reason: "Developer Workspace Supabase public environment is not configured."
    };
  }

  const supabase = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

  const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
  const user = userResult.user;
  if (userError || !user) {
    return {
      authenticated: false,
      authorized: false,
      userId: null,
      email: null,
      fullName: null,
      role: null,
      isActive: false,
      assuranceLevel: "unknown",
      capabilities: [],
      writeEligible: false,
      reason: "Supabase Auth could not verify this session."
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", user.id)
    .maybeSingle<{ id: string; full_name: string | null; role: string; is_active: boolean | null }>();

  if (profileError || !profile) {
    return {
      authenticated: true,
      authorized: false,
      userId: user.id,
      email: user.email ?? null,
      fullName: null,
      role: null,
      isActive: false,
      assuranceLevel: decodeAal(accessToken),
      capabilities: [],
      writeEligible: false,
      reason: "A matching governed portal profile could not be loaded."
    };
  }

  const active = profile.is_active === true;
  const protectedRole = profile.role === "it_super_user";
  const authorized = active && protectedRole;
  const assuranceLevel = decodeAal(accessToken);

  return {
    authenticated: true,
    authorized,
    userId: user.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    role: profile.role,
    isActive: active,
    assuranceLevel,
    capabilities: authorized ? ["workspace:read"] : [],
    writeEligible: false,
    reason: authorized
      ? assuranceLevel === "aal2"
        ? "Active protected IT Super User verified at AAL2. Write actions remain disabled by the global control-plane policy."
        : "Active protected IT Super User verified. MFA/AAL2 is still required before any future write capability."
      : "Developer Workspace access requires an active protected IT Super User profile."
  };
}
