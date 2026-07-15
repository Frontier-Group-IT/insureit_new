import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CustomerProfileEditor } from "./customer-profile-editor";
import { updateCustomerProfile } from "./actions";
import { DealershipProfileEditor } from "./dealership-profile-editor";
import { updateDealershipProfile } from "./dealership-actions";
import { CorporateProfileEditor } from "./corporate-profile-editor";
import { updateCorporateProfile } from "./corporate-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Customer = { id:string; customer_code:string; contact_name:string; company_name:string|null; phone:string; email:string|null; partner_type:string|null; address_street:string|null; address_locality:string|null; address:string|null; india_location_id:string|null; city:string|null; state:string|null; postal_code:string|null; pan_number:string|null; aadhaar_last_four:string|null; legal_trade_name:string|null; is_gst_registered:boolean; gst_number:string|null; fleet_size_band:string|null; onboarding_status:string; assigned_agent_id:string|null; created_at:string; updated_at:string };
type DocumentRow = { id:string; document_type:string; file_name:string; storage_bucket:string; storage_path:string; verification_status:string; created_at:string };
type VehicleRow = { id:string; vehicle_no:string; vehicle_type:string; make:string|null; model:string|null };
type AgentRow = { id:string; full_name:string };
type DealershipProfile = { dealership_type:"posp"|"misp"; dealership_name:string; owner_name:string; oem_name:string|null; yearly_sales_band:string|null };
type Representative = { representative_name:string; mobile:string; email:string|null; aadhaar_last_four:string|null; pan_number:string|null };
type DealershipContact = { contact_role:string; contact_name:string|null; mobile:string|null; email:string|null };
type CorporateContact = { contact_role:string; full_name:string; phone:string; email:string|null; access_status:string; profile_id:string|null };
type Manufacturer = { name:string };
type GroupOption = { id:string; customer_code:string; company_name:string|null; contact_name:string };
type GroupRelationship = { parent_customer_id:string };

export default async function EditCustomerPage({ params, searchParams }: { params:Promise<{id:string}>; searchParams:Promise<{error?:string;field?:string;success?:string}> }) {
  await requireMasterDataManager();
  const [{id},query] = await Promise.all([params,searchParams]);
  const admin = createSupabaseAdminClient();
  const [{data:customer,error},{data:documents},{data:vehicles},{data:agents}] = await Promise.all([
    admin.from("customers").select("id, customer_code, contact_name, company_name, phone, email, partner_type, address_street, address_locality, address, india_location_id, city, state, postal_code, pan_number, aadhaar_last_four, legal_trade_name, is_gst_registered, gst_number, fleet_size_band, onboarding_status, assigned_agent_id, created_at, updated_at").eq("id",id).maybeSingle<Customer>(),
    admin.from("customer_documents").select("id, document_type, file_name, storage_bucket, storage_path, verification_status, created_at").eq("customer_id",id).order("created_at",{ascending:false}).returns<DocumentRow[]>(),
    admin.from("vehicles").select("id, vehicle_no, vehicle_type, make, model").eq("customer_id",id).order("created_at",{ascending:false}).returns<VehicleRow[]>(),
    admin.from("profiles").select("id, full_name").eq("role","agent").eq("is_active",true).order("full_name").returns<AgentRow[]>()
  ]);
  if(error||!customer) notFound();
  const documentsWithUrls=await Promise.all((documents??[]).map(async(document)=>({...document,signedUrl:(await admin.storage.from(document.storage_bucket).createSignedUrl(document.storage_path,600)).data?.signedUrl??null})));

  if(customer.partner_type==="corporate"){
    const [{data:contacts},{data:groups},{data:relationship}] = await Promise.all([
      admin.from("customer_contacts").select("contact_role,full_name,phone,email,access_status,profile_id").eq("customer_id",id).order("contact_role").returns<CorporateContact[]>(),
      admin.from("customers").select("id,customer_code,company_name,contact_name").eq("partner_type","group").eq("onboarding_status","active").order("company_name",{ascending:true}).returns<GroupOption[]>(),
      admin.from("customer_relationships").select("parent_customer_id").eq("child_customer_id",id).eq("relationship_type","group_member").eq("is_active",true).eq("status","active").maybeSingle<GroupRelationship>()
    ]);
    return <AppShell title="Corporate Profile"><CorporateProfileEditor customer={customer} contacts={contacts??[]} groups={groups??[]} currentGroupId={relationship?.parent_customer_id??null} action={updateCorporateProfile.bind(null,id)} errorMessage={query.error??null} successMessage={query.success??null}/></AppShell>;
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
    return <AppShell title="Dealership Profile"><DealershipProfileEditor action={updateDealershipProfile.bind(null,id)} values={{dealership_type:dealership.dealership_type,dealership_name:dealership.dealership_name,owner_name:dealership.owner_name,phone:customer.phone,email:customer.email,address_street:customer.address_street,address_locality:customer.address_locality,city:customer.city,state:customer.state,postal_code:customer.postal_code,india_location_id:customer.india_location_id,oem_name:dealership.oem_name,yearly_sales_band:dealership.yearly_sales_band,is_gst_registered:customer.is_gst_registered,gst_number:customer.gst_number,representative_name:representative.representative_name,representative_mobile:representative.mobile,representative_email:representative.email,representative_pan:representative.pan_number,aadhaar_last_four:representative.aadhaar_last_four}} contacts={contacts??[]} documents={documentsWithUrls} oems={oems}/></AppShell>;
  }

  return <AppShell title="Customer Profile"><CustomerProfileEditor customer={customer} documents={documentsWithUrls} vehicles={vehicles??[]} agents={agents??[]} action={updateCustomerProfile.bind(null,id)} errorMessage={query.error??null} errorField={query.field??null}/></AppShell>;
}
