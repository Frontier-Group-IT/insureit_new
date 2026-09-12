"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type LookupStatus = "success" | "no_data" | "invalid" | "provider_error" | "request_error";
type LookupResult = {
  registrationNumber: string;
  status: LookupStatus;
  source: "cache" | "authbridge" | "validation";
  providerCode: number | null;
  message: string | null;
  transactionId: string | null;
  lookedUpAt: string | null;
  fields: Record<string, string | number | boolean | null>;
};

type LoadedSheet = {
  fileName: string;
  rows: unknown[][];
  registrationColumn: number;
  validUnique: string[];
  invalidRowCount: number;
  duplicateRowCount: number;
};

const BATCH_SIZE = 5;
const TERMINAL = new Set<LookupStatus>(["success", "no_data"]);

export default function AuthbridgeRcEnrichmentClient() {
  const workbookRef = useRef<XLSX.WorkBook | null>(null);
  const [loaded, setLoaded] = useState<LoadedSheet | null>(null);
  const [results, setResults] = useState<Record<string, LookupResult>>({});
  const [running, setRunning] = useState<"test" | "all" | null>(null);
  const [message, setMessage] = useState<string>("");
  const [testPassed, setTestPassed] = useState(false);

  const counts = useMemo(() => {
    const values = Object.values(results);
    return {
      processed: values.filter((item) => TERMINAL.has(item.status)).length,
      success: values.filter((item) => item.status === "success").length,
      noData: values.filter((item) => item.status === "no_data").length,
      failed: values.filter((item) => item.status === "provider_error" || item.status === "request_error").length,
      cache: values.filter((item) => item.source === "cache").length,
    };
  }, [results]);

  async function handleFile(file: File | null) {
    setMessage("");
    setResults({});
    setTestPassed(false);
    setLoaded(null);
    workbookRef.current = null;
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("The workbook does not contain a worksheet.");
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
      if (!rows.length) throw new Error("The first worksheet is empty.");

      const headers = rows[0].map((value) => normalizeHeader(value));
      const registrationColumn = headers.findIndex((header) =>
        ["registrationnumber", "vehiclerc", "rcnumber", "vehicleregistrationnumber"].includes(header),
      );
      if (registrationColumn < 0) throw new Error("Registration Number / VEHICLE-RC column was not found.");

      const seen = new Set<string>();
      const validUnique: string[] = [];
      let invalidRowCount = 0;
      let duplicateRowCount = 0;
      for (const row of rows.slice(1)) {
        const rc = normalizeRegistration(row[registrationColumn]);
        if (!isValidRegistration(rc)) {
          invalidRowCount += 1;
          continue;
        }
        if (seen.has(rc)) {
          duplicateRowCount += 1;
          continue;
        }
        seen.add(rc);
        validUnique.push(rc);
      }

      workbookRef.current = workbook;
      setLoaded({ fileName: file.name, rows, registrationColumn, validUnique, invalidRowCount, duplicateRowCount });
      setMessage(`Loaded ${rows.length - 1} rows with ${validUnique.length} unique supported registration numbers.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the workbook.");
    }
  }

  async function runTest() {
    if (!loaded || running) return;
    const sample = loaded.validUnique.slice(0, BATCH_SIZE);
    if (!sample.length) return;
    setRunning("test");
    setMessage(`Running a controlled ${sample.length}-vehicle AuthBridge test...`);
    try {
      const batch = await lookupBatch(sample);
      mergeResults(batch);
      const hasTransportOrProviderFailure = batch.some((item) => item.status === "request_error" || item.status === "provider_error");
      setTestPassed(!hasTransportOrProviderFailure && batch.length === sample.length);
      setMessage(
        hasTransportOrProviderFailure
          ? "The test found an AuthBridge/provider error. Full processing remains locked until the test is clean."
          : "Controlled test completed cleanly. Review the counts, then Run All when ready.",
      );
    } catch (error) {
      setTestPassed(false);
      setMessage(error instanceof Error ? error.message : "The test batch failed.");
    } finally {
      setRunning(null);
    }
  }

  async function runAll() {
    if (!loaded || running || !testPassed) return;
    setRunning("all");
    setMessage("Bulk enrichment is running. Keep this tab open; completed vehicles are cached and can be resumed safely.");
    try {
      const alreadyTerminal = new Set(
        Object.values(results).filter((item) => TERMINAL.has(item.status)).map((item) => item.registrationNumber),
      );
      const pending = loaded.validUnique.filter((registrationNumber) => !alreadyTerminal.has(registrationNumber));
      for (let index = 0; index < pending.length; index += BATCH_SIZE) {
        const batchNumbers = pending.slice(index, index + BATCH_SIZE);
        const batch = await lookupBatch(batchNumbers);
        mergeResults(batch);
        const hardFailure = batch.some((item) => item.status === "provider_error" || item.status === "request_error");
        if (hardFailure) {
          setMessage("Bulk processing paused after an API/provider error. Successful vehicles are retained; use Run All again to retry remaining vehicles.");
          return;
        }
      }
      setMessage("Bulk processing completed. Download the enriched workbook.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk processing stopped unexpectedly. Completed vehicles remain retained.");
    } finally {
      setRunning(null);
    }
  }

  async function lookupBatch(registrationNumbers: string[]) {
    const response = await fetch("/api/internal/authbridge-rc-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ registrationNumbers }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string; results?: LookupResult[] };
    if (!response.ok) throw new Error(body.error || `Bulk RC endpoint returned HTTP ${response.status}.`);
    return Array.isArray(body.results) ? body.results : [];
  }

  function mergeResults(batch: LookupResult[]) {
    setResults((current) => {
      const next = { ...current };
      for (const result of batch) next[result.registrationNumber] = result;
      return next;
    });
  }

  function downloadEnrichedWorkbook() {
    if (!loaded || !workbookRef.current) return;
    const fieldHeaders = [...new Set(
      Object.values(results).flatMap((result) => Object.keys(result.fields ?? {})),
    )].sort((a, b) => a.localeCompare(b));
    const metadataHeaders = [
      "AuthBridge Lookup Status",
      "AuthBridge Source",
      "AuthBridge Provider Code",
      "AuthBridge Message",
      "AuthBridge Transaction ID",
      "AuthBridge Looked Up At",
    ];
    const originalWidth = Math.max(...loaded.rows.map((row) => row.length), 1);
    const outputRows = loaded.rows.map((sourceRow, rowIndex) => {
      const row = [...sourceRow];
      while (row.length < originalWidth) row.push("");
      if (rowIndex === 0) return [...row, ...metadataHeaders, ...fieldHeaders];

      const rc = normalizeRegistration(row[loaded.registrationColumn]);
      if (!isValidRegistration(rc)) {
        return [...row, "skipped_invalid", "validation", "", "Invalid/non-RC value", "", "", ...fieldHeaders.map(() => "")];
      }
      const result = results[rc];
      if (!result) return [...row, "not_processed", "", "", "", "", "", ...fieldHeaders.map(() => "")];
      return [
        ...row,
        result.status,
        result.source,
        result.providerCode ?? "",
        result.message ?? "",
        result.transactionId ?? "",
        result.lookedUpAt ?? "",
        ...fieldHeaders.map((header) => result.fields?.[header] ?? ""),
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet(outputRows);
    worksheet["!cols"] = outputRows[0].map((value, index) => ({ wch: Math.min(Math.max(String(value ?? "").length + 2, index < originalWidth ? 14 : 18), 42) }));
    const output = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(output, worksheet, "AuthBridge Enriched");
    XLSX.writeFile(output, `${stripExtension(loaded.fileName)} - AuthBridge enriched.xlsx`, { compression: true });
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-5 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Internal operations tool</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">AuthBridge RC bulk enrichment</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Upload the vehicle workbook, run a five-vehicle validation batch first, then process the remaining unique RCs. Provider payload values are not displayed on this page; they are written only to the downloaded workbook and the protected RC cache.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-800" htmlFor="authbridge-workbook">Vehicle workbook (.xlsx)</label>
        <input
          id="authbridge-workbook"
          type="file"
          accept=".xlsx,.xls"
          disabled={Boolean(running)}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          className="mt-3 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        {loaded ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Rows" value={loaded.rows.length - 1} />
            <Stat label="Unique supported RCs" value={loaded.validUnique.length} />
            <Stat label="Duplicate rows" value={loaded.duplicateRowCount} />
            <Stat label="Invalid / non-RC rows" value={loaded.invalidRowCount} />
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="Processed" value={counts.processed} />
          <Stat label="Success" value={counts.success} />
          <Stat label="No data" value={counts.noData} />
          <Stat label="Errors" value={counts.failed} />
          <Stat label="Served from cache" value={counts.cache} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!loaded || Boolean(running)}
            onClick={() => void runTest()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running === "test" ? "Testing…" : "Run 5-vehicle test"}
          </button>
          <button
            type="button"
            disabled={!loaded || Boolean(running) || !testPassed}
            onClick={() => void runAll()}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running === "all" ? "Processing…" : "Run all remaining"}
          </button>
          <button
            type="button"
            disabled={!loaded || !Object.keys(results).length || Boolean(running)}
            onClick={downloadEnrichedWorkbook}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download enriched Excel
          </button>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-600" aria-live="polite">{message}</p> : null}
      </section>

      <p className="text-xs text-slate-500">
        Full processing is intentionally locked until the five-vehicle test completes without transport/provider errors. Billable no-data responses are treated as terminal and cached to avoid unnecessary repeat calls.
      </p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-950">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRegistration(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidRegistration(value: string) {
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(value) || /^\d{2}BH\d{4}[A-HJ-NP-Z]{1,2}$/.test(value);
}

function stripExtension(value: string) {
  return value.replace(/\.(xlsx|xls)$/i, "");
}
