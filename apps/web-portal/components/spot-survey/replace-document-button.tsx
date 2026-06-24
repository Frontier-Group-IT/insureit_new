"use client";

import { useRef, useState, useTransition } from "react";
import { replaceSpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";

export function ReplaceDocumentButton({ claimId, customerId, documentType, label }: { claimId: string; customerId: string; documentType: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-md border border-[#D15B5B] bg-white px-2 text-[12px] font-semibold text-[#C43D3D] transition hover:bg-[#FFF5F5]">Replace</button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/45 px-4 backdrop-blur-[1px]">
          <form
            ref={formRef}
            action={(formData) => {
              startTransition(async () => {
                await replaceSpotSurveyDocument(formData);
                setSelectedFile(null);
                setOpen(false);
              });
            }}
            className="w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(7,29,73,0.25)]"
          >
            <input type="hidden" name="claimId" value={claimId} />
            <input type="hidden" name="customerId" value={customerId} />
            <input type="hidden" name="documentType" value={documentType} />

            <div className="flex items-start justify-between gap-4 border-b border-[#E6EEF7] px-6 py-5">
              <div>
                <h2 className="text-[20px] font-semibold text-[#071D49]">Upload Valid {label}</h2>
                <p className="mt-1 text-[13px] leading-5 text-[#4B596B]">Upload a clear and valid replacement file.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <label className="grid min-h-[160px] cursor-pointer place-items-center rounded-xl border border-dashed border-[#8BA0BC] bg-[#F8FBFF] px-4 text-center transition hover:border-[#174EA6]">
                <input
                  name="file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  required
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <span>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF3FF] text-[28px] text-[#174EA6]">☁</span>
                  <span className="mt-3 block text-[15px] font-semibold text-[#071D49]">Select File</span>
                  <span className="mt-1 block text-[12px] text-[#68758A]">Supported formats: JPG, PNG, WEBP, PDF. Max size 5MB.</span>
                </span>
              </label>

              <div className="rounded-xl border border-[#DCE7F5] bg-white p-3">
                <p className="text-[13px] font-semibold text-[#071D49]">Selected File</p>
                {selectedFile ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#F8FBFF] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-[#071D49]">{selectedFile.name}</p>
                      <p className="mt-0.5 text-[12px] text-[#68758A]">{formatSize(selectedFile.size)}</p>
                    </div>
                    <span className="text-[22px] text-[#139657]">✓</span>
                  </div>
                ) : <p className="mt-2 text-[12px] text-[#8B98A9]">No file selected.</p>}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-lg border border-[#B8C5D6] px-8 text-[14px] font-semibold text-[#071D49]">Cancel</button>
              <button type="submit" disabled={!selectedFile || isPending} className="h-11 rounded-lg bg-[#071D49] px-10 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">{isPending ? "Uploading..." : "Upload"}</button>
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
