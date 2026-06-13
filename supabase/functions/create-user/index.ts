import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const appRoles = new Set([
  "super_admin",
  "admin",
  "manager",
  "claim_processor",
  "field_executive",
  "director",
  "sales_head",
  "zonal_head",
  "asm",
  "sales_manager",
  "agent",
  "customer",
  "it_super_user",
]);

const userManagementRoles = new Set(["it_super_user", "admin", "super_admin"]);

type CreateUserPayload = {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string | null;
  role?: string;
  employee_code?: string | null;
  reporting_manager_id?: string | null;
  department?: string | null;
  designation?: string | null;
  email_confirm?: boolean;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return jsonResponse({}, 200);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: "Function is not configured." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Missing authorization." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: authUser, error: authError } = await userClient.auth.getUser();
  if (authError || !authUser.user) {
    return jsonResponse({ error: "Invalid session." }, 401);
  }

  const { data: callerProfile, error: callerError } = await serviceClient
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", authUser.user.id)
    .maybeSingle();

  if (callerError) {
    console.error("create-user caller lookup failed", callerError);
    return jsonResponse({ error: "Could not verify caller." }, 500);
  }

  if (!callerProfile?.is_active || !userManagementRoles.has(String(callerProfile.role))) {
    return jsonResponse({ error: "You do not have permission to create users." }, 403);
  }

  const payload = (await request.json().catch(() => null)) as CreateUserPayload | null;
  const email = payload?.email?.trim().toLowerCase();
  const password = payload?.password ?? "";
  const fullName = payload?.full_name?.trim();
  const role = payload?.role?.trim();

  if (!email || !password || !fullName || !role || !appRoles.has(role)) {
    return jsonResponse({ error: "Email, password, full name, and valid role are required." }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: "Password must be at least 6 characters." }, 400);
  }

  const profilePayload = {
    role,
    full_name: fullName,
    email,
    phone: nullable(payload?.phone),
    employee_code: nullable(payload?.employee_code),
    reporting_manager_id: nullable(payload?.reporting_manager_id),
    department: nullable(payload?.department),
    designation: nullable(payload?.designation),
    is_active: true,
    created_by: authUser.user.id,
    updated_by: authUser.user.id,
  };

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: payload?.email_confirm ?? true,
    user_metadata: {
      full_name: fullName,
      phone: nullable(payload?.phone),
      app_role: role,
    },
    app_metadata: {
      app_role: role,
    },
  });

  if (createError || !created.user) {
    console.error("create-user auth creation failed", { createError, email, role });
    return jsonResponse({ error: createError?.message ?? "Could not create login user." }, 400);
  }

  const { error: profileError } = await serviceClient
    .from("profiles")
    .upsert({ id: created.user.id, ...profilePayload }, { onConflict: "id" });

  if (profileError) {
    console.error("create-user profile upsert failed", { profileError, userId: created.user.id, profilePayload });
    await serviceClient.auth.admin.deleteUser(created.user.id);
    return jsonResponse({ error: "Login was created, but profile setup failed. The login was rolled back." }, 500);
  }

  return jsonResponse({
    user_id: created.user.id,
    email,
    role,
    full_name: fullName,
  });
});

function nullable(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
