import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const adminRoles = new Set(["it_super_user", "admin", "super_admin"]);
const customerCreatorRoles = new Set(["manager", "backoffice_executive", "it_super_user", "admin", "super_admin"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return jsonResponse({}, 200);
  if (request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "Function is not configured." }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return jsonResponse({ error: "Missing authorization." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: authUser, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser.user) return jsonResponse({ error: "Invalid session." }, 401);

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role, is_active, full_name, email, phone, employee_code, reporting_manager_id")
    .eq("id", authUser.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("profile-context profile lookup failed", profileError);
    return jsonResponse({ error: "Could not load profile context." }, 500);
  }

  if (!profile?.is_active) return jsonResponse({ error: "Inactive profile." }, 403);

  let managerName: string | null = null;
  if (profile.reporting_manager_id) {
    const { data: manager, error: managerError } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", profile.reporting_manager_id)
      .maybeSingle();
    if (managerError) console.error("profile-context manager lookup failed", managerError);
    managerName = manager?.full_name ?? null;
  }

  let assignableAgents: unknown[] = [];
  let supportContacts: Record<string, unknown> | null = null;
  const role = String(profile.role);
  if (role === "customer") {
    supportContacts = await loadCustomerSupportContacts(serviceClient, profile.id);
  }
  if (customerCreatorRoles.has(role)) {
    if (adminRoles.has(role) || role === "backoffice_executive") {
      const { data, error } = await serviceClient
        .from("profiles")
        .select("id, full_name, employee_code, role, is_active")
        .eq("role", "agent")
        .eq("is_active", true)
        .order("full_name");
      if (error) {
        console.error("profile-context admin agent lookup failed", error);
        return jsonResponse({ error: "Could not load assignable agents." }, 500);
      }
      assignableAgents = data ?? [];
    } else if (role === "manager") {
      const rootUserId = profile.reporting_manager_id ?? profile.id;
      const { data: downline, error: downlineError } = await serviceClient.rpc("get_user_downline", { root_user_id: rootUserId });
      if (downlineError) {
        console.error("profile-context manager downline lookup failed", downlineError);
        return jsonResponse({ error: "Could not load assignable agents." }, 500);
      }
      const ids = Array.isArray(downline) ? downline.map((row: { profile_id: string }) => row.profile_id) : [];
      if (ids.length) {
        const { data, error } = await serviceClient
          .from("profiles")
          .select("id, full_name, employee_code, role, is_active")
          .in("id", ids)
          .eq("role", "agent")
          .eq("is_active", true)
          .order("full_name");
        if (error) {
          console.error("profile-context manager agent lookup failed", error);
          return jsonResponse({ error: "Could not load assignable agents." }, 500);
        }
        assignableAgents = data ?? [];
      }
    }
  }

  return jsonResponse({
    manager_name: managerName,
    assignable_agents: assignableAgents,
    support_contacts: supportContacts,
  });
});

async function loadCustomerSupportContacts(serviceClient: ReturnType<typeof createClient>, profileId: string) {
  const { data: customer, error: customerError } = await serviceClient
    .from("customers")
    .select("assigned_agent_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (customerError) {
    console.error("profile-context customer support lookup failed", customerError);
    return null;
  }

  const agent = customer?.assigned_agent_id ? await loadProfile(serviceClient, customer.assigned_agent_id) : null;
  const chain = agent ? await loadManagerChain(serviceClient, agent) : [];
  const asm = chain.find((item) => item.role === "asm") ?? null;
  const manager = await loadFirstActiveRole(serviceClient, "manager");
  const fieldExecutive = await loadFirstActiveRole(serviceClient, "field_executive");

  return {
    agent: publicContact(agent),
    claim_handler: publicContact(manager),
    field_executive: publicContact(fieldExecutive),
    manager_escalation: publicContact(asm),
  };
}

async function loadProfile(serviceClient: ReturnType<typeof createClient>, id: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, phone, role, reporting_manager_id, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("profile-context linked profile lookup failed", error);
    return null;
  }
  return data?.is_active ? data : null;
}

async function loadManagerChain(serviceClient: ReturnType<typeof createClient>, startProfile: { reporting_manager_id: string | null }) {
  const chain = [];
  let managerId = startProfile.reporting_manager_id;
  const seen = new Set<string>();
  while (managerId && !seen.has(managerId) && chain.length < 8) {
    seen.add(managerId);
    const manager = await loadProfile(serviceClient, managerId);
    if (!manager) break;
    chain.push(manager);
    managerId = manager.reporting_manager_id;
  }
  return chain;
}

async function loadFirstActiveRole(serviceClient: ReturnType<typeof createClient>, role: string) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id, full_name, email, phone, role, reporting_manager_id, is_active")
    .eq("role", role)
    .eq("is_active", true)
    .order("full_name")
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`profile-context ${role} lookup failed`, error);
    return null;
  }
  return data ?? null;
}

function publicContact(profile: { id: string; full_name: string; email: string | null; phone: string | null; role: string } | null) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    role: profile.role,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
