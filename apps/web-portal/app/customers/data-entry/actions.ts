"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePhone(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits.slice(2))) return digits.slice(2);
  return null;
}

function errorUrl(message: string) {
  return `/customers/data-entry/new?error=${encodeURIComponent(message)}`;
}

export async function createCustomerDataEntry(formData: FormData) {
  const profile = await requireCapability("create_customers", "edit");
  const contactName = text(formData, "contact_name");
  const companyName = text(formData, "company_name");
  const phone = normalizePhone(text(formData, "phone"));
  const email = text(formData, "email");
  const city = text(formData, "city");
  const state = text(formData, "state");
  const address = text(formData, "address");

  if (!contactName) redirect(errorUrl("Enter the customer name."));
  if (!phone) redirect(errorUrl("Enter a valid 10 digit Indian mobile number."));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(errorUrl("Enter a valid email address."));

  const admin = createSupabaseAdminClient();
  const { data: duplicate, error: duplicateError } = await admin
    .from("customers")
    .select("id,contact_name")
    .eq("phone", phone)
    .limit(1)
    .maybeSingle<{ id: string; contact_name: string }>();
  if (duplicateError) redirect(errorUrl("Customer could not be checked for duplicates. Please try again."));
  if (duplicate) redirect(errorUrl(`A customer already exists with this mobile number (${duplicate.contact_name}).`));

  const customerCode = `CUST-${Date.now().toString().slice(-9)}`;
  const { error } = await admin.from("customers").insert({
    customer_code: customerCode,
    partner_type: "individual_proprietor",
    customer_type: "individual",
    contact_name: contactName,
    company_name: companyName,
    phone,
    email,
    city,
    state,
    address,
    onboarding_status: "pending_kyc",
    source: "backoffice_data_entry",
    created_by: profile.id,
    updated_by: profile.id,
  });

  if (error) {
    const duplicateMessage = /duplicate|unique/i.test(error.message ?? "");
    redirect(errorUrl(duplicateMessage ? "A customer with these details already exists." : "Customer could not be saved. Please review the details and try again."));
  }

  revalidatePath("/customers");
  redirect("/customers?success=customer_created");
}
