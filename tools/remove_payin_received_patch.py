from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace(path: str, old: str, new: str) -> None:
    file = ROOT / path
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))

# Server action: PayIn stops at Billed. Historical Received rows are exposed as Billed.
path = ROOT / "apps/web-portal/app/policies/policy-payin-billing-actions.ts"
text = path.read_text()
text = text.replace('export type PolicyPayinStatus = "Unbilled" | "Billing details incomplete" | "Billed" | "Received";', 'export type PolicyPayinStatus = "Unbilled" | "Billing details incomplete" | "Billed";')
text = text.replace('''  status: PolicyPayinStatus;\n  receivedAmount: string;\n  receivedDate: string;\n  receiptReference: string;\n};\n\nexport type PolicyPayinReceipt = {\n  receivedAmount: string;\n  receivedDate: string;\n  receiptReference: string;\n};''', '''  status: PolicyPayinStatus;\n};''')
text = text.replace('''  status: string | null;\n  received_amount: number | null;\n  received_date: string | null;\n  receipt_reference: string | null;\n  received_by: string | null;''', '''  status: string | null;''')
text = text.replace('''  "Billed",\n  "Received",''', '''  "Billed",''')
text = text.replace('''function normalizedStatus(value: string | null): PolicyPayinStatus {\n  return allowedStatuses.has(value as PolicyPayinStatus) ? (value as PolicyPayinStatus) : "Unbilled";\n}''', '''function normalizedStatus(value: string | null, billedAmount: number | null, billNumber: string | null, billDate: string | null): PolicyPayinStatus {\n  if (value === "Received") return "Billed";\n  if (allowedStatuses.has(value as PolicyPayinStatus)) return value as PolicyPayinStatus;\n  const hasAmount = Number(billedAmount ?? 0) > 0;\n  const hasBillNumber = Boolean(billNumber?.trim());\n  const hasBillDate = Boolean(billDate);\n  if (!hasAmount && !hasBillNumber && !hasBillDate) return "Unbilled";\n  return hasAmount && hasBillNumber && hasBillDate ? "Billed" : "Billing details incomplete";\n}''')
text = text.replace('.select("id,bill_number,billed_amount,bill_date,status,received_amount,received_date,receipt_reference,received_by")', '.select("id,bill_number,billed_amount,bill_date,status")')
text = text.replace('''      status: normalizedStatus(data?.status ?? null),\n      receivedAmount: data?.received_amount === null || data?.received_amount === undefined ? "" : String(data.received_amount),\n      receivedDate: data?.received_date ?? "",\n      receiptReference: data?.receipt_reference ?? "",''', '''      status: normalizedStatus(data?.status ?? null, data?.billed_amount ?? null, data?.bill_number ?? null, data?.bill_date ?? null),''')
text = text.replace('''    .select("id,status,received_amount,received_date,receipt_reference,received_by")''', '''    .select("id")''')
text = text.replace('''.maybeSingle<{ id: string; status: string | null; received_amount: number | null; received_date: string | null; receipt_reference: string | null; received_by: string | null }>();''', '''.maybeSingle<{ id: string }>();''')
text = text.replace('''  const alreadyReceived = existing?.status === "Received";\n  if (billing.status === "Received" && !alreadyReceived) {\n    return { ok: false, error: "Use Mark as Received to record insurer receipt details." };\n  }\n''', '')
text = text.replace('''    status: alreadyReceived ? "Received" : billing.status,''', '''    status: billing.status,''')
marker = '\n\nexport async function markPolicyPayinReceived('
if marker in text:
    text = text.split(marker, 1)[0].rstrip() + '\n'
path.write_text(text)

# Edit page: receipt fields no longer participate in policy editing.
replace(
    "apps/web-portal/app/policies/[id]/edit/page.tsx",
    '''    payinStatus: billing.status,\n    payinReceivedAmount: billing.receivedAmount,\n    payinReceivedDate: billing.receivedDate,\n    payinReceiptReference: billing.receiptReference,\n    retention:''',
    '''    payinStatus: billing.status,\n    retention:''',
)

