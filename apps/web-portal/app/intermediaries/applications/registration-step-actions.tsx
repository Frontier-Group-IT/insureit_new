"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  applicationId: string;
  signedUploaded: boolean;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function RegistrationStepActions({ applicationId, signedUploaded }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloadedAt, setDownloadedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<"download" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/intermediary-registration/downloaded?application_id=${encodeURIComponent(applicationId)}`, { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((result: { downloaded_at?: string | null }) => setDownloadedAt(result.downloaded_at ?? null))
      .catch(() => undefined);
  }, [applicationId]);

  async function downloadRegistrationForm() {
    setError(null);
    setBusy("download");
    try {
      const registrationSection = document.getElementById("registration-requirement");
      const downloadButton = Array.from(registrationSection?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent?.trim() === "Download PDF");
      if (!downloadButton) throw new Error("Registration PDF is not available yet.");
      downloadButton.click();

      const response = await fetch("/api/intermediary-registration/downloaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId }),
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => null) as { ok?: boolean; downloaded_at?: string; message?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Download could not be recorded.");
      setDownloadedAt(result.downloaded_at ?? new Date().toISOString());
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Registration form could not be downloaded.");
    } finally {
      setBusy(null);
    }
  }

  async function uploadSignedForm(file: File) {
    setError(null);
    if (!downloadedAt) {
      setError("Download the registration form before uploading the signed copy.");
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Signed registration form must be 4 MB or smaller.");
      return;
    }

    setBusy("upload");
    try {
      const data = new FormData();
      data.set("application_id", applicationId);
      data.set("file", file, file.name);
      const response = await fetch("/api/intermediary-registration/signed", { method: "POST", body: data, credentials: "same-origin", cache: "no-store" });
      const result = await response.json().catch(() => null) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Signed registration form could not be uploaded.");
      router.replace(`/intermediaries/applications/${applicationId}/workflow?stage=training&success=registration_completed`);
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Signed registration form could not be uploaded.");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-[#DCE5EF] bg-[#F8FAFC] p-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={`rounded-xl border p-4 ${downloadedAt ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <p className="text-[10.5px] font-semibold text-[#0F172A]">1. Download registration form</p>
          <p className="mt-1 text-[9px] text-[#64748B]">Download the generated form, print it and obtain the required signatures.</p>
          <button type="button" onClick={downloadRegistrationForm} disabled={busy !== null} className="mt-3 rounded-lg bg-[#071D49] px-3 py-2 text-[9.5px] font-semibold text-white disabled:opacity-50">{busy === "download" ? "Preparing…" : downloadedAt ? "Download again" : "Download registration form"}</button>
          {downloadedAt ? <p className="mt-2 text-[8.5px] font-semibold text-emerald-700">✓ Download recorded</p> : null}
        </div>

        <div className={`rounded-xl border p-4 ${signedUploaded ? "border-emerald-200 bg-emerald-50" : downloadedAt ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white opacity-70"}`}>
          <p className="text-[10.5px] font-semibold text-[#0F172A]">2. Upload signed registration form</p>
          <p className="mt-1 text-[9px] text-[#64748B]">Upload the complete signed copy. Training unlocks only after this upload.</p>
          {signedUploaded ? <p className="mt-3 text-[9.5px] font-semibold text-emerald-700">✓ Signed registration form uploaded</p> : <>
            <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" disabled={!downloadedAt || busy !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadSignedForm(file); }} className="mt-3 block w-full text-[9px] disabled:cursor-not-allowed" />
            {!downloadedAt ? <p className="mt-2 text-[8.5px] font-semibold text-amber-700">Download is required first.</p> : busy === "upload" ? <p className="mt-2 text-[8.5px] font-semibold text-blue-700">Uploading signed form…</p> : null}
          </>}
        </div>
      </div>
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[9px] font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
