"use client";

import { FilePenLine } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replaceSpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

export function ReplaceDocumentButton({ claimId, customerId, documentType, label, actionLabel = "Replace" }: { claimId: string; customerId: string; documentType: string; label: string; actionLabel?: "Upload" | "Replace" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const previewUrl = useMemo(() => selectedFile && selectedFile.type.startsWith("image/") ? URL.createObjectURL(selectedFile) : null, [selectedFile]);
  const isReplaceAction = actionLabel === "Replace";

  return (
    <>
      <button
        type="button"
        onClick={() => { setResult(null); setOpen(true); }}
        {...(isReplaceAction ? { "data-document-action": "replace", "aria-label": "Replace document", title: "Replace document" } : {})}
        className={isReplaceAction
          ? "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#D15B5B] bg-white text-[#C43D3D] transition hover:bg-[#FFF5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D15B5B]/30"
          : "h-8 rounded-md border border-[#D15B5B] bg-white px-2 text-[12px] font-semibold text-[#C43D3D] transition hover:bg-[#FFF5F5]"}
      >
        {isReplaceAction ? <FilePenLine aria-hidden="true" size={16} strokeWidth={2} /> : actionLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <form
            ref={formRef}
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const response = await replaceSpotSurveyDocument(formData);
                setResult(response);
                if (response.ok) {
                  setSelectedFile(null);
                  setOpen(false);
                  // Keep the modal responsive while the authoritative row refreshes.
                  setTimeout(() => router.refresh(), 0);
                }
              });
            }}
            className="w-full max-w-[520px] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          >
            <input type="hidden" name="claimId" value={claimId} />
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="documentType" value={documentType} />

            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[28px]">📄</div>
                <div>
                  <h2 className="text-[18px] font-semibold leading-tight text-[#071D49]">Upload Valid {label}</h2>
                  <p className="mt-2 max-w-[330px] text-[12px] leading-5 text-[#4B596B]">Please upload clear and valid {label}.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="space-y-4 px-5 pb-5">
              <label className="grid min-h-[140px] cursor-pointer place-items-center rounded-xl border border-dashed border-[#8BA0BC] bg-[#F8FBFF] px-4 text-center transition hover:border-[#174EA6]">
                <input
                  name="file"
                  type="file"
                  accept={documentType.toLowerCase().includes("video") ? "video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,.mp4,.mov,.webm,.mkv,.avi" : "image/jpeg,image/png,image/webp,application/pdf"}
                  className="hidden"
                  required
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <span>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF3FF] text-[30px] text-[#174EA6]">☁</span>
                  <span className="mt-2 block text-[13px] font-semibold text-[#071D49]">Drag &amp; drop file here</span>
                  <span className="block text-[12px] text-[#68758A]">or</span>
                  <span className="mt-1 inline-flex h-8 items-center rounded-md bg-[#071D49] px-5 text-[12px] font-semibold text-white">Select File</span>
                  <span className="mt-2 block text-[10px] text-[#68758A]">{documentType.toLowerCase().includes("video") ? "Supported formats: MP4, MOV, WEBM, MKV, AVI (Max size 50MB)" : "Supported formats: JPG, PNG, PDF (Max size 5MB)"}</span>
                </span>
              </label>

              <div>
                <p className="text-[13px] font-semibold text-[#071D49]">Selected File</p>
                {selectedFile ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-[#DCE7F5] bg-white">
                        {previewUrl ? (
                          // Blob URLs are local, short-lived previews and cannot use the Next image optimizer.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={previewUrl} alt="Selected file preview" className="h-full w-full object-cover" />
                        ) : <span className="text-[24px]">📄</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#071D49]">{selectedFile.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#68758A]">{formatSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[22px] text-[#139657]">●</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="text-[20px] text-[#D33D3D]">♜</button>
                    </div>
                  </div>
                ) : <p className="mt-2 rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] px-3 py-3 text-[12px] text-[#8B98A9]">No file selected.</p>}
              </div>
              {result ? <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? "Upload completed." : "Upload failed.")}</p> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-5 py-4">
              <button type="button" onClick={() => { setSelectedFile(null); setResult(null); setOpen(false); }} className="h-10 rounded-md border border-[#B8C5D6] px-8 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={!selectedFile || isPending || Boolean(result?.ok)} className="h-10 rounded-md bg-[#071D49] px-10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">{isPending ? "Uploading..." : "Upload"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