# Unified form: remove receipt state, action, panel and Received status handling.
form = ROOT / "apps/web-portal/components/policy-unified-form.tsx"
text = form.read_text()
text = text.replace('import { markPolicyPayinReceived, savePolicyPayinBilling, type PolicyPayinStatus } from "@/app/policies/policy-payin-billing-actions";', 'import { savePolicyPayinBilling, type PolicyPayinStatus } from "@/app/policies/policy-payin-billing-actions";')
text = text.replace('''  payinStatus?: string;\n  payinReceivedAmount?: string;\n  payinReceivedDate?: string;\n  payinReceiptReference?: string;\n  retention?: string;''', '''  payinStatus?: string;\n  retention?: string;''')
text = text.replace('''payinStatus: values?.payinStatus ?? "Unbilled", payinReceivedAmount: values?.payinReceivedAmount ?? values?.payinBilledAmount ?? "", payinReceivedDate: values?.payinReceivedDate ?? today(), payinReceiptReference: values?.payinReceiptReference ?? "", retention:''', '''payinStatus: values?.payinStatus === "Received" ? "Billed" : (values?.payinStatus ?? "Unbilled"), retention:''')
text = text.replace('''function assessPayinStatus(amount:string,billNumber:string,billDate:string,currentStatus:string){\n  if(currentStatus==="Received") return "Received";''', '''function assessPayinStatus(amount:string,billNumber:string,billDate:string){''')
text = text.replace('''  const [isSubmitting,startSubmit]=useTransition();\n  const [isMarkingReceived,startMarkReceived]=useTransition();''', '''  const [isSubmitting,startSubmit]=useTransition();''')
text = text.replace('''      const nextStatus=assessPayinStatus(nextAmount,current.payinBillNo,current.payinBillDate,current.payinStatus);''', '''      const nextStatus=assessPayinStatus(nextAmount,current.payinBillNo,current.payinBillDate);''')
start = text.find('  function markPayinReceived(){')
if start != -1:
    end = text.find('\n\n  const vehicleMeta', start)
    if end == -1:
        raise RuntimeError('Could not locate end of markPayinReceived function')
    text = text[:start] + text[end:]
receipt_render = '''        {(form.payinStatus==="Billed"||form.payinStatus==="Received")?<div className="md:col-span-2 xl:col-span-4"><PayinReceiptPanel status={form.payinStatus} isEdit={isEdit} amount={form.payinReceivedAmount||form.payinBilledAmount} date={form.payinReceivedDate||today()} reference={form.payinReceiptReference} busy={isMarkingReceived} onAmountChange={value=>update("payinReceivedAmount",value)} onDateChange={value=>update("payinReceivedDate",value)} onReferenceChange={value=>update("payinReceiptReference",value.toUpperCase())} onMarkReceived={markPayinReceived}/></div>:null}\n'''
text = text.replace(receipt_render, '')
old_status = '''function PayinStatusField({status}:{status:string}){const tone=status==="Billed"?"border-[#BFE8D5] bg-[#F0FBF6] text-[#14845B]":status==="Billing details incomplete"?"border-[#F1D59A] bg-[#FFF9EB] text-[#A96A00]":status==="Received"?"border-[#B7D8F5] bg-[#F1F7FE] text-[#2563A6]":"border-[#E1E7EF] bg-[#F8FAFC] text-[#667085]";return <div><label className={labelClass}>PayIn Status</label><div className={`flex h-10 items-center rounded-xl border px-3 ${tone}`}><span className="text-[10px] font-bold">{status}</span><span className="ml-auto text-[7.5px] font-semibold uppercase tracking-[.05em] opacity-70">{status==="Received"?"Confirmed":"Auto"}</span></div></div>;}'''
new_status = '''function PayinStatusField({status}:{status:string}){const tone=status==="Billed"?"border-[#BFE8D5] bg-[#F0FBF6] text-[#14845B]":status==="Billing details incomplete"?"border-[#F1D59A] bg-[#FFF9EB] text-[#A96A00]":"border-[#E1E7EF] bg-[#F8FAFC] text-[#667085]";return <div><label className={labelClass}>PayIn Status</label><div className={`flex h-10 items-center rounded-xl border px-3 ${tone}`}><span className="text-[10px] font-bold">{status}</span><span className="ml-auto text-[7.5px] font-semibold uppercase tracking-[.05em] opacity-70">Auto</span></div></div>;}'''
if old_status not in text:
    raise RuntimeError('PayinStatusField source not found')
text = text.replace(old_status, new_status, 1)
start = text.find('function PayinReceiptPanel(')
if start != -1:
    end = text.find('\nfunction PayinOutcomeLine', start)
    if end == -1:
        raise RuntimeError('Could not locate end of PayinReceiptPanel')
    text = text[:start] + text[end+1:]
form.write_text(text)

# Normalize any short-lived historical Received status back to Billed.
migration = ROOT / "supabase/migrations/202608130001_policy_payin_billed_only.sql"
migration.write_text('''update public.policy_payin_bills\nset status = 'Billed', updated_at = now()\nwhere status = 'Received';\n''')
