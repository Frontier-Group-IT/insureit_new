"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";
import { Files, Mic, Play, Plus, Square, Trash2, Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/auth";
import {
  cancelClaimDocumentUploads,
  finalizeClaimDocumentUpload,
  finalizeSpotSurveyMediaUpload,
  prepareClaimDocumentUpload,
  prepareSpotSurveyMediaUpload,
} from "@/app/claims/[id]/claim-document-upload-actions";

const bucket = "claim-documents";
const acceptedDocuments = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.mp4,.mov,.webm,.m4a,.ogg";
const audioTypes = ["audio/mp4", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/ogg"];
const videoTypes = ["video/mp4", "video/quicktime", "video/webm"];
const imageTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const documentTypes = ["application/pdf", ...imageTypes];
type Message = { ok: boolean; text: string };

function isVideo(file: File) {
  return videoTypes.includes(file.type) || (!file.type && /\.(mp4|mov|webm)$/i.test(file.name));
}
function isAudio(file: File) {
  return audioTypes.includes(file.type);
}
function checkFile(file: File, voice: boolean): string | null {
  if (!file.size) return "Empty files cannot be uploaded.";
  if (voice) {
    if (!isAudio(file)) return "Choose an M4A, MP4, WEBM or OGG audio file.";
    if (file.size > 5 * 1024 * 1024) return "Voice notes must be 5 MB or smaller.";
    return null;
  }
  if (!(isVideo(file) || documentTypes.includes(file.type) || (!file.type && /\.(pdf|jpg|jpeg|png|webp|heic)$/i.test(file.name)))) return "Unsupported claim document format: " + file.name;
  const limit = isVideo(file) ? 50 : 5;
  if (file.size > limit * 1024 * 1024) return file.name + " exceeds the " + limit + " MB limit.";
  return null;
}

export function OperationsClaimStageOneAttachments({ claimId }: { claimId: string }) {
  const router = useRouter();
  const bulkPicker = useRef<HTMLInputElement>(null);
  // Synchronous lock prevents two picker/Retry events from submitting the same batch.
  const uploadLock = useRef(false);
  const [selectedBulk, setSelectedBulk] = useState<File[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [failedBulk, setFailedBulk] = useState<string[]>([]);
  const audioPicker = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const [busy, startTransition] = useTransition();
  const [bulkMessage, setBulkMessage] = useState<Message | null>(null);
  const [voiceMessage, setVoiceMessage] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!audioFile) { setAudioUrl(null); return; }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    micStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function uploadOne(file: File, voice: boolean): Promise<void> {
    const type = voice ? "Incident Voice Note" : isVideo(file) ? "Accident Video" : "Spot Intimation Attachment";
    const metadata = { name: file.name, size: file.size, type: file.type };
    const video = !voice && isVideo(file);
    const prepared = video
      ? await prepareSpotSurveyMediaUpload(claimId, [metadata])
      : await prepareClaimDocumentUpload(claimId, type, metadata);
    const upload = prepared.uploads?.[0];
    if (!prepared.ok || !upload) throw new Error(prepared.message || "Could not prepare upload.");
    let finalized = false;
    try {
      const client = createSupabaseBrowserClient();
      const { error } = await client.storage.from(bucket).uploadToSignedUrl(upload.path, upload.token, file, {
        cacheControl: "3600", ...(file.type ? { contentType: file.type } : {}),
      });
      if (error) throw new Error(error.message);
      const result = video
        ? await finalizeSpotSurveyMediaUpload(claimId, [{ path: upload.path, fileName: upload.fileName, documentType: upload.documentType }])
        : await finalizeClaimDocumentUpload(claimId, type, { path: upload.path, fileName: upload.fileName, documentType: upload.documentType });
      if (!result.ok) throw new Error(result.message || "Could not save claim document.");
      finalized = true;
    } finally {
      if (!finalized) {
        // Only unregistered upload paths may be cleaned up; registered evidence must stay intact.
        try { await cancelClaimDocumentUploads(claimId, [upload.path]); } catch { /* best effort */ }
      }
    }
  }

  function submitFiles(files: File[], voice: boolean) {
    if (!files.length || uploadLock.current) return;
    const setMessage = voice ? setVoiceMessage : setBulkMessage;
    setMessage(null);
    if (files.length > (voice ? 1 : 10)) {
      setMessage({ ok: false, text: voice ? "Choose one audio file." : "Choose up to 10 files at a time." });
      return;
    }
    for (const file of files) {
      const problem = checkFile(file, voice);
      if (problem) { setMessage({ ok: false, text: problem }); return; }
    }
    uploadLock.current = true;
    if (!voice) {
      setSelectedBulk(files);
      setFailedBulk([]);
    }
    startTransition(async () => {
      try {
      let completed = 0;
      const failed: File[] = [];
      if (!voice) setBulkProgress({ done: 0, total: files.length });
      for (const file of files) {
        try {
          await uploadOne(file, voice);
          completed++;
        } catch (error) {
          failed.push(file);
          setMessage({ ok: false, text: (error instanceof Error ? error.message : "Upload failed.") + " " + completed + " file(s) already saved; retry only failed files." });
        }
        if (!voice) setBulkProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }
      if (!voice) {
        setSelectedBulk(failed);
        setFailedBulk(failed.map(file => file.name));
      }
      if (!failed.length) {
        setMessage({ ok: true, text: completed + (voice ? " voice note saved." : " document(s) uploaded successfully.") });
        if (voice) setAudioFile(null);
      }
      if (completed) router.refresh();
      } finally {
        uploadLock.current = false;
      }
    });
  }

  async function beginRecording() {
    setVoiceMessage(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceMessage({ ok: false, text: "Recording is not supported in this browser. Please choose an audio file instead." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.current = stream;
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(type => MediaRecorder.isTypeSupported(type));
      const instance = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.current = instance;
      const chunks: Blob[] = [];
      instance.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        const contentType = (instance.mimeType || "audio/webm").split(";")[0];
        const ext = contentType.includes("ogg") ? "ogg" : contentType.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(chunks, { type: contentType });
        if (blob.size && blob.size <= 5 * 1024 * 1024) setAudioFile(new File([blob], "incident-voice-note." + ext, { type: contentType }));
        else setVoiceMessage({ ok: false, text: "Recording is empty or exceeds 5 MB. Please record a shorter note." });
        stream.getTracks().forEach(track => track.stop());
        micStream.current = null;
        setRecording(false);
      };
      instance.start();
      setRecording(true);
    } catch (cause) {
      // getUserMedia can fail even when the browser's site toggle is enabled:
      // Permissions-Policy, OS privacy, missing/disconnected input, or a busy device.
      micStream.current?.getTracks().forEach(track => track.stop());
      micStream.current = null;
      recorder.current = null;
      setRecording(false);
      const name = cause instanceof Error ? cause.name : "";
      const reason = name === "NotAllowedError" || name === "SecurityError"
        ? "Microphone access was denied. Allow it for this site and in Windows privacy settings, then retry or choose an audio file."
        : name === "NotFoundError" || name === "DevicesNotFoundError"
          ? "No microphone input was found. Connect or enable a microphone in Windows Sound settings, then retry or choose an audio file."
          : name === "NotReadableError" || name === "TrackStartError"
            ? "Your microphone is busy or unavailable. Close other apps using it, then retry or choose an audio file."
            : name === "OverconstrainedError"
              ? "The selected microphone cannot meet the requested audio settings. Choose another input device or attach an audio file."
              : "Could not start microphone recording. Check your browser input device, permissions and Windows sound settings, or choose an audio file.";
      setVoiceMessage({ ok: false, text: reason });
    }
  }

  function stopRecording() { if (recorder.current?.state === "recording") recorder.current.stop(); }

  return (
    <div className="mt-3 space-y-3">
      <ClaimStageErrorDialog message={bulkMessage && !bulkMessage.ok ? bulkMessage.text : voiceMessage && !voiceMessage.ok ? voiceMessage.text : null} onClose={() => { if (bulkMessage && !bulkMessage.ok) setBulkMessage(null); else setVoiceMessage(null); }} />
      <section aria-label="Upload multiple claim documents">
        <input ref={bulkPicker} type="file" multiple accept={acceptedDocuments} className="sr-only" aria-label="Select multiple claim documents" onChange={e => {
          const files = Array.from(e.currentTarget.files || []); e.currentTarget.value = "";
          if (!files.length) return;
          // Choosing files starts the existing signed upload immediately.
          // A new selection is a separate batch, never a merge with prior failures.
          submitFiles(files, false);
        }} />
        <button type="button" disabled={busy} onClick={() => bulkPicker.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[#C5D8ED] bg-[#F8FAFE] px-4 py-3 text-left transition hover:border-[#4380CD] disabled:opacity-60">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#E5F0FF] text-[#1952A1]"><Files className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-[12px] text-[#102A52]">Upload multiple documents</strong>
            <small className="text-[10px] text-[#7787A2]">{busy ? "Uploading files…" : "Select up to 10 files to upload immediately."}</small></span>
          {busy ? <span className="text-[11px] font-semibold text-[#1952A1]">Uploading…</span> : <Plus className="h-5 w-5 text-[#1952A1]" />}
        </button>
        {selectedBulk.length ? <div className="mt-2 rounded-lg border border-[#D9E3F0] bg-white p-3">
          <div className="mb-2 flex justify-between text-xs font-semibold text-[#17365D]"><span>{busy ? "Uploading" : "Failed to upload"} {selectedBulk.length} file{selectedBulk.length === 1 ? "" : "s"}</span><span>{(selectedBulk.reduce((sum,file)=>sum+file.size,0)/1048576).toFixed(1)} MB total</span></div>
          <ul className="space-y-1">{selectedBulk.map(file => <li key={file.name+file.size+file.lastModified} className="flex min-w-0 items-center gap-2 rounded-md bg-[#F7FAFD] px-2 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate" title={file.name}>{file.name}</span><span className="shrink-0 text-[#64748B]">{(file.size/1048576).toFixed(1)} MB</span>
            {failedBulk.includes(file.name) ? <span className="text-red-600">Failed</span> : null}
            <button type="button" disabled={busy} aria-label={"Remove "+file.name} onClick={() => setSelectedBulk(items=>items.filter(item=>item!==file))} className="rounded p-1 text-[#64748B] disabled:opacity-50"><Trash2 className="h-4 w-4"/></button>
          </li>)}</ul>
          {busy ? <p role="status" className="mt-2 text-xs text-[#174A87]">Processed {bulkProgress.done} of {bulkProgress.total} files</p> : null}
          {!busy && failedBulk.length > 0 ? <button type="button" onClick={() => submitFiles(selectedBulk, false)} className="mt-3 rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white">Retry failed files</button> : null}
        </div> : null}
        {bulkMessage?.ok ? <p role="status" className="mt-2 text-xs text-emerald-700">{bulkMessage.text}</p> : null}
      </section>

      <section aria-label="Incident voice note" className="rounded-xl border border-[#DFE8F4] bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#E5EBF5] pb-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EAF2FF] text-[#1754A2]"><Mic className="h-5 w-5" /></span>
          <h3 className="text-[15px] font-bold text-[#112B51]">Incident Voice Note</h3>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {recording
            ? <button type="button" onClick={stopRecording} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"><Square className="h-4 w-4" />Stop recording</button>
            : <button type="button" disabled={busy} onClick={beginRecording} className="inline-flex items-center gap-2 rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Mic className="h-4 w-4" />Record Voice</button>}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#B9CBE2] px-4 py-2 text-xs font-semibold text-[#174A87]">
            <Upload className="h-4 w-4" /> Choose audio
            <input ref={audioPicker} type="file" accept="audio/mp4,audio/x-m4a,audio/m4a,audio/webm,audio/ogg,.m4a,.webm,.ogg" className="sr-only" onChange={e => {
              setAudioFile(e.currentTarget.files?.[0] || null);
              e.currentTarget.value = "";
              setVoiceMessage(null);
            }} />
          </label>
        </div>
        {audioUrl && <div className="mt-3 flex flex-wrap items-center gap-2">
          <Play className="h-4 w-4 text-[#174A87]" /><audio controls src={audioUrl} className="h-9 max-w-full" />
          <button type="button" aria-label="Remove selected audio" onClick={() => setAudioFile(null)} className="rounded-md p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
          <button type="button" disabled={busy || recording} onClick={() => { if (audioFile) submitFiles([audioFile], true); }} className="rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Upload voice note</button>
        </div>}
        {voiceMessage?.ok ? <p role="status" className="mt-2 text-xs text-emerald-700">{voiceMessage.text}</p> : null}
      </section>
    </div>
  );
}
