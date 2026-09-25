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

type RunProgress = {
  current: number;
  total: number;
  failed: number;
};

const TEST_SIZE = 5;
const CLIENT_PROVIDER_SPACING_MS = 1_600;
const MAX_CONSECUTIVE_REQUEST_FAILURES = 3;
const TERMINAL = new Set<LookupStatus>(["success", "no_data"]);
const FAILED = new Set<LookupStatus>(["provider_error", "request_error"]);
const LOOKUP_STATUSES = new Set<LookupStatus>(["success", "no_data", "invalid", "provider_error", "request_error"]);
const AUTHBRIDGE_STATUS_HEADER = "authbridgelookupstatus";
const METADATA_HEADERS = [
  "AuthBridge Lookup Status",
  "AuthBridge Source",
  "AuthBridge Provider Code",
  "AuthBridge Message",
  "AuthBridge Transaction ID",
  "AuthBridge Looked Up At",
] as const;

export default function AuthbridgeRcEnrichmentClient() {
  const stopRequestedRef = useRef(false);
  const [loaded, setLoaded] = useState<LoadedSheet | null>(null);
  const [results, setResults] = useState<Record<string, LookupResult>>({});
  const [running, setRunning] = useState<"test" | "all" | "failed" | null>(null);
  const [message, setMessage] = useState<string>("");
  const [testPassed, setTestPassed] = useState(false);
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null);

  const counts = useMemo(() => {
    const values = Object.values(results);
    return {
      processed: values.filter((item) => TERMINAL.has(item.status)).length,
      success: values.filter((item) => item.status === "success").length,
      noData: values.filter((item) => item.status === "no_data").length,
      failed: values.filter((item) => FAILED.has(item.status)).length,
      cache: values.filter((item) => item.source === "cache").length,
    };
  }, [results]);

  async function handleFile(file: File | null) {
    stopRequestedRef.current = false;
    setMessage("");
    setResults({});
    setTestPassed(false);
    setLoaded(null);
    setRunProgress(null);
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("The workbook does not contain a worksheet.");
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "", raw: false });
      if (!rawRows.length) throw new Error("The first worksheet is empty.");

      const rawHeaders = rawRows[0].map((value) => normalizeHeader(value));
      const enrichmentStarts = rawHeaders.reduce<number[]>((indexes, header, index) => {
        if (header === AUTHBRIDGE_STATUS_HEADER) indexes.push(index);
        return indexes;
      }, []);
      const sourceWidth = enrichmentStarts[0] ?? Math.max(...rawRows.map((row) => row.length), 1);
      const rows = rawRows.map((row) => row.slice(0, sourceWidth));
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

      const restoredResults = restoreExistingResults(rawRows, enrichmentStarts, registrationColumn);
      const restoredCount = Object.keys(restoredResults).length;
      setResults(restoredResults);
      setLoaded({ fileName: file.name, rows, registrationColumn, validUnique, invalidRowCount, duplicateRowCount });
      setMessage(
        `Loaded ${rows.length - 1} rows with ${validUnique.length} unique supported registration numbers.` +
        (restoredCount
          ? ` Restored ${restoredCount.toLocaleString("en-IN")} saved AuthBridge result${restoredCount === 1 ? "" : "s"}${enrichmentStarts.length > 1 ? ` from ${enrichmentStarts.length} historical enrichment blocks` : ""}. Future downloads will contain one canonical AuthBridge block.`
          : ""),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the workbook.");
    }
  }

  async function runTest() {
    if (!loaded || running) return;
    const sample = loaded.validUnique.slice(0, TEST_SIZE);
    if (!sample.length) return;
    stopRequestedRef.current = false;
    setRunning("test");
    setRunProgress({ current: 0, total: sample.length, failed: 0 });
    setMessage(`Running a controlled ${sample.length}-vehicle AuthBridge test...`);

    let failed = 0;
    try {
      for (let index = 0; index < sample.length; index += 1) {
        if (stopRequestedRef.current) {
          setTestPassed(false);
          setMessage(`Test stopped by user after ${index.toLocaleString("en-IN")} of ${sample.length.toLocaleString("en-IN")} RCs. Completed RCs are retained.`);
          return;
        }

        const registrationNumber = sample[index];
        const result = await lookupOneSafely(registrationNumber);
        mergeResults([result]);
        if (FAILED.has(result.status)) failed += 1;
        const current = index + 1;
        setRunProgress({ current, total: sample.length, failed });

        if (stopRequestedRef.current) {
          setTestPassed(false);
          setMessage(`Test stopped by user after ${current.toLocaleString("en-IN")} of ${sample.length.toLocaleString("en-IN")} RCs. Completed RCs are retained.`);
          return;
        }

        if (index < sample.length - 1 && result.source === "authbridge") {
          await sleep(CLIENT_PROVIDER_SPACING_MS);
        }
      }

      setTestPassed(failed === 0);
      setMessage(
        failed > 0
          ? `The test completed with ${failed} AuthBridge/provider error${failed === 1 ? "" : "s"}. Full processing remains locked until the test is clean.`
          : "Controlled test completed cleanly. Review the counts, then Run All Remaining when ready.",
      );
    } catch (error) {
      setTestPassed(false);
      setMessage(error instanceof Error ? error.message : "The test batch failed.");
    } finally {
      stopRequestedRef.current = false;
      setRunning(null);
      setRunProgress(null);
    }
  }

  async function runAll(mode: "remaining" | "failed" = "remaining") {
    if (!loaded || running || !testPassed) return;

    const candidates = loaded.validUnique.filter((registrationNumber) => {
      const result = results[registrationNumber];
      if (mode === "failed") return Boolean(result && FAILED.has(result.status));
      return !result || !TERMINAL.has(result.status);
    });

    if (!candidates.length) {
      setMessage(mode === "failed" ? "There are no failed RC lookups to retry." : "All supported RCs are already processed.");
      return;
    }

    stopRequestedRef.current = false;
    setRunning(mode === "failed" ? "failed" : "all");
    setRunProgress({ current: 0, total: candidates.length, failed: 0 });
    setMessage(
      mode === "failed"
        ? `Retrying ${candidates.length.toLocaleString("en-IN")} failed RC lookup${candidates.length === 1 ? "" : "s"}...`
        : `Bulk enrichment is running for ${candidates.length.toLocaleString("en-IN")} RCs. Keep this tab open; completed vehicles are cached and the run will continue past individual RC errors.`,
    );

    let failedThisRun = 0;
    let consecutiveRequestFailures = 0;

    try {
      for (let index = 0; index < candidates.length; index += 1) {
        if (stopRequestedRef.current) {
          setMessage(`Fetching stopped by user after ${index.toLocaleString("en-IN")} of ${candidates.length.toLocaleString("en-IN")} RCs in this pass. Completed RCs are retained; use Run all remaining to continue later.`);
          return;
        }

        const registrationNumber = candidates[index];
        const result = await lookupOneSafely(registrationNumber);
        mergeResults([result]);

        if (FAILED.has(result.status)) failedThisRun += 1;
        consecutiveRequestFailures = result.status === "request_error" ? consecutiveRequestFailures + 1 : 0;

        const current = index + 1;
        setRunProgress({ current, total: candidates.length, failed: failedThisRun });

        if (stopRequestedRef.current) {
          setMessage(`Fetching stopped by user after ${current.toLocaleString("en-IN")} of ${candidates.length.toLocaleString("en-IN")} RCs in this pass. The RC already in progress was allowed to finish safely. Completed RCs are retained; use Run all remaining to continue later.`);
          return;
        }

        setMessage(
          `Bulk enrichment running: ${current.toLocaleString("en-IN")} of ${candidates.length.toLocaleString("en-IN")} attempted this pass${failedThisRun ? `; ${failedThisRun.toLocaleString("en-IN")} need retry` : ""}.`,
        );

        if (consecutiveRequestFailures >= MAX_CONSECUTIVE_REQUEST_FAILURES && current < candidates.length) {
          setMessage(
            `Bulk processing paused after ${MAX_CONSECUTIVE_REQUEST_FAILURES} consecutive gateway/transport failures to avoid repeatedly calling an unhealthy service. Completed RCs are retained; retry the failed/remaining RCs after the gateway recovers.`,
          );
          return;
        }

        if (current < candidates.length && result.source === "authbridge") {
          await sleep(CLIENT_PROVIDER_SPACING_MS);
        }
      }

      setMessage(
        failedThisRun > 0
          ? `Bulk pass completed. ${failedThisRun.toLocaleString("en-IN")} RC lookup${failedThisRun === 1 ? "" : "s"} failed while the rest continued automatically. Use Retry Failed Only to retry them without reprocessing successful RCs.`
          : "Bulk processing completed. Download the enriched workbook.",
      );
    } finally {
      stopRequestedRef.current = false;
      setRunning(null);
      setRunProgress(null);
    }
  }

  function requestStop() {
    if (!running) return;
    stopRequestedRef.current = true;
    setMessage("Stop requested. The RC currently in progress will finish safely, then fetching will pause before the next RC.");
  }

  async function lookupOneSafely(registrationNumber: string): Promise<LookupResult> {
    try {
      const batch = await lookupBatch([registrationNumber]);
      return batch[0] ?? requestErrorResult(registrationNumber, "The bulk RC endpoint returned no result for this vehicle.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk RC request failed.";
      if (/HTTP (401|403)|Unauthorized|development access/i.test(message)) throw error;
      return requestErrorResult(registrationNumber, message);
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${body.error || "Bulk RC request failed."}`);
    }
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
    if (!loaded) return;
    const fieldHeaders = [...new Set(
      Object.values(results).flatMap((result) => Object.keys(result.fields ?? {})),
    )].sort((a, b) => a.localeCompare(b));
    const originalWidth = Math.max(...loaded.rows.map((row) => row.length), 1);
    const outputRows = loaded.rows.map((sourceRow, rowIndex) => {
      const row = [...sourceRow];
      while (row.length < originalWidth) row.push("");
      if (rowIndex === 0) return [...row, ...METADATA_HEADERS, ...fieldHeaders];

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
    XLSX.writeFile(output, `${baseWorkbookName(loaded.fileName)} - AuthBridge enriched.xlsx`, { compression: true });
  }

  const progressText = runProgress
    ? `${runProgress.current.toLocaleString("en-IN")} / ${runProgress.total.toLocaleString("en-IN")}`
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-5 py-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Internal operations tool</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">AuthBridge RC bulk enrichment</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Upload the vehicle workbook, run a five-vehicle validation test first, then process all remaining unique RCs continuously. Individual RC errors are retained for retry and do not stop the rest of the run.
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
            {running === "test" ? `Testing${progressText ? ` ${progressText}` : ""}…` : "Run 5-vehicle test"}
          </button>
          <button
            type="button"
            disabled={!loaded || Boolean(running) || !testPassed}
            onClick={() => void runAll("remaining")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running === "all" ? `Processing ${progressText ?? ""}…` : "Run all remaining"}
          </button>
          {counts.failed > 0 ? (
            <button
              type="button"
              disabled={!loaded || Boolean(running) || !testPassed}
              onClick={() => void runAll("failed")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {running === "failed" ? `Retrying ${progressText ?? ""}…` : `Retry failed only (${counts.failed.toLocaleString("en-IN")})`}
            </button>
          ) : null}
          {running ? (
            <button
              type="button"
              onClick={requestStop}
              className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Stop fetching
            </button>
          ) : null}
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
        Full processing remains locked until the five-vehicle test completes cleanly. Success and billable no-data responses are cached; isolated provider errors no longer stop the remaining RCs, while repeated gateway/transport failures pause the run after three consecutive failures. Stop fetching finishes the RC already in progress, then pauses before the next RC so completed work remains safely resumable.
      </p>
    </main>
  );
}

function restoreExistingResults(rows: unknown[][], enrichmentStarts: number[], registrationColumn: number) {
  const restored: Record<string, LookupResult> = {};
  if (!enrichmentStarts.length) return restored;
  const headerRow = rows[0] ?? [];

  for (const row of rows.slice(1)) {
    const registrationNumber = normalizeRegistration(row[registrationColumn]);
    if (!isValidRegistration(registrationNumber)) continue;

    for (let blockIndex = enrichmentStarts.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const start = enrichmentStarts[blockIndex];
      const end = enrichmentStarts[blockIndex + 1] ?? Math.max(headerRow.length, row.length);
      const statusCandidate = String(row[start] ?? "").trim() as LookupStatus;
      if (!LOOKUP_STATUSES.has(statusCandidate)) continue;

      const sourceCandidate = String(row[start + 1] ?? "").trim();
      const source: LookupResult["source"] = sourceCandidate === "cache" || sourceCandidate === "validation"
        ? sourceCandidate
        : "authbridge";
      const providerCodeValue = String(row[start + 2] ?? "").trim();
      const parsedProviderCode = providerCodeValue ? Number(providerCodeValue) : null;
      const fields: LookupResult["fields"] = {};

      for (let column = start + METADATA_HEADERS.length; column < end; column += 1) {
        const header = String(headerRow[column] ?? "").trim();
        const value = row[column];
        if (!header || value === "" || value === null || value === undefined) continue;
        fields[header] = typeof value === "string" || typeof value === "number" || typeof value === "boolean"
          ? value
          : String(value);
      }

      restored[registrationNumber] = {
        registrationNumber,
        status: statusCandidate,
        source,
        providerCode: parsedProviderCode !== null && Number.isFinite(parsedProviderCode) ? parsedProviderCode : null,
        message: nullableCell(row[start + 3]),
        transactionId: nullableCell(row[start + 4]),
        lookedUpAt: nullableCell(row[start + 5]),
        fields,
      };
      break;
    }
  }

  return restored;
}

function requestErrorResult(registrationNumber: string, message: string): LookupResult {
  return {
    registrationNumber,
    status: "request_error",
    source: "authbridge",
    providerCode: null,
    message: message.slice(0, 300),
    transactionId: null,
    lookedUpAt: null,
    fields: {},
  };
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

function nullableCell(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function stripExtension(value: string) {
  return value.replace(/\.(xlsx|xls)$/i, "");
}

function baseWorkbookName(value: string) {
  return stripExtension(value).split(/\s+-\s+AuthBridge\b/i)[0].trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
