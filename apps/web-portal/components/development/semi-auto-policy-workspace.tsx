"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowUpRight, CheckCircle2, ClipboardCheck, FileSearch, Loader2, PencilLine, RefreshCw, Search, ShieldAlert, Sparkles } from "lucide-react";
import { applySemiAutoN8nIntake, bookSemiAutoIntake, checkSemiAutoIntake, editSemiAutoIntake, previewSemiAutoN8nIntake, type SemiAutoActionResult, type SemiAutoN8nResult } from "@/app/development/ai-policy-onboarding/actions";

export type SemiAutoIntakeRow = {
  id: string;
  intake_number: string;
  status: string;
  policy_type: string | null;
  lead_source_name: string;
  customer_mobile: string;
  ocr_status: string;
  created_at: string;
  assigned_to_profile_id: string | null;
  n8n_enabled?: boolean;
};

const humanStatus: Record<string, string> = {
  ready_for_review: "Ready for Review", in_review: "In Review",
  needs_attention: "Needs Attention", processing: "Processing",
};

function compactDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "-" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export function SemiAutoPolicyWorkspace({ rows, profileId }: { rows: SemiAutoIntakeRow[]; profileId: string }) {
  const router = useRouter();
  const requestId = useRef(0);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<SemiAutoActionResult | null>(null);
  const [busy, setBusy] = useState<"checking" | "booking" | "editing" | "extracting" | "applying" | null>(null);
  const [n8nResult, setN8nResult] = useState<SemiAutoN8nResult | null>(null);
  const [n8nNotice, setN8nNotice] = useState<string | null>(null);
  const [done, setDone] = useState<{ policyCode: string; policyId: string } | null>(null);
  const [takeover, setTakeover] = useState<{ intakeId: string; reviewerName: string } | null>(null);
  const selected = rows.find(row => row.id === selectedId);
  const visible = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(row => [row.intake_number, row.lead_source_name, row.customer_mobile, row.status, row.ocr_status].join(" ").toLowerCase().includes(query));
  }, [rows, search]);
  const available = result?.ready === true && result.issues.length === 0;
  const n8nEnabled = selected?.n8n_enabled === true;
  const isWaiting = busy !== null;

  async function selectRow(id: string) {
    const next = ++requestId.current;
    if (selectedId === id) {
      setSelectedId(null); setResult(null); setDone(null); setBusy(null); setTakeover(null); setN8nResult(null); setN8nNotice(null); return;
    }
    setSelectedId(id); setResult(null); setDone(null); setTakeover(null); setN8nResult(null); setN8nNotice(null); setBusy("checking");
    try {
      const assessment = await checkSemiAutoIntake(id);
      if (requestId.current === next) setResult(assessment);
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Eligibility check", message: "The readiness check failed to contact the server. Refresh and try again." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function retry() {
    if (!selectedId) return;
    const next = ++requestId.current;
    setResult(null); setBusy("checking");
    try {
      const assessment = await checkSemiAutoIntake(selectedId);
      if (requestId.current === next) setResult(assessment);
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Readiness check", message: "Could not verify the Intake. Please retry." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function previewN8n() {
    if (!selectedId || !n8nEnabled || isWaiting) return;
    const next = ++requestId.current;
    setBusy("extracting"); setN8nResult(null); setN8nNotice(null);
    try {
      const response = await previewSemiAutoN8nIntake(selectedId);
      if (requestId.current === next) setN8nResult(response);
    } catch {
      if (requestId.current === next) setN8nResult({
        ok: false, error: "The secured n8n preview could not be completed. Existing OCR and onboarding were not changed.",
      });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function applyN8n() {
    if (!selectedId || !n8nResult?.ok || !n8nResult.preview.canApply || isWaiting) return;
    const confirmed = window.confirm(
      "Apply the reviewed n8n extraction to this failed OCR Intake? Confirm all proposed fields against the original PDF. This will replace only empty failed OCR data, change the Intake to Ready for Review, and will NOT create a customer, vehicle or policy. Normal draft correction and explicit booking approval remain mandatory.",
    );
    if (!confirmed) return;
    const next = ++requestId.current;
    setBusy("applying"); setN8nNotice(null);
    try {
      const response = await applySemiAutoN8nIntake(
        selectedId, n8nResult.preview.documentId, n8nResult.preview.fingerprint, true,
      );
      if (requestId.current !== next) return;
      if (response.ok) {
        setN8nResult(null);
        setN8nNotice("Validated OCR fields saved to this Intake. Review/correct the canonical draft and run Recheck. No policy has been booked.");
        setResult(await checkSemiAutoIntake(selectedId));
        router.refresh();
      } else {
        setN8nNotice(response.error ?? "The Intake has changed. Recheck before attempting to apply.");
        setN8nResult(null);
      }
    } catch {
      if (requestId.current === next) {
        setN8nResult(null);
        setN8nNotice("The save response was interrupted. Recheck the Intake and its original copy before attempting again.");
      }
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function book() {
    if (!selectedId || !available || isWaiting) return;
    const accepted = window.confirm("Book this issued Motor Policy using the verified Intake and saved onboarding draft? Confirm that you checked the original PDF, particularly the Policy Issuance Date, insured identity, and premiums. This action creates a real policy; it cannot be undone from this page. Unverified pay-in and payout will remain for commercial review.");
    if (!accepted) return;
    const next = ++requestId.current;
    setBusy("booking"); setDone(null);
    try {
      const booking = await bookSemiAutoIntake(selectedId, true);
      if (requestId.current !== next) return;
      setResult(booking);
      if (booking.ok && booking.policyCode && booking.policyId) {
        setDone({ policyCode: booking.policyCode, policyId: booking.policyId });
        router.refresh();
      }
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Policy", field: "Booking status", message: "The booking response was interrupted. Check the Intake status and Policy Register before retrying to prevent a duplicate." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function correct() {
    if (!selectedId || isWaiting) return;
    const next = ++requestId.current;
    setBusy("editing");
    try {
      const response = await editSemiAutoIntake(selectedId);
      if (requestId.current !== next) return;
      if (response.assignmentConflict) {
        // Do not silently change the current reviewer. Show the assignee's
        // name and ask for a separate, explicit takeover confirmation.
        setTakeover({ intakeId: selectedId, reviewerName: response.assignmentConflict.reviewerName });
      } else if (response.ok && response.editUrl) {
        router.push(response.editUrl);
      } else {
        setResult(response);
      }
    } catch {
      if (requestId.current === next) setResult({ ok: false, ready: false, issues: [{ section: "Intake", field: "Open onboarding draft", message: "The draft could not be opened. Try again from the standard Policy Intake Review page." }] });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  async function confirmTakeover() {
    if (!takeover || isWaiting || takeover.intakeId !== selectedId) return;
    const intakeId = takeover.intakeId;
    const next = ++requestId.current;
    setTakeover(null);
    setBusy("editing");
    try {
      // The server verifies the current assignment, duplicate status and
      // authorized reviewer/finalizer rights again before claiming anything.
      const response = await editSemiAutoIntake(intakeId, true);
      if (requestId.current !== next) return;
      if (response.ok && response.editUrl) {
        router.push(response.editUrl);
      } else {
        setResult(response);
      }
    } catch {
      if (requestId.current === next) setResult({
        ok: false, ready: false,
        issues: [{ section: "Intake", field: "Reviewer takeover", message: "Unable to take over and open this Intake. Recheck its assignment in the Policy Intake Review page." }],
      });
    } finally {
      if (requestId.current === next) setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(310px,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[#dce5f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7eef5] px-4 py-3">
          <div>
            <div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#2861a0]"/><h2 className="text-[13px] font-bold text-[#142e4c]">Existing Motor Policy Intakes</h2></div>
            <p className="mt-1 text-[10px] text-[#61738a]">Select one checkbox to assess its complete onboarding readiness. No booking happens on selection.</p>
          </div>
          <div className="relative w-full sm:w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#8090a6]"/>
            <input aria-label="Search displayed Intakes" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Search number, source, mobile" className="h-9 w-full rounded-lg border border-[#d9e3ee] bg-[#f9fbff] pl-9 pr-3 text-[11px] outline-none focus:border-[#456ba6]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full border-collapse text-left text-[10.5px]">
            <thead className="bg-[#f5f8fc] text-[9px] font-bold uppercase tracking-[.07em] text-[#62748e]">
              <tr><th className="w-10 px-3 py-3"><span className="sr-only">Select</span></th><th className="px-2 py-3">Intake</th><th className="px-3 py-3">Lead source</th><th className="px-3 py-3">Customer mobile</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">OCR</th><th className="px-3 py-3">Submitted</th></tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f5]">
              {visible.map(row => (
                <tr key={row.id} className={selectedId === row.id ? "bg-[#ebf4ff]" : "hover:bg-[#f9fbff]"}>
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={"Select " + row.intake_number} checked={selectedId === row.id} disabled={isWaiting && selectedId !== row.id}
                      onChange={() => { void selectRow(row.id); }} className="h-4 w-4 accent-[#215a9c]" />
                  </td>
                  <td className="whitespace-nowrap px-2 py-3">
                    <Link href={"/policy-intakes/" + row.id} className="font-bold text-[#20528f] hover:underline">{row.intake_number}</Link>
                    {row.assigned_to_profile_id && row.assigned_to_profile_id !== profileId ? <span className="ml-2 text-[9px] text-amber-700">Assigned</span> : null}
                  </td>
                  <td className="max-w-[210px] truncate px-3 py-3 text-[#344761]" title={row.lead_source_name}>{row.lead_source_name || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-3 tabular-nums text-[#334763]">{row.customer_mobile}</td>
                  <td className="whitespace-nowrap px-3 py-3"><span className="rounded-md bg-[#edf2fa] px-2 py-1 font-semibold text-[#3f5c82]">{humanStatus[row.status] || row.status}</span></td>
                  <td className="whitespace-nowrap px-3 py-3"><span className={row.ocr_status === "completed" ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{row.ocr_status === "completed" ? "Extracted" : row.ocr_status.replaceAll("_", " ")}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#62748e]">{compactDate(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <div className="p-7 text-center text-[12px] text-[#718197]">No Intake matches this filter on the current page.</div> : null}
        </div>
      </section>
      <section aria-live="polite" className="min-w-0 rounded-2xl border border-[#dce5f0] bg-white p-4">
        <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#4774c1]" /><h2 className="text-[13px] font-bold text-[#142e4c]">AI Booking Check</h2></div>
        {!selectedId ? <div className="mt-5 rounded-xl border border-dashed border-[#cddbea] p-5 text-center text-[11px] leading-5 text-[#63768e]">
          Select a checkbox in the Intake table to see exactly which fields are ready and which require correction.
        </div> : (
          <>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-[#f4f7fc] px-3 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#75859a]">Selected Intake</p>
                <p className="mt-1 text-[13px] font-bold text-[#183b68]">{selected?.intake_number ?? "Intake selected"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {n8nEnabled ? <button type="button" onClick={() => { void previewN8n(); }} disabled={isWaiting || Boolean(done)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#cbd9eb] bg-white px-2.5 text-[10px] font-semibold text-[#24518a] disabled:opacity-50">
                  {busy === "extracting" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <FileSearch className="h-3.5 w-3.5"/>}Preview n8n PDF
                </button> : null}
                <button type="button" onClick={() => { void retry(); }} disabled={isWaiting} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d0deef] bg-white px-2.5 text-[10px] font-semibold text-[#29558d] disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5"/>Recheck</button>
              </div>
            </div>
            {busy === "checking" ? <div className="mt-4 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Checking document, draft, duplicates, source and booking rules...</div> : null}
            {busy === "extracting" ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Reading current private PDF through the n8n review-only bridge...</div> : null}
            {busy === "applying" ? <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-[11px] text-blue-800"><Loader2 className="h-4 w-4 animate-spin"/>Revalidating and saving the confirmed failed OCR recovery...</div> : null}
            {n8nNotice ? <p role="status" className="mt-3 rounded-lg border border-[#c8d8eb] bg-[#f5f9ff] p-3 text-[11px] leading-5 text-[#284d77]">{n8nNotice}</p> : null}
            {n8nResult && !done ? (n8nResult.ok ? (
              <section aria-label="n8n extraction review" className="mt-3 rounded-xl border border-[#c8d8eb] bg-[#f8fbff] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-[#214f82]">n8n PDF extraction · Review only</p>
                  <span className="text-[10px] font-semibold text-[#3e648e]">{n8nResult.preview.fields.length} fields · {n8nResult.preview.changedFieldCount} new/different</span>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-[#5e7188]">
                  Compare each value with the original policy copy. Confidence scores are not available. This preview does not change the Intake, draft or booking state.
                </p>
                <div className="mt-2 max-h-[320px] overflow-auto rounded-lg border border-[#d9e5f1] bg-white">
                  <table className="w-full min-w-[320px] text-left text-[10px]">
                    <thead className="sticky top-0 bg-[#eaf2fc] text-[#2d5076]"><tr><th className="p-2">Field</th><th className="p-2">Extracted value</th><th className="p-2">Evidence</th></tr></thead>
                    <tbody className="divide-y divide-[#e7edf5]">{n8nResult.preview.fields.map(field => (
                      <tr key={field.key}>
                        <td className="p-2 font-semibold text-[#314864]">{field.label}</td>
                        <td className="break-words p-2 text-[#152b49]">{field.value}</td>
                        <td className="p-2 text-[#64748b]">p.{field.page ?? "?"} · {field.evidence}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {n8nResult.preview.warnings.length ? <p className="mt-2 text-[10px] text-amber-800">Warnings: {n8nResult.preview.warnings.join("; ")}</p> : null}
                {n8nResult.preview.canApply ? (
                  <button type="button" onClick={() => { void applyN8n(); }} disabled={isWaiting}
                    className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#acc8e2] bg-[#edf5ff] px-3 text-[10.5px] font-bold text-[#245489] disabled:opacity-50">
                    <CheckCircle2 className="h-3.5 w-3.5"/>Apply reviewed fields to failed OCR
                  </button>
                ) : <p className="mt-2 text-[10px] leading-4 text-[#60738b]">Read-only proposal. Applying n8n fields requires a separate enabled recovery gate and is limited to failed Intakes with no saved OCR or draft. Use Open &amp; correct fields for other cases.</p>}
              </section>
            ) : <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">{n8nResult.error}</p>) : null}
            {result && !done && (
              <>
                {available ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0"/>Pre-booking readiness checks passed. This is not a guarantee: the canonical booking transaction will perform its own live conflict and authorization checks.</div>
                  : <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{result.issues.length} issue(s) must be resolved or reviewed before semi-automatic booking.</div>}
                {result.issues.length > 0 && <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {result.issues.map((problem, index) => <div key={problem.section + problem.field + index} className="rounded-lg border border-[#f0d7ce] bg-[#fffaf8] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold text-[#8d3b26]"><ShieldAlert className="h-3.5 w-3.5"/>{problem.section} · {problem.field}</p>
                    <p className="mt-1 text-[10.5px] leading-5 text-[#685047]">{problem.message}</p>
                  </div>)}
                </div>}
              </>
            )}
            {done ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-[12px] font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Policy successfully registered</div>
              <p className="mt-2 text-[11px] text-emerald-900">Policy Code: <strong>{done.policyCode}</strong></p>
              <Link href={"/policies/" + done.policyId} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 underline">View registered policy <ArrowUpRight className="h-3.5 w-3.5"/></Link>
            </div> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => { void correct(); }} disabled={isWaiting || Boolean(done)}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#cbd9e9] bg-white px-3 text-[11px] font-semibold text-[#254f82] disabled:opacity-50">
                {busy === "editing" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <PencilLine className="h-3.5 w-3.5"/>}Open & correct fields
              </button>
              <button type="button" onClick={() => { void book(); }} disabled={isWaiting || !available || Boolean(done)}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#174b83] px-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {busy === "booking" ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <CheckCircle2 className="h-3.5 w-3.5"/>}Confirm & book
              </button>
            </div>
            <p className="mt-3 text-[9.5px] leading-4 text-[#7b8898]">Booking preserves existing duplicate, ownership, date-OTP and coverage safeguards. Missing insurer pay-in or partner payout rates are not guessed.</p>
          </>
        )}
      </section>
      {takeover ? (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-[#101d37]/60 px-4 py-6" role="presentation">
          <div role="alertdialog" aria-modal="true" aria-labelledby="semi-auto-takeover-title" aria-describedby="semi-auto-takeover-description"
            className="w-full max-w-[440px] rounded-2xl border border-[#d6e2f1] bg-white p-5 shadow-[0_24px_80px_rgba(12,28,52,.3)]">
            <h3 id="semi-auto-takeover-title" className="text-[15px] font-bold text-[#193657]">Take over this Policy Intake?</h3>
            <p id="semi-auto-takeover-description" className="mt-2 text-[12px] leading-5 text-[#52647b]">
              This Intake is currently assigned to <strong className="text-[#1b3a61]">{takeover.reviewerName}</strong>.
              Choosing <strong>Take over &amp; open</strong> changes its assigned Operations reviewer to you,
              then opens the existing Policy Onboarding draft for correction. No policy will be booked.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" autoFocus onClick={() => setTakeover(null)}
                className="min-h-10 rounded-lg border border-[#cbd6e5] bg-white px-4 text-[11px] font-semibold text-[#38516e]">
                Cancel
              </button>
              <button type="button" onClick={() => { void confirmTakeover(); }}
                className="min-h-10 rounded-lg bg-[#174b83] px-4 text-[11px] font-bold text-white">
                Take over &amp; open
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
