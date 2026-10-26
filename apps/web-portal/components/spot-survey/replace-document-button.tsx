"use client";

import { FilePenLine, FilePlus2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelClaimDocumentUploads,
  finalizeClaimDocumentUpload,
  prepareClaimDocumentUpload
} from "@/app/claims/[id]/claim-document-upload-actions";
import { createSupabaseBrowserClient } from "@/lib/auth";

const bucketName = "claim-documents";
const maxDocumentSizeBytes = 5 * 1024 * 1024;
const maxVideoSizeBytes = 50 * 1024 * 1024;
const documentMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const videoMimeTypes = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"]);

async function bestEffortCancelClaimDocumentUploads(claimId: string, paths: string[]) {
  if (!paths.length) return;
  try {
    await cancelClaimDocumentUploads(claimId, paths);
  } catch {
    // Cleanup is secondary recovery. It must never replace the original upload failure or crash the claim page.
  }
}

export function ReplaceDocumentButton({ claimId, documentId, documentType, label, actionLabel = "Replace", iconOnly = false }: { claimId: string; customerId: string; documentId?: string; documentType: string; label: string; actionLabel?: "Upload" | "Replace"; iconOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isReplaceAction = actionLabel === "Replace";
  const isUploadAction = actionLabel === "Upload";
  const isVideoDocument = documentType.toLowerCase().includes("video");
  const acceptedFileTypes = isVideoDocument
    ? "video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,.mp4,.mov,.webm,.mkv,.avi"
    : "image/jpeg,image/png,image/webp,application/pdf";

  const selectFiles = (files: File[]) => {
    setResult(null);
    setProgress("");
    if (!files.length) return;
    if (isReplaceAction && files.length !== 1) {
      setResult({ok:false,message:"Replacing a document accepts exactly one file."});
      return;
    }
    for (const file of files) {
      const validationError = validateSelectedFile(documentType, file);
      if (validationError) {
        setResult({ok:false,message:`${file.name}: ${validationError}`});
        return;
      }
    }
    setSelectedFiles((previous) => {
      if (isReplaceAction) return files;
      const next = [...previous];
      for (const file of files) {
        const duplicate = next.some((existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
        );
        if (!duplicate) next.push(file);
      }
      return next;
    });
  };

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 px-4 py-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const files = selectedFiles;
          if (!files.length || (isReplaceAction && (!documentId || files.length !== 1))) return;
          startTransition(async () => {
            let completed = 0;
            const errors: string[] = [];
            const supabase = createSupabaseBrowserClient();
            for (const [index, file] of files.entries()) {
              let uploadedPath: string | null = null;
              setProgress(`Uploading ${index + 1} of ${files.length}: ${file.name}`);
              try {
                const prepared = await prepareClaimDocumentUpload(claimId, documentType, {
                  name:file.name,size:file.size,type:file.type,
                }, isReplaceAction ? documentId : undefined);
                const upload=prepared.uploads?.[0];
                if (!prepared.ok || !upload) {
                  errors.push(`${file.name}: ${prepared.message ?? "Could not prepare upload."}`);
                  continue;
                }
                const fileOptions=file.type ? {cacheControl:"3600",contentType:file.type} : {cacheControl:"3600"};
                // Keep the path for cleanup even if the storage request fails midway.
                uploadedPath=upload.path;
                const {error:uploadError}=await supabase.storage.from(bucketName).uploadToSignedUrl(upload.path,upload.token,file,fileOptions);
                if(uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
                const response=await finalizeClaimDocumentUpload(claimId,documentType,{
                  path:upload.path,fileName:upload.fileName,documentType:upload.documentType,
                },isReplaceAction ? documentId : undefined);
                if(!response.ok){
                  await bestEffortCancelClaimDocumentUploads(claimId,[upload.path]);
                  uploadedPath=null;
                  errors.push(`${file.name}: ${response.message ?? "Could not save document."}`);
                  continue;
                }
                // The finalized document owns its storage object.
                uploadedPath=null;
                completed++;
              } catch (error) {
                if(uploadedPath) await bestEffortCancelClaimDocumentUploads(claimId,[uploadedPath]);
                const reason = error instanceof Error && error.message.trim() ? error.message : "Unexpected upload error.";
                errors.push(`${file.name}: ${reason}`);
              }
            }
            setProgress("");
            setResult({ok:errors.length===0,message:`${completed} of ${files.length} file(s) uploaded.${errors.length ? " " + errors.join(" ") : ""}`});
            if (completed) {
              setSelectedFiles([]);
              router.refresh();
            }
            if (completed === files.length) setOpen(false);
          });
        }}
        className="w-[min(520px,calc(100vw-32px))] overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#F0E9FF] text-[28px]">📄</div>
            <div>
              <h2 className="text-[18px] font-semibold leading-tight text-[#071D49]">{isReplaceAction ? `Replace ${label}` : iconOnly ? `Upload New ${label}` : `Upload Valid ${label}`}</h2>
              <p className="mt-2 max-w-[330px] text-[12px] leading-5 text-[#4B596B]">{isReplaceAction ? `Select a new ${label} file. The existing file will be replaced and must be verified again.` : iconOnly ? `Add another ${label} file without changing the existing uploaded files.` : `Please upload clear and valid ${label}.`}</p>
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-[28px] leading-none text-[#071D49]">×</button>
        </div>

        <div className="space-y-4 px-5 pb-5">
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const files = Array.from(event.dataTransfer.files);
              selectFiles(files);
            }}
            className={`grid min-h-[140px] cursor-pointer place-items-center rounded-xl border border-dashed px-4 text-center transition ${isDragging ? "border-[#174EA6] bg-[#EAF3FF]" : "border-[#8BA0BC] bg-[#F8FBFF] hover:border-[#174EA6]"}`}
          >
            <input
              name="file"
              type="file"
              accept={acceptedFileTypes}
              className="hidden"
              multiple={!isReplaceAction}
              onChange={(event) => {
                selectFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <span>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#EAF3FF] text-[30px] text-[#174EA6]">☁</span>
              <span className="mt-2 block text-[13px] font-semibold text-[#071D49]">{isDragging ? "Drop files here" : "Drag & drop files here"}</span>
              <span className="block text-[12px] text-[#68758A]">or</span>
              <span className="mt-1 inline-flex h-8 items-center rounded-md bg-[#071D49] px-5 text-[12px] font-semibold text-white">{isReplaceAction ? "Select File" : "Select Files"}</span>
              <span className="mt-2 block text-[10px] text-[#68758A]">{isVideoDocument ? "Supported formats: MP4, MOV, WEBM, MKV, AVI (Max size 50MB)" : "Supported formats: JPG, PNG, PDF (Max size 5MB)"}</span>
            </span>
          </label>

          <div>
            <p className="text-[13px] font-semibold text-[#071D49]">Selected Files ({selectedFiles.length})</p>
            {selectedFiles.length ? <div className="mt-2 max-h-52 space-y-2 overflow-y-auto">
              {selectedFiles.map((file,index)=><div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] px-3 py-2">
                <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-[#071D49]">{file.name}</p><p className="text-[10px] text-[#68758A]">{formatSize(file.size)}</p></div>
                <button type="button" disabled={isPending} aria-label={`Remove ${file.name}`} onClick={()=>setSelectedFiles(files=>files.filter((_,i)=>i!==index))} className="text-[18px] text-red-600">×</button>
              </div>)}
            </div> : <p className="mt-2 rounded-lg border border-[#DCE7F5] bg-[#F8FBFF] px-3 py-3 text-[12px] text-[#8B98A9]">No files selected.</p>}
            {progress ? <p role="status" className="mt-2 text-[11px] font-medium text-[#174EA6]">{progress}</p> : null}
          </div>
          {result ? <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? (isReplaceAction ? "Replacement completed." : "Upload completed.") : (isReplaceAction ? "Replacement failed." : "Upload failed."))}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#E6EEF7] px-5 py-4">
          <button type="button" onClick={() => { setSelectedFiles([]); setResult(null); setIsDragging(false); setOpen(false); }} className="h-10 rounded-md border border-[#B8C5D6] px-8 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
          <button type="submit" disabled={!selectedFiles.length || isPending || Boolean(result?.ok) || (isReplaceAction && !documentId)} className="h-10 rounded-md bg-[#071D49] px-10 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">{isPending ? (isReplaceAction ? "Replacing..." : "Uploading...") : (isReplaceAction ? "Replace" : "Upload")}</button>
        </div>
      </form>
    </div>,
    document.body
  ) : null;

  const uploadLabel = iconOnly ? `Upload new ${label}` : `Upload ${label}`;

  return (
    <>
      <button
        type="button"
        disabled={isReplaceAction && !documentId}
        onClick={() => { setResult(null); setProgress(""); setSelectedFiles([]); setIsDragging(false); setOpen(true); }}
        {...(isReplaceAction ? { "data-document-action": "replace", "aria-label": "Replace document", title: "Replace document" } : { "data-document-action": iconOnly ? "upload-new" : "upload", "aria-label": uploadLabel, title: uploadLabel })}
        className={isReplaceAction
          ? "grid h-8 w-8 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-[#C43D3D] transition hover:bg-[#FFF5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D15B5B]/30 disabled:cursor-not-allowed disabled:opacity-40"
          : iconOnly
            ? "grid h-7 w-7 shrink-0 place-items-center p-0 text-[#2563EB] transition-colors hover:text-[#174EA6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
            : "min-w-0 flex-1 cursor-pointer rounded-none px-2 py-1.5 text-left text-[11px] font-semibold text-[#071D49] transition-colors hover:rounded-md hover:bg-[#F4F8FF] hover:text-[#174EA6] focus-visible:rounded-md focus-visible:bg-[#F4F8FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6]/25"}
      >
        {isReplaceAction ? <FilePenLine aria-hidden="true" size={16} strokeWidth={2} /> : iconOnly ? <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} /> : isUploadAction ? "Document not uploaded" : actionLabel}
      </button>
      {modal}
    </>
  );
}

function validateSelectedFile(documentType: string, file: File) {
  if (!file.name.trim() || !Number.isFinite(file.size) || file.size <= 0) {
    return "Invalid file. Please choose another file.";
  }

  const expectedVideo = documentType.toLowerCase().includes("video");
  const actualVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name);
  if (expectedVideo !== actualVideo) {
    return expectedVideo ? "Please upload a supported video file." : "Video files are not allowed for this document type.";
  }

  const maxSize = expectedVideo ? maxVideoSizeBytes : maxDocumentSizeBytes;
  if (file.size > maxSize) {
    return `The selected file exceeds the ${expectedVideo ? "50 MB" : "5 MB"} limit.`;
  }

  const extensionAllowed = expectedVideo
    ? /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
    : /\.(jpg|jpeg|png|webp|pdf)$/i.test(file.name);
  const typeAllowed = expectedVideo ? videoMimeTypes.has(file.type) : documentMimeTypes.has(file.type);
  if (file.type ? !typeAllowed && !extensionAllowed : !extensionAllowed) {
    return "Unsupported document format.";
  }

  return null;
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}
