"use client";

import { useState } from "react";

type Field = { key: string; label: string; value: string; evidence: string };
type Review = {
  ok: true; supportedInsurer: string; parserAccepted: boolean; reviewOnly: true;
  policyBooked: false; fields: Field[]; checks: Record<string, boolean>;
  warnings: string[]; premium: Record<string, number | null>;
};
type ErrorResult = { ok: false; error: string };
type Result = Review | ErrorResult;

export function NonTataParserTestPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    if (!file || processing) return;
    setProcessing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/policies/non-tata-parser-test", {
        method: "POST", body: form, cache: "no-store", credentials: "same-origin",
      });
      const parsed: Result = await response.json().catch(() => ({ ok: false, error: "Unexpected server response." }));
      setResult(parsed);
    } catch {
      setResult({ ok: false, error: "Unable to reach the isolated PDF reader." });
    } finally { setProcessing(false); }
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5 py-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Non-Tata commercial policy parser test</h2>
        <p className="mt-2 text-sm text-slate-600">
          Only New India Assurance, IFFCO Tokio and Go Digit commercial vehicle PDFs.
          This reads a file through an isolated local n8n workflow; it never creates
          a customer, Intake or policy, updates a saved draft, or touches Tata AIG training.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="nontata-policy-pdf" className="text-sm font-medium text-slate-700">Policy PDF</label>
          <input id="nontata-policy-pdf" type="file" accept=".pdf,application/pdf"
            className="max-w-full text-sm" onChange={event => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
            }} />
          <button type="button" disabled={!file || processing} onClick={submit}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {processing ? "Reading PDF..." : "Test local n8n parser"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Digital text PDFs up to 4 MB. All results require a human review before onboarding.</p>
      </section>
      {result && (!result.ok
        ? <div role="alert" className="rounded-lg border border-red-200 bg-white p-4 text-sm text-red-700">{result.error}</div>
        : <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-base font-semibold text-slate-900">Extraction result — review only</h3>
            <p className="mt-1 text-sm text-slate-600">
              {result.parserAccepted ? "Printed checks passed. Manual review is still mandatory." :
                "Some verification checks failed. Inspect the missing fields and warnings below."}
            </p>
            <p className="mt-2 text-xs text-slate-500">Insurer parser: {result.supportedInsurer}. No policy was booked.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {(["od","tp","net","gst","gross"] as const).map(key =>
                <div key={key} className="rounded border border-slate-200 p-3">
                  <div className="text-xs uppercase text-slate-500">{key}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {typeof result.premium[key] === "number"
                      ? "₹" + result.premium[key].toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})
                      : "Not verified"}
                  </div>
                </div>)}
            </div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Extracted fields</h3>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {result.fields.map(field => <div key={field.key} className="border-b border-slate-100 pb-2">
                <dt className="text-xs text-slate-500">{field.label.replace(/_/g, " ")}</dt>
                <dd className="mt-1 break-all text-sm font-medium text-slate-900">{field.value}</dd>
              </div>)}
            </dl>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold">Verification checks</h3>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(result.checks).map(([key,passed]) =>
                <li key={key} className="text-sm text-slate-700">
                  <span className={passed ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                    {passed ? "PASS" : "REVIEW"}
                  </span> — {key.replace(/_/g," ")}
                </li>)}
            </ul>
            {!!result.warnings.length && <>
              <h4 className="mt-4 text-sm font-semibold">Items needing review</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                {result.warnings.map((warning,i)=><li key={i}>{warning}</li>)}
              </ul>
            </>}
          </section>
        </>)}
    </div>
  );
}
