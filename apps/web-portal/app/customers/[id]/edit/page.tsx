import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { CustomerProfileEditor } from "./customer-profile-editor";
import { updateCustomerProfile } from "./actions";

type Customer = {
  id: string;
  customer_code: string;
  contact_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  partner_type: string | null;
  address_street: string | null;
  address_locality: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  pan_number: string | null;
  aadhaar_last_four: string | null;
  legal_trade_name: string | null;
  is_gst_registered: boolean;
  gst_number: string | null;
  fleet_size_band: string | null;
  onboarding_status: string;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  verification_status: string;
  created_at: string;
};

type VehicleRow = { id: string; vehicle_no: string; vehicle_type: string; make: string | null; model: string | null };
type AgentRow = { id: string; full_name: string };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMasterDataManager();
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const [{ data: customer, error }, { data: documents }, { data: vehicles }, { data: agents }] = await Promise.all([
    supabase.from("customers").select("id, customer_code, contact_name, company_name, phone, email, partner_type, address_street, address_locality, address, city, state, postal_code, pan_number, aadhaar_last_four, legal_trade_name, is_gst_registered, gst_number, fleet_size_band, onboarding_status, assigned_agent_id, created_at, updated_at").eq("id", id).maybeSingle<Customer>(),
    supabase.from("customer_documents").select("id, document_type, file_name, storage_bucket, storage_path, verification_status, created_at").eq("customer_id", id).order("created_at", { ascending: false }).returns<DocumentRow[]>(),
    supabase.from("vehicles").select("id, vehicle_no, vehicle_type, make, model").eq("customer_id", id).order("created_at", { ascending: false }).returns<VehicleRow[]>(),
    supabase.from("profiles").select("id, full_name").eq("role", "agent").eq("is_active", true).order("full_name").returns<AgentRow[]>()
  ]);

  if (error || !customer) notFound();

  const documentsWithUrls = await Promise.all((documents ?? []).map(async (document) => {
    const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
    return { ...document, signedUrl: data?.signedUrl ?? null };
  }));

  return (
    <AppShell title="Customer Profile">
      <CustomerProfileEditor
        customer={customer}
        documents={documentsWithUrls}
        vehicles={vehicles ?? []}
        agents={agents ?? []}
        action={updateCustomerProfile.bind(null, id)}
      />
    </AppShell>
  );
}
