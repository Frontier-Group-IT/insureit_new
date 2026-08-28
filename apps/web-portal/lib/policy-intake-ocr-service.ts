import "server-only";
import { headers } from "next/headers";
import { parsePolicyDocument, type ParsedPolicyField } from "@/lib/policy-ocr-parsers";
import { refineAdditionalMotorPolicy } from "@/lib/policy-ocr-additional-motor-refiner";
import { refineDigitCommercialPolicyV2 } from "@/lib/policy-ocr-digit-refiner-v2";
import { refineIffcoCommercialPolicyV2 } from "@/lib/policy-ocr-iffco-refiner-v2";
import { refineIffcoStructuredFinancials, type StructuredPolicyTable } from "@/lib/policy-ocr-iffco-structured-refiner";
import { refineNewIndiaCommercialPolicy } from "@/lib/policy-ocr-new-india-refiner";
import { refineNewIndiaStructuredPolicy } from "@/lib/policy-ocr-new-india-structured-refiner";
import { refineApprovedMotorPolicyLayout } from "@/lib/policy-ocr-approved-layout-refiner";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const OCR_TIMEOUT_MS = 120 * 1000;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_LAYOUT_PROCESSOR_ID = "b630ad846c5137a1";

export type PolicyIntakeOcrField = ParsedPolicyField;
export type PolicyIntakeOcrResult =
  | { ok: true; fields: PolicyIntakeOcrField[]; parserId: string; parserVersion: string; warnings: string[] }
  | { ok: false; error: string };

