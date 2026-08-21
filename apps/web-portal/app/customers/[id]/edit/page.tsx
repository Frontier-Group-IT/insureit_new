import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CustomerActivityStatus } from "@/components/customer-activity-status";
import { AppShell } from "@/components/shell";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requireCustomerManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CustomerProfileEditor } from "./customer-profile-editor";
import { updateCustomerProfile } from "./actions";
import { DealershipProfileEditor } from "./dealership-profile-editor";
import { updateDealershipProfile } from "./dealership-actions";
import { CorporateProfileEditor } from "./corporate-profile-editor";
import { updateCorporateProfile } from "./corporate-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Customer = { id:string; customer_code:string; contact_name:string; company_name:string|null; phone:string; email:string|null; partner_type:string|null; address_street:string|null; address_locality:string|null; address:string|null; india_location_id:string|null; city:string|null; state:string|null; postal_code:string|null; pan_number:string|null; aadhaar_last_four:string|null; legal_trade_name:string|null; is_gst_registered:boolean; gst_number:string|null; fleet_size_band:string|null; onboarding_status:string; assigned_agent_id:string|null; lead_source_intermediary_id:string|null; creation_channel:string|null; origin_customer_id:string|null; created_by:string|null; created_at:string; updated_at:string };
type DocumentRow = { id:string; document_type:string; file_name:string; verification_status:string; created_at:string };
type VehicleRow = { id:string; vehicle_no:string; vehicle_type:string; make:string|null; model:string|null };
type AgentRow = { id:string; full_name:string };
type IntermediaryRow = { display_name:string };
type DealershipProfile = { dealership_type:"posp"|"misp"; dealership_name:string; owner_name:string; oem_name:string|null; yearly_sales_band:string|null };
type Representative = { representative_name:string; mobile:string; email:string|null; aadhaar_last_four:string|null; pan_number:string|null };
type DealershipContact = { contact_role:string; contact_name:string|null; mobile:string|null; email:string|null };
type CorporateContact = { contact_role:string; full_name:string; phone:string; email:string|null; access_status:string; profile_id:string|null };
type Manufacturer = { name:string };
type GroupOption = { id:string; customer_code:string; company_name:string|null; contact_name:string };
type GroupRelationship = { parent_customer_id:string };

function EmbeddedEditor({ children }: { children: ReactNode }) {
  return <main data-embedded-editor="customer" className="min-h-screen bg-[#F6F8FB] p-3 sm:p-4">{children}</main>;
}

