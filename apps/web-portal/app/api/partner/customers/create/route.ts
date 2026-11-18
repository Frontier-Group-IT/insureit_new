import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const response = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const documentTypes = new Set(["pan_copy", "aadhaar_front", "aadhaar_back", "gst_copy"]);
const mimeExtensions: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
};
type Scope = { actor_kind?: string; intermediary_ids?: string[]; scope_mode?: string };
type Identity = { actor_kind?: string; auth_user_id?: string; profile_id?: string; role?: string; intermediary_id?: string };
type UploadRecord = { id: string; created_by: string | null; lead_source_intermediary_id: string | null; is_gst_registered: boolean };

const trimmed = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const optional = (value: string) => value || null;

async function authorize(request: Request) {
  const token = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const scoped = createSupabaseWithAccessToken(token);
  const { data: auth, error } = await scoped.auth.getUser(token);
  if (error || !auth.user) return null;
  const [{ data: rawIdentity }, { data: rawScope }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  const identity = rawIdentity as Identity | null;
  const scope = rawScope as Scope | null;
  if (!identity || !scope || identity.auth_user_id !== auth.user.id ||
      !["employee","intermediary"].includes(identity.actor_kind ?? "") ||
      scope.actor_kind !== identity.actor_kind || scope.scope_mode === "none") return null;
  const admin = createSupabaseAdminClient();
  if (identity.actor_kind === "employee") {
    if (identity.profile_id !== auth.user.id) return null;
    const { data: profile } = await admin.from("profiles").select("id,role,is_active,employee_id")
      .eq("id",auth.user.id).maybeSingle();
    if (!profile?.is_active || !profile.employee_id || profile.role !== identity.role) return null;
    const { data: employee } = await admin.from("employees").select("employment_status")
      .eq("id",profile.employee_id).maybeSingle();
    if (employee?.employment_status !== "active" ||
        !(await hasEffectiveCapability(profile,"create_customers","edit"))) return null;
  }
  return { authId: auth.user.id, scoped, scope, identity, admin };
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request);
    if (!actor) return response({ ok: false, error: "You do not have permission to create customers." }, 403);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return response({ ok:false,error:"Invalid customer details." },400);
    const name = trimmed(body.customer_name,160), mobile = trimmed(body.mobile,20);
    const requestId = trimmed(body.requestId,80);
    if (!/^[a-z0-9_-]{12,80}$/i.test(requestId)) return response({ok:false,error:"Missing customer request identifier."},400);
    const customerCode = "CUST-" + createHash("sha256").update(actor.authId + ":" + requestId).digest("hex").slice(0,20).toUpperCase();
    const email = trimmed(body.email,254).toLowerCase();
    const pan = trimmed(body.pan_number,15).toUpperCase();
    const aadhaar = trimmed(body.aadhaar_number,20).replace(/\s/g,"");
    const pin = trimmed(body.pin_code,10);
    const gstRegistered = body.gst_registered === true;
    const gstNumber = trimmed(body.gst_number,20).toUpperCase();
    const tradeName = trimmed(body.legal_trade_name,200);
    if (!name || !/^[6-9]\d{9}$/.test(mobile)) return response({ ok:false,error:"Customer name and valid mobile number are required." },400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response({ ok:false,error:"Invalid email address." },400);
    if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) return response({ ok:false,error:"Invalid PAN." },400);
    if (aadhaar && !/^\d{12}$/.test(aadhaar)) return response({ ok:false,error:"Invalid Aadhaar number." },400);
    if (pin && !/^\d{6}$/.test(pin)) return response({ ok:false,error:"Invalid PIN." },400);
    if (gstRegistered && (!gstPattern.test(gstNumber) || !tradeName)) return response({ ok:false,error:"GSTIN and Legal Trade Name are required for GST registration." },400);

    const scopedIds = Array.isArray(actor.scope.intermediary_ids)
      ? actor.scope.intermediary_ids.filter(value => typeof value === "string" && uuid.test(value)) : [];
    // Never accept a commercial source ID from the client.
    let sourceId: string | null = null;
    if (actor.identity.actor_kind === "intermediary") {
      const own = actor.identity.intermediary_id;
      if (own && scopedIds.includes(own)) sourceId = own;
      else if (scopedIds.length === 1) sourceId = scopedIds[0];
      else return response({ ok:false,error:"Choose a single authorised customer source in Operations before creating a customer from this account." },403);
    } else if (actor.scope.scope_mode !== "organization") {
      if (scopedIds.length !== 1) return response({ ok:false,error:"Your account has multiple customer sources. Select a source through Operations." },403);
      sourceId = scopedIds[0];
    }
    const { data: prior } = await actor.admin.from("customers")
      .select("id,contact_name,phone,created_by").eq("customer_code",customerCode).maybeSingle();
    if (prior) {
      if (prior.created_by !== actor.authId || prior.contact_name !== name || prior.phone !== mobile)
        return response({ok:false,error:"This request identifier belongs to another customer."},409);
      return response({ok:true,customerId:prior.id},200);
    }
    const { data, error } = await actor.admin.from("customers").insert({
      customer_code: customerCode,
      contact_name: name, phone: mobile, email: optional(email),
      address: optional([trimmed(body.street,200),trimmed(body.locality,150)].filter(Boolean).join(", ")),
      address_street: optional(trimmed(body.street,200)), address_locality: optional(trimmed(body.locality,150)),
      city: optional(trimmed(body.city,100)), state: optional(trimmed(body.state,100)),
      postal_code: optional(pin), pincode: optional(pin), pan_number: optional(pan),
      aadhaar_last_four: aadhaar ? aadhaar.slice(-4) : null,
      legal_trade_name: gstRegistered ? tradeName : optional(tradeName),
      is_gst_registered: gstRegistered, gst_number: gstRegistered ? gstNumber : null,
      gstin: gstRegistered ? gstNumber : null,
      lead_source_intermediary_id: sourceId, created_by: actor.authId,
      creation_channel: "legacy", source: "Partner App", status: "active",
    }).select("id").single();
    if (error?.code === "23505") {
      const { data: recovered } = await actor.admin.from("customers")
        .select("id,contact_name,phone,created_by").eq("customer_code",customerCode).maybeSingle();
      if (recovered?.created_by === actor.authId && recovered.contact_name === name && recovered.phone === mobile)
        return response({ok:true,customerId:recovered.id},200);
    }
    if (error || !data?.id) return response({ ok:false,error:"Customer could not be created. No confirmation was returned." },422);
    return response({ ok:true,customerId:data.id },201);
  } catch {
    return response({ ok:false,error:"Customer creation failed. Please check your customer list before retrying." },500);
  }
}

