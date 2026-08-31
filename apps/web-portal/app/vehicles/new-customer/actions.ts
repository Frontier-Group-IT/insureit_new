"use server";

import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function text(formData: FormData, key: string) { const value=formData.get(key); return typeof value==="string"?value.trim():""; }
function cleanPhone(value:string){return value.replace(/\D/g,"").slice(-10);}
function cleanName(value:string){return value.trim().replace(/\s+/g," ");}
function errorUrl(message:string){return `/vehicles/new-customer?error=${encodeURIComponent(message)}`;}

export async function createVehicleCustomer(formData:FormData){
  const profile=await requireCapability("create_customers","edit");
  const name=cleanName(text(formData,"contact_name")),phone=cleanPhone(text(formData,"phone"));
  if(!name)redirect(errorUrl("Enter the customer / insured name."));
  if(!/^[6-9]\d{9}$/.test(phone))redirect(errorUrl("Enter a valid 10 digit mobile number."));
  const admin=createSupabaseAdminClient();
  const {data:candidates,error:lookupError}=await admin.from("customers").select("id,contact_name,phone").eq("phone",phone).limit(25).returns<Array<{id:string;contact_name:string;phone:string}>>();
  if(lookupError)redirect(errorUrl("Could not check existing customers. Please try again."));
  const exact=(candidates??[]).find(candidate=>cleanPhone(candidate.phone)===phone&&cleanName(candidate.contact_name).toLowerCase()===name.toLowerCase());
  if(exact)redirect(`/vehicles/new?customer_id=${encodeURIComponent(exact.id)}`);
  const {data:customer,error}=await admin.from("customers").insert({
    customer_code:`CUST-${Date.now().toString().slice(-9)}`,customer_type:"individual",contact_name:name,
    company_name:text(formData,"company_name")||null,phone,city:text(formData,"city")||null,state:text(formData,"state")||null,
    country:"India",status:"active",created_by:profile.id,updated_by:profile.id
  }).select("id").single<{id:string}>();
  if(error||!customer)redirect(errorUrl("Customer could not be created. Review the details and try again."));
  redirect(`/vehicles/new?customer_id=${encodeURIComponent(customer.id)}`);
}
