"use server";

import { hasEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isAppRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  governedInviteEmployeePortalUser,
  governedSetEmployeePortalStatus,
} from "@/lib/employee-portal-governance";

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
  if (message.includes("User already registered") || message.toLowerCase().includes("already been registered")) return "A portal login already exists for this email.";
  if (message.includes("permission to manage employees")) return "You do not have permission to manage employees.";
  if (message.includes("permission to manage employee portal access")) return "You do not have permission to manage employee portal access.";
  if (message.includes("cannot suspend your own portal access")) return "You cannot suspend your own portal access.";
  if (message.includes("final active Super Admin")) return "The final active Super Admin account cannot be suspended.";
  if (message.includes("final active IT Super User")) return "The final active IT Super User account cannot be suspended.";
  if (message.includes("protected technical role")) return "IT Super User is a protected technical role and cannot be assigned through normal user management.";
  if (message.includes("Only a Super Admin or IT Super User")) return "Only a Super Admin or IT Super User can assign Super Admin access.";
  if (message.includes("Reactivate this employee")) return "Reactivate this employee before sending portal access.";
  if (message.includes("Add a work email")) return "Add a work email to this employee before sending portal access.";
  if (message.includes("Select a valid staff portal role")) return "Select a valid staff portal role before sending the invitation.";
  if (message.includes("portal profile could not be synchronized")) return message;
  if (message.includes("portal authentication") || message.includes("Authentication was suspended")) return message;
  if (message.includes("employee directory status could not be synchronized")) return message;
  if (message.includes("employee could not be reactivated")) return message;
  if (message.includes("employee was not restored")) return message;
  return "The requested employee update could not be completed. Please try again.";
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
  if (!profile?.id || !isAppRole(profile.role) || !(await hasEffectiveCapability(profile, "manage_employees", "edit"))) {
    throw new Error("You do not have permission to manage employees.");
  }
  return { id: profile.id, role: profile.role, profile };
}

async function requireEmployeePortalManager() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !isAppRole(profile.role) || !(await hasEffectiveCapability(profile, "manage_users", "approve"))) {
    throw new Error("You do not have permission to manage employee portal access.");
  }
  return { id: profile.id, role: profile.role, profile };
}

export async function createEmployee(
  _previousState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  try {
    const actor = await requireEmployeeManager();
    const actorId = actor.id;
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
    if (createPortalAccess && (!email || !portalRole || !isAppRole(portalRole) || portalRole === "customer" || portalRole === "intermediary")) {
      return { status: "error", message: "A valid work email and staff role are required for portal access." };
    }
    if (createPortalAccess && !(await hasEffectiveCapability(actor.profile, "manage_users", "approve"))) {
      return { status: "error", message: "You may create employee records, but you do not have permission to create portal access." };
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

    if (createPortalAccess && portalRole && isAppRole(portalRole)) {
      try {
        await governedInviteEmployeePortalUser({
          actorProfileId: actor.id,
          actorRole: actor.role,
          employeeId: employee.id,
          requestedRole: portalRole,
          redirectTo: await getInviteRedirectUrl(),
        });
      } catch (inviteError) {
        const admin = createSupabaseAdminClient();
        await admin.from("employees").delete().eq("id", employee.id);
        return {
          status: "error",
          message: friendlyError(inviteError instanceof Error ? inviteError.message : "Could not send portal invitation."),
        };
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
    const actor = await requireEmployeeManager();
    const actorId = actor.id;
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
      return { status: "error", message: "The employee details were saved, but portal access could not be synchronized. Please try again." };
    }

    revalidatePath("/employees");
    revalidatePath("/organization");
    return { status: "success", message: `${employee.full_name}'s details were updated.` };
  } catch (error) {
    return { status: "error", message: friendlyError(error instanceof Error ? error.message : "Could not update employee.") };
  }
}

export async function sendEmployeePortalInvite(
  employeeId: string,
  _previousState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  try {
    const actor = await requireEmployeePortalManager();
    const requestedRole = textValue(formData, "portal_role");
    if (requestedRole && !isAppRole(requestedRole)) {
      return { status: "error", message: "Select a valid staff portal role before sending the invitation." };
    }

    const result = await governedInviteEmployeePortalUser({
      actorProfileId: actor.id,
      actorRole: actor.role,
      employeeId,
      requestedRole: requestedRole && isAppRole(requestedRole) ? requestedRole : null,
      redirectTo: await getInviteRedirectUrl(),
    });

    revalidatePath("/employees");
    revalidatePath("/users");
    return {
      status: "success",
      message: result.profile
        ? `A fresh portal invitation was sent to ${result.employee.email}.`
        : `Portal invitation sent to ${result.employee.email}.`,
    };
  } catch (error) {
    return { status: "error", message: friendlyError(error instanceof Error ? error.message : "Could not send portal invitation.") };
  }
}

export async function setEmployeeStatus(employeeId: string, nextStatus: "active" | "inactive") {
  const actor = await requireEmployeeManager();
  await governedSetEmployeePortalStatus({
    actorProfileId: actor.id,
    actorRole: actor.role,
    employeeId,
    nextStatus,
  });

  revalidatePath("/employees");
  revalidatePath("/organization");
  revalidatePath("/users");
}