export async function PUT(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const actor = await authorize(request);
    if (!actor) return response({ ok:false,error:"Customer document upload is not authorised." },403);
    const claimedSize = Number(request.headers.get("content-length") || 0);
    if (claimedSize > 4.4*1024*1024) return response({ok:false,error:"File upload exceeds the secure request limit."},413);
    const input = await request.formData();
    const customerId = input.get("customerId"), docType = input.get("type"), file = input.get("file");
    if (typeof customerId !== "string" || !uuid.test(customerId) ||
        typeof docType !== "string" || !documentTypes.has(docType) || !(file instanceof File)) {
      return response({ ok:false,error:"Invalid customer document request." },400);
    }
    if (file.size < 1 || file.size > 4*1024*1024 || !mimeExtensions[file.type]) {
      return response({ ok:false,error:"Only PDF, JPG or PNG files under 4 MB are allowed." },400);
    }
    const { data: customer } = await actor.admin.from("customers")
      .select("id,created_by,lead_source_intermediary_id,is_gst_registered")
      .eq("id",customerId).maybeSingle<UploadRecord>();
    if (!customer || customer.created_by !== actor.authId ||
        (docType === "gst_copy" && !customer.is_gst_registered)) {
      return response({ ok:false,error:"You cannot upload documents for this customer." },403);
    }
    const { data: allowed } = await actor.scoped.rpc("partner_app_customer_in_scope",{p_customer_id:customerId});
    if (allowed !== true) return response({ ok:false,error:"Customer is outside your authorised scope." },403);
    const { data: savedDocument } = await actor.admin.from("customer_documents")
      .select("id").eq("customer_id",customerId).eq("document_type",docType)
      .eq("uploaded_by",actor.authId).limit(1).maybeSingle();
    if (savedDocument) return response({ok:true,alreadySaved:true},200);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const signature = file.type === "application/pdf" ? bytes[0]===37&&bytes[1]===80&&bytes[2]===68&&bytes[3]===70
      : file.type === "image/png" ? bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71
      : bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if (!signature) return response({ok:false,error:"The selected file does not match its format."},400);
    uploadedPath = customerId + "/" + docType + "/" + randomUUID() + "." + mimeExtensions[file.type];
    const { error: uploadError } = await actor.admin.storage.from("customer-documents").upload(uploadedPath,bytes,{ contentType:file.type,upsert:false });
    if (uploadError) return response({ok:false,error:"Secure document upload failed."},422);
    const { error: insertError } = await actor.admin.from("customer_documents").insert({
      customer_id:customerId,document_type:docType,file_name:file.name.slice(0,180),
      storage_bucket:"customer-documents",storage_path:uploadedPath,mime_type:file.type,
      file_size:file.size,uploaded_by:actor.authId,upload_source:"manager_portal",
      verification_status:"pending",
    });
    if (insertError) {
      await actor.admin.storage.from("customer-documents").remove([uploadedPath]);
      return response({ok:false,error:"Document metadata could not be saved."},422);
    }
    return response({ok:true},201);
  } catch {
    return response({ok:false,error:"Document upload could not be completed."},500);
  }
}
