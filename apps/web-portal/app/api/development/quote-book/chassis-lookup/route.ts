import { NextResponse } from "next/server";
import { getAuthenticatedProfile } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Development-only lookup. Never send a service-role credential to the browser.
export async function POST(request: Request) {
  const auth = await getAuthenticatedProfile((await getServerAccessToken()) || "");
  if (!auth.user || !auth.profile?.is_active) return NextResponse.json({error:"Unauthorized"}, {status:401});
  if (auth.profile.role !== "it_super_user" && auth.profile.role !== "super_admin") return NextResponse.json({error:"Not authorized"}, {status:403});
  let chassisNumber = "";
  try { const body = await request.json(); chassisNumber = String(body.chassisNumber ?? "").trim().toUpperCase(); }
  catch { return NextResponse.json({error:"Invalid request"}, {status:400}); }
  if (!/^[A-Z0-9-]{5,40}$/.test(chassisNumber) || chassisNumber==="123456789") return NextResponse.json({error:"Enter a valid chassis number"}, {status:400});
  const admin = createSupabaseAdminClient();
  const {data:vehicles,error} = await admin.from("vehicles")
    .select("customer_id,vehicle_no,make,model,year,chassis_no,engine_no,vehicle_class_code,vehicle_category,body_type,fuel_type,color,manufacture_date,engine_capacity_cc,gvw_kg,unladen_weight_kg,seating_capacity,standing_capacity,sleeper_capacity,wheel_base_mm,emission_norm,rto_name,rto_state,registration_date,fitness_expiry_date,puc_expiry_date,road_tax_expiry_date,local_permit_expiry_date,national_permit_expiry_date,permit_type,permit_no,blacklist_status")
    .eq("chassis_no",chassisNumber).limit(5);
  if (error) return NextResponse.json({error:"Saved vehicle lookup failed"}, {status:502});
  if (!vehicles?.length) return NextResponse.json({error:"No matching chassis in INSUREIT. Enter details manually."}, {status:404});
  const vehicle=vehicles[0];
  const {data:customer}=vehicle.customer_id ? await admin.from("customers").select("company_name,contact_name,phone,email,address,city,state,pincode,customer_type,pan,gstin").eq("id",vehicle.customer_id).maybeSingle() : {data:null};
  const source: Record<string,unknown> = {
    make:vehicle.make,model:vehicle.model,manufacturingYear:vehicle.year,manufactureDate:vehicle.manufacture_date,
    vehicleClass:vehicle.vehicle_class_code,vehicleCategory:vehicle.vehicle_category,bodyType:vehicle.body_type,
    fuelType:vehicle.fuel_type,color:vehicle.color,chassisNumber:vehicle.chassis_no,engineNumber:vehicle.engine_no,
    engineCapacity:vehicle.engine_capacity_cc,grossWeight:vehicle.gvw_kg,unladenWeight:vehicle.unladen_weight_kg,
    seatingCapacity:vehicle.seating_capacity,standingCapacity:vehicle.standing_capacity,sleeperCapacity:vehicle.sleeper_capacity,
    wheelBase:vehicle.wheel_base_mm,normsType:vehicle.emission_norm,rtoName:vehicle.rto_name,rtoState:vehicle.rto_state,
    registrationDate:vehicle.registration_date,fitnessExpiryDate:vehicle.fitness_expiry_date,pucUpto:vehicle.puc_expiry_date,
    taxUpto:vehicle.road_tax_expiry_date,permitValidUpto:vehicle.local_permit_expiry_date,
    nationalPermitUpto:vehicle.national_permit_expiry_date,permitType:vehicle.permit_type,
    permitNumber:vehicle.permit_no,blacklistStatus:vehicle.blacklist_status,
    ownerName:customer?.company_name || customer?.contact_name,mobileNumber:customer?.phone,email:customer?.email,
    permanentAddress:customer?.address,ownerCity:customer?.city,ownerState:customer?.state,
    ownerPincode:customer?.pincode,proposerType:customer?.customer_type,pan:customer?.pan,gstin:customer?.gstin
  };
  const details: Record<string,string> = {};
  for (const [key,value] of Object.entries(source)) if (value!==null && value!==undefined && String(value).trim()) details[key]=String(value);
  return NextResponse.json({details,matches:vehicles.length});
}