export default async function EditCustomerPage({ params, searchParams }: { params:Promise<{id:string}>; searchParams:Promise<{error?:string;field?:string;success?:string;embedded?:string}> }) {
  const [{id},query] = await Promise.all([params,searchParams]);
  const embedded = query.embedded === "1";
  const manager = await requireCustomerManager(id);
  const admin = createSupabaseAdminClient();
  const [scope, accessibleCustomerIds] = await Promise.all([
    getEmployeeAccessScope(manager.id, manager.role),
    getAccessibleCustomerIds(manager.id, manager.role),
  ]);
  const [{data:customer,error},{data:documents},{data:vehicles}] = await Promise.all([
    admin.from("customers").select("id, customer_code, contact_name, company_name, phone, email, partner_type, address_street, address_locality, address, india_location_id, city, state, postal_code, pan_number, aadhaar_last_four, legal_trade_name, is_gst_registered, gst_number, fleet_size_band, onboarding_status, assigned_agent_id, lead_source_intermediary_id, creation_channel, origin_customer_id, created_by, created_at, updated_at").eq("id",id).maybeSingle<Customer>(),
    admin.from("customer_documents").select("id, document_type, file_name, verification_status, created_at").eq("customer_id",id).order("created_at",{ascending:false}).returns<DocumentRow[]>(),
    admin.from("vehicles").select("id, vehicle_no, vehicle_type, make, model").eq("customer_id",id).order("created_at",{ascending:false}).returns<VehicleRow[]>()
  ]);
  if(error||!customer) notFound();

  const activityStatus = (
    <div className="mt-3">
      <CustomerActivityStatus
        customerId={customer.id}
        createdById={customer.created_by}
        createdAt={customer.created_at}
        creationChannel={customer.creation_channel}
        originCustomerId={customer.origin_customer_id}
      />
    </div>
  );

  const agentIds = scope.mode === "organization"
    ? null
    : Array.from(new Set([...scope.profileIds, ...(customer.assigned_agent_id ? [customer.assigned_agent_id] : [])]));
  let agentRequest = admin.from("profiles").select("id, full_name").eq("role","agent").eq("is_active",true).order("full_name");
  if (agentIds !== null) agentRequest = agentIds.length ? agentRequest.in("id", agentIds) : agentRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
  const { data: agents } = await agentRequest.returns<AgentRow[]>();

  let leadSourceName = "Not recorded";
  if (customer.lead_source_intermediary_id) {
    const { data: intermediary } = await admin
      .from("intermediaries")
      .select("display_name")
      .eq("id", customer.lead_source_intermediary_id)
      .maybeSingle<IntermediaryRow>();
    if (intermediary?.display_name) {
      leadSourceName = intermediary.display_name;
    }
  }
  const internalOwnerName = customer.assigned_agent_id
    ? agents?.find((agent) => agent.id === customer.assigned_agent_id)?.full_name ?? "Not assigned"
    : "Not assigned";
  const documentsWithUrls=(documents??[]).map((document)=>({...document,signedUrl:`/customers/documents/${document.id}/open`}));

  if(customer.partner_type==="corporate"){
    let groupRequest = admin.from("customers").select("id,customer_code,company_name,contact_name").eq("partner_type","group").eq("onboarding_status","active").order("company_name",{ascending:true});
    if (accessibleCustomerIds !== null) groupRequest = accessibleCustomerIds.length ? groupRequest.in("id", accessibleCustomerIds) : groupRequest.in("id", ["00000000-0000-0000-0000-000000000000"]);
    const [{data:contacts},{data:groups},{data:relationship}] = await Promise.all([
      admin.from("customer_contacts").select("contact_role,full_name,phone,email,access_status,profile_id").eq("customer_id",id).order("contact_role").returns<CorporateContact[]>(),
      groupRequest.returns<GroupOption[]>(),
      admin.from("customer_relationships").select("parent_customer_id").eq("child_customer_id",id).eq("relationship_type","group_member").eq("is_active",true).eq("status","active").maybeSingle<GroupRelationship>()
    ]);
    const content = <><CorporateProfileEditor customer={customer} contacts={contacts??[]} groups={groups??[]} currentGroupId={relationship?.parent_customer_id??null} action={updateCorporateProfile.bind(null,id)} errorMessage={query.error??null} successMessage={query.success??null}/>{activityStatus}</>;
    return embedded ? <EmbeddedEditor>{content}</EmbeddedEditor> : <AppShell title="Corporate Profile">{content}</AppShell>;
  }

  if(customer.partner_type==="dealership"){
    const [{data:dealership},{data:representative},{data:contacts},{data:manufacturers}]=await Promise.all([
      admin.from("dealership_profiles").select("dealership_type, dealership_name, owner_name, oem_name, yearly_sales_band").eq("customer_id",id).maybeSingle<DealershipProfile>(),
      admin.from("dealership_representatives").select("representative_name, mobile, email, aadhaar_last_four, pan_number").eq("customer_id",id).maybeSingle<Representative>(),
      admin.from("dealership_contacts").select("contact_role, contact_name, mobile, email").eq("customer_id",id).returns<DealershipContact[]>(),
      admin.from("vehicle_manufacturers").select("name").eq("is_active",true).order("sort_order",{ascending:true}).order("name",{ascending:true}).returns<Manufacturer[]>()
    ]);
    if(!dealership||!representative) notFound();
    const oems=(manufacturers??[]).map((item)=>({value:item.name,label:item.name}));
    const content = <><DealershipProfileEditor action={updateDealershipProfile.bind(null,id)} values={{dealership_type:dealership.dealership_type,dealership_name:dealership.dealership_name,owner_name:dealership.owner_name,phone:customer.phone,email:customer.email,address_street:customer.address_street,address_locality:customer.address_locality,city:customer.city,state:customer.state,postal_code:customer.postal_code,india_location_id:customer.india_location_id,oem_name:dealership.oem_name,yearly_sales_band:dealership.yearly_sales_band,is_gst_registered:customer.is_gst_registered,gst_number:customer.gst_number,representative_name:representative.representative_name,representative_mobile:representative.mobile,representative_email:representative.email,representative_pan:representative.pan_number,aadhaar_last_four:representative.aadhaar_last_four}} contacts={contacts??[]} documents={documentsWithUrls} oems={oems}/>{activityStatus}</>;
    return embedded ? <EmbeddedEditor>{content}</EmbeddedEditor> : <AppShell title="Dealership Profile">{content}</AppShell>;
  }

  const content = <CustomerProfileEditor customer={customer} documents={documentsWithUrls} vehicles={vehicles??[]} agents={agents??[]} internalOwnerName={internalOwnerName} leadSourceName={leadSourceName} action={updateCustomerProfile.bind(null,id)} errorMessage={query.error??null} errorField={query.field??null} beforeActions={activityStatus}/>;
  return embedded ? <EmbeddedEditor>{content}</EmbeddedEditor> : <AppShell title="Customer Profile">{content}</AppShell>;
}
