"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { uploadSpotSurveyMedia } from "@/app/claims/[id]/spot-survey-actions";

type Result = { ok: boolean; message?: string };

const acceptedTypes = "image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm";

export function SpotMediaUploadButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, startTransition] = useTransition();

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  return (
    <>
      <button
        type="button"
        onClick={() => { setFiles([]); setResult(null); setOpen(true); }}
        className="h-8 rounded-md border border-[#B7CBE5] bg-white px-2 text-[11px] font-semibold text-[#174EA6] transition hover:bg-[#F4F8FF]"
      >
        Upload
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 px-4">
          <form
            action={(formData) => {
              startTransition(async () => {
                formData.set("claimId", claimId);
                const response = await uploadSpotSurveyMedia(formData);
                setResult(response);
                if (response.ok) {
                  setFiles([]);
                  router.refresh();
                }
              });
            }}
            className="w-full max-w-[560px] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#EAF4FF] text-[28px]">📷</div>
                <div>
                  <h2 className="text-[18px] font-semibold leading-tight text-[#071D49]">Upload Spot Photos & Videos</h2>
                  <p className="mt-2 max-w-[370px] text-[12px] leading-5 text-[#4B596B]">Select multiple photos and videos in one upload.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
            </div>

            <div className="space-y-4 px-5 pb-5">
              <label className="grid min-h-[138px] cursor-pointer place-items-center rounded-xl border border-dashed border-[#8BA0BC] bg-[#F8FBFF] px-4 text-center transition hover:border-[#174EA6]">
                <input
                  name="files"
                  type="file"
                  multiple
                  accept={acceptedTypes}
                  className="hidden"
                  required
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                <span>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF3FF] text-[28px] text-[#174EA6]">☁</span>
                  <span className="mt-2 block text-[13px] font-semibold text-[#071D49]">Select photos and videos</span>
                  <span className="mt-1 block text-[10px] text-[#68758A]">JPG, PNG, WEBP, HEIC, MP4, MOV, WEBM · up to 20MB per file</span>
                </span>
              </label>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[#071D49]">Selected files</p>
                  <p className="text-[11px] text-[#68758A]">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatSize(totalSize)}` : "None"}</p>
                </div>
                {files.length ? (
                  <div className="mt-2 max-h-[190px] space-y-2 overflow-y-auto rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] p-2">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-[#071D49]">{file.name}</p>
                          <p className="text-[10px] text-[#68758A]">{file.type.startsWith("video/") ? "Video" : "Photo"} · {formatSize(file.size)}</p>
                        </div>
                        <button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 text-[16px] font-semibold text-[#C43D3D]" aria-label={`Remove ${file.name}`}>×</button>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] px-3 py-3 text-[12px] text-[#8B98A9]">No files selected.</p>}
              </div>

              {result ? <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message}</p> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-md border border-[#B8C5D6] px-8 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={!files.length || pending || Boolean(result?.ok)} className="h-10 rounded-md bg-[#071D49] px-8 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">{pending ? "Uploading..." : `Upload ${files.length || ""}`}</button>
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