type TextAnchor = { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
type LayoutBlock = { pageSpan?: { pageStart?: number }; textBlock?: { text?: string; blocks?: LayoutBlock[] }; tableBlock?: { headerRows?: LayoutRow[]; bodyRows?: LayoutRow[] }; listBlock?: { listEntries?: Array<{ blocks?: LayoutBlock[] }> } };
type LayoutRow = { cells?: Array<{ blocks?: LayoutBlock[] }> };
type DocumentAiResponse = { document?: { text?: string; pages?: Array<{ layout?: { textAnchor?: TextAnchor } }>; documentLayout?: { blocks?: LayoutBlock[] } }; error?: { message?: string; status?: string } };
type GoogleConfig = { projectId:string; projectNumber:string; poolId:string; providerId:string; serviceAccountEmail:string; location:string; processorId:string; layoutProcessorId:string };

export async function extractPolicyIntakeDocumentTrusted(formData: FormData): Promise<PolicyIntakeOcrResult> {
  const file = formData.get("policy_document");
  if (!(file instanceof File) || !file.size) return { ok:false, error:"Select a policy PDF or image." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok:false, error:"Only PDF, JPG, PNG and WebP policy copies are supported." };
  if (file.size > MAX_FILE_SIZE) return { ok:false, error:"The policy document must be 15 MB or smaller." };
  const config = googleConfig();
  if (!config) return { ok:false, error:"Policy document reading is temporarily unavailable." };
  const requestHeaders = await headers();
  const subjectToken = process.env.VERCEL_OIDC_TOKEN || requestHeaders.get("x-vercel-oidc-token") || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN;
  if (!subjectToken) return { ok:false, error:"Policy document reading is temporarily unavailable." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const token = await googleAccessToken(config, subjectToken, controller.signal);
    const content = Buffer.from(await file.arrayBuffer()).toString("base64");
    const endpoint = `https://${config.location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/processors/${encodeURIComponent(config.processorId)}:process`;
    const response = await fetch(endpoint, { method:"POST", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"}, body:JSON.stringify({rawDocument:{content,mimeType:file.type},processOptions:{ocrConfig:{enableNativePdfParsing:true,enableImageQualityScores:true}}}), cache:"no-store", signal:controller.signal });
    const payload = await response.json().catch(() => null) as DocumentAiResponse | null;
    if (!response.ok) return { ok:false, error:documentAiError(response.status,payload?.error?.message) };
    const pages = pageTexts(payload?.document);
    if (!pages.length) return { ok:false, error:"No readable policy text was found in this document." };
    const base = parsePolicyDocument(pages);
    let parsed = base.parserId === "digit_commercial_motor_v1" ? refineDigitCommercialPolicyV2(pages, base)
      : base.parserId === "iffco_tokio_commercial_motor_v1" ? refineIffcoCommercialPolicyV2(pages, base)
      : base.parserId === "new_india_motor_v1" ? refineNewIndiaCommercialPolicy(pages, base)
      : refineAdditionalMotorPolicy(pages, base);
    const tables = file.type === "application/pdf" ? await layoutTables(config,content,file.type,token,controller.signal) : [];
    if (base.parserId === "iffco_tokio_commercial_motor_v1" && parsed.fields.find((field) => field.key === "policy_product")?.value !== "SAOD") parsed = refineIffcoStructuredFinancials(tables, parsed);
    if (base.parserId === "new_india_motor_v1") parsed = refineNewIndiaStructuredPolicy(tables, parsed);
    parsed = refineApprovedMotorPolicyLayout(pages,tables,parsed);
    if (!parsed.fields.length) return { ok:false, error:"No supported policy details could be read from this document." };
    return { ok:true, fields:parsed.fields, parserId:parsed.parserId, parserVersion:parsed.parserVersion, warnings:parsed.warnings };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { ok:false, error:"The policy document took too long to read. Please try again." };
    console.error("Policy Intake OCR failed", error instanceof Error ? error.name : typeof error);
    return { ok:false, error:"The policy document could not be read. Please try again." };
  } finally { clearTimeout(timeout); }
}

function googleConfig(): GoogleConfig | null {
  const projectId=process.env.GOOGLE_CLOUD_PROJECT_ID?.trim(), projectNumber=process.env.GOOGLE_CLOUD_PROJECT_NUMBER?.trim(), poolId=process.env.GOOGLE_WORKLOAD_IDENTITY_POOL_ID?.trim(), providerId=process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER_ID?.trim(), serviceAccountEmail=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(), location=process.env.GOOGLE_DOCUMENT_AI_LOCATION?.trim(), processorId=process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim(), layoutProcessorId=process.env.GOOGLE_DOCUMENT_AI_LAYOUT_PROCESSOR_ID?.trim()||DEFAULT_LAYOUT_PROCESSOR_ID;
  return projectId&&projectNumber&&poolId&&providerId&&serviceAccountEmail&&location&&processorId ? {projectId,projectNumber,poolId,providerId,serviceAccountEmail,location,processorId,layoutProcessorId} : null;
}

async function googleAccessToken(config:GoogleConfig,subjectToken:string,signal:AbortSignal){
  const audience=`//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`;
  const sts=await fetch("https://sts.googleapis.com/v1/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({audience,grant_type:"urn:ietf:params:oauth:grant-type:token-exchange",requested_token_type:"urn:ietf:params:oauth:token-type:access_token",scope:CLOUD_PLATFORM_SCOPE,subject_token_type:"urn:ietf:params:oauth:token-type:jwt",subject_token:subjectToken}),cache:"no-store",signal});
  const stsPayload=await sts.json().catch(()=>null) as {access_token?:string}|null; if(!sts.ok||!stsPayload?.access_token)throw new Error("google_sts_exchange_failed");
  const impersonation=await fetch(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.serviceAccountEmail)}:generateAccessToken`,{method:"POST",headers:{Authorization:`Bearer ${stsPayload.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({scope:[CLOUD_PLATFORM_SCOPE],lifetime:"900s"}),cache:"no-store",signal});
  const payload=await impersonation.json().catch(()=>null) as {accessToken?:string}|null; if(!impersonation.ok||!payload?.accessToken)throw new Error("google_service_account_impersonation_failed"); return payload.accessToken;
}

function pageTexts(document:DocumentAiResponse["document"]){const text=document?.text??"";if(!text.trim())return[];const pages=document?.pages??[];if(!pages.length)return[text];return pages.map(page=>anchorText(text,page.layout?.textAnchor).trim()).filter(Boolean);}
function anchorText(text:string,anchor?:TextAnchor){return(anchor?.textSegments??[]).map(segment=>{const start=Number(segment.startIndex??0),end=Number(segment.endIndex??0);return Number.isFinite(start)&&Number.isFinite(end)&&end>start?text.slice(start,end):""}).join("\n");}
async function layoutTables(config:GoogleConfig,content:string,mimeType:string,token:string,signal:AbortSignal):Promise<StructuredPolicyTable[]>{const endpoint=`https://${config.location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/processors/${encodeURIComponent(config.layoutProcessorId)}:process`;const response=await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({rawDocument:{content,mimeType},processOptions:{layoutConfig:{enableTableAnnotation:true}}}),cache:"no-store",signal});const payload=await response.json().catch(()=>null) as DocumentAiResponse|null;if(!response.ok)return[];const result:StructuredPolicyTable[]=[];walk(payload?.document?.documentLayout?.blocks??[],result);return result;}
function walk(blocks:LayoutBlock[],result:StructuredPolicyTable[]){for(const block of blocks){if(block.tableBlock){const rows=[...(block.tableBlock.headerRows??[]),...(block.tableBlock.bodyRows??[])].map(row=>(row.cells??[]).map(cell=>blockText(cell.blocks??[]).trim())).filter(row=>row.some(Boolean));if(rows.length)result.push({page:Math.max(1,Number(block.pageSpan?.pageStart??1)),rows});}if(block.textBlock?.blocks?.length)walk(block.textBlock.blocks,result);for(const entry of block.listBlock?.listEntries??[])if(entry.blocks?.length)walk(entry.blocks,result);}}
function blockText(blocks:LayoutBlock[]):string{const parts:string[]=[];for(const block of blocks){if(block.textBlock?.text)parts.push(block.textBlock.text);if(block.textBlock?.blocks?.length)parts.push(blockText(block.textBlock.blocks));if(block.tableBlock)for(const row of [...(block.tableBlock.headerRows??[]),...(block.tableBlock.bodyRows??[])])parts.push((row.cells??[]).map(cell=>blockText(cell.blocks??[])).join(" "));for(const entry of block.listBlock?.listEntries??[])if(entry.blocks?.length)parts.push(blockText(entry.blocks));}return parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();}
function documentAiError(status:number,message?:string){if(status===400)return"This file could not be read. Check that it is a valid, clear policy PDF or image.";if(status===401||status===403)return"Policy document reading is temporarily unavailable.";if(status===413)return"The policy document is too large to process online.";if(status===429)return"Policy document reading is temporarily busy. Please try again shortly.";if(message?.toLowerCase().includes("page"))return"This policy has more pages than the current processing limit.";return"The policy document could not be read. Please try again.";}
