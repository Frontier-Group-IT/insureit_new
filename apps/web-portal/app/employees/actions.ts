"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isAppRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type EmployeeActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function friendlyError(message: string) {
  if (message.includes("employees_employee_code_key")) return "That employee code is already in use.";
  if (message.includes("employees_email_key")) return "That email is already assigned to another employee.";
  if (message.includes("employees_phone_key")) return "That mobile number is already assigned to another employee.";
  if (message.includes("User already registered")) return "A portal login already exists for this email.";
  return message;
}

async function getInviteRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) return `${configuredUrl.replace(/\/$/, "")}/invite`;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return "http://localhost:3000/invite";

  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}/invite`;
}

async function requireEmployeeManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !["it_super_user", "admin", "super_admin"].includes(String(profile.role))) {
    throw new Error("You do not have permission to manage employees.");
  }
  return profile.id;
}

export async function createEmployee(
  _previousState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  try {
    const actorId = await requireEmployeeManager();
    const supabase = await createServerSupabaseClient();
    const fullName = textValue(formData, "full_name");
    const employeeCode = textValue(formData, "employee_code");
    const department = textValue(formData, "department");
    const designation = textValue(formData, "designation");
    const email = textValue(formData, "email");
    const createPortalAccess = formData.get("create_portal_access") === "on";
    const portalRole = textValue(formData, "portal_role");

    if (!fullName || !employeeCode || !department || !designation) {
      return { status: "error", message: "Employee code, name, department, and designation are required." };
    }
    if (createPortalAccess && (!email || !portalRole || !isAppRole(portalRole) || portalRole === "customer")) {
      return { status: "error", message: "A valid work email and staff role are required for portal access." };
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .insert({
        employee_code: employeeCode,
        full_name: fullName,
        phone: textValue(formData, "phone"),
        email,
        department,
        designation,
        vertical: textValue(formData, "vertical"),
        location: textValue(formData, "location"),
        reporting_manager_id: textValue(formData, "reporting_manager_id"),
        reporting_manager_employee_code: textValue(formData, "reporting_manager_employee_code"),
        employment_status: "active",
        created_by: actorId,
        updated_by: actorId,
      })
      .select("id, employee_code, full_name, phone, email, department, designation")
      .single();

    if (employeeError || !employee) {
      return { status: "error", message: friendlyError(employeeError?.message ?? "Could not create employee.") };
    }

    if (createPortalAccess && email && portalRole) {
      const admin = createSupabaseAdminClient();
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: await getInviteRedirectUrl(),
        data: {
          full_name: fullName,
          phone: employee.phone,
          app_role: portalRole,
          employee_id: employee.id,
        },
      });

      if (inviteError || !invited.user) {
        await admin.from("employees").delete().eq("id", employee.id);
        return { status: "error", message: friendlyError(inviteError?.message ?? "Could not send portal invitation.") };
      }

      const { error: profileError } = await admin.from("profiles").upsert({
        id: invited.user.id,
        role: portalRole,
        full_name: fullName,
        phone: employee.phone,
        email,
        employee_code: employee.employee_code,
        department: employee.department,
        designation: employee.designation,
        employee_id: employee.id,
        is_active: true,
        created_by: actorId,
        updated_by: actorId,
      }, { onConflict: "id" });

      if (profileError) {
        await admin.auth.admin.deleteUser(invited.user.id);
        await admin.from("employees").delete().eq("id", employee.id);
        return { status: "error", message: friendlyError(profileError.message) };
      }
    }

    revalidatePath("/employees");
    revalidatePath("/organization");
    revalidatePath("/users");
    return {
      status: "success",
      message: createPortalAccess
        ? `${employee.full_name} was onboarded and a portal invitation was sent.`
        : `${employee.full_name} was added to the employee directory.`,
    };
  } catch (error) {
    return { status: "error", message: friendlyError(error instanceof Error ? error.message : "Could not create employee.") };
  }
}

export async function updateEmployee(
  employeeId: string,
  _previousState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  try {
    const actorId = await requireEmployeeManager();
    const supabase = await createServerSupabaseClient();
    const fullName = textValue(formData, "full_name");
    const employeeCode = textValue(formData, "employee_code");
    const department = textValue(formData, "department");
    const designation = textValue(formData, "designation");

    if (!employeeId || !fullName || !employeeCode || !department || !designation) {
      return { status: "error", message: "Employee code, name, department, and designation are required." };
    }

    const { data: employee, error } = await supabase
      .from("employees")
      .update({
        employee_code: employeeCode,
        full_name: fullName,
        phone: textValue(formData, "phone"),
        email: textValue(formData, "email"),
        department,
        designation,
        vertical: textValue(formData, "vertical"),
        location: textValue(formData, "location"),
        reporting_manager_id: textValue(formData, "reporting_manager_id"),
        reporting_manager_employee_code: textValue(formData, "reporting_manager_employee_code"),
        updated_by: actorId,
      })
      .eq("id", employeeId)
      .select("full_name")
      .single();

    if (error || !employee) {
      return { status: "error", message: friendlyError(error?.message ?? "Could not update employee.") };
    }

    const admin = createSupabaseAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        phone: textValue(formData, "phone"),
        email: textValue(formData, "email"),
        employee_code: employeeCode,
        department,
        designation,
        updated_by: actorId,
      })
      .eq("employee_id", employeeId);

    if (profileError) {
      return { status: "error", message: `Employee was updated, but portal profile sync failed: ${friendlyError(profileError.message)}` };
    }

    revalidatePath("/employees");
    revalidatePath("/organization");
    return { status: "success", message: `${employee.full_name}'s details were updated.` };
  } catch (error) {
    return { status: "error", message: friendlyError(error instanceof Error ? error.message : "Could not update employee.") };
  }
}

export async function setEmployeeStatus(employeeId: string, nextStatus: "active" | "inactive") {
  const actorId = await requireEmployeeManager();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("employees")
    .update({ employment_status: nextStatus, updated_by: actorId })
    .eq("id", employeeId);

  if (error) throw new Error(friendlyError(error.message));

  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ is_active: nextStatus === "active", updated_by: actorId })
    .eq("employee_id", employeeId);

  if (profileError) throw new Error(`Employee status changed, but portal access sync failed: ${friendlyError(profileError.message)}`);

  revalidatePath("/employees");
  revalidatePath("/organization");
}
