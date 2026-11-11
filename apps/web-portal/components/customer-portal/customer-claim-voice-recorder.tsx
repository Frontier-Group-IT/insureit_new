"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Upload } from "lucide-react";
import type { CustomerClaimFile } from "./customer-claim-compact-document";
import { CustomerClaimSavedVoiceNotes } from "./customer-claim-saved-voice-notes";
import { useRouter } from "next/navigation";
import { CustomerErrorDialog } from "./customer-error-dialog";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";

export function CustomerClaimVoiceRecorder({ claimId, accountId, documents = [], allowUpload = true }: { claimId: string; accountId: string; documents?: CustomerClaimFile[]; allowUpload?: boolean }) {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [recording, setRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [uploadErrorNotice,setUploadErrorNotice]=useState<string|null>(null);
  const shownUploadId=useRef<string|null>(null);
  const router = useRouter();
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadCustomerClaimDocument, {error:null});
  useEffect(() => {if(uploadState.error)setUploadErrorNotice(uploadState.error);},[uploadState.error]);
  useEffect(() => {
    if(!uploadState.uploaded?.id || uploadState.error || shownUploadId.current===uploadState.uploaded.id)return;
    shownUploadId.current=uploadState.uploaded.id;
    setAudioFile(null);
    if(fileRef.current)fileRef.current.value="";
    router.refresh();
  },[uploadState.uploaded?.id,uploadState.error]);
  useEffect(() => {
    if (!audioFile) { setAudioUrl(null); return; }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);
  useEffect(() => () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser. Please upload an audio file instead.");
      return;
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find(candidate => MediaRecorder.isTypeSupported(candidate));
      const instance = type ? new MediaRecorder(mic, { mimeType: type }) : new MediaRecorder(mic);
      const chunks: BlobPart[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onstop = () => {
        const mime = (instance.mimeType || "audio/webm").split(";")[0];
        const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunks, { type: mime });
        if (blob.size > 0 && blob.size <= 5 * 1024 * 1024) setAudioFile(new File([blob], "incident-voice-note." + extension, { type: mime }));
        else setError("Recording is empty or over 5 MB. Please record a shorter note.");
        mic.getTracks().forEach(track => track.stop());
        stream.current = null;
        setRecording(false);
      };
      instance.start();
      recorder.current = instance;
      setRecording(true);
    } catch (cause) {
      const name = cause instanceof DOMException ? cause.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Microphone permission is blocked for this site. Allow microphone access in your browser site settings; if already enabled, check Windows microphone privacy settings, the browser-selected input device, and any organization restrictions, then tap Record Voice again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No microphone was detected on this device.");
      } else {
        setError("Microphone could not be started. Check browser microphone access and try again.");
      }
    }
  }
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  function upload() {
    if (!audioFile || !fileRef.current || !formRef.current) return;
    const transfer = new DataTransfer();
    transfer.items.add(audioFile);
    fileRef.current.files = transfer.files;
    formRef.current.requestSubmit();
  }
  return <section className="rounded-2xl border border-[#DBE4F0] bg-white p-4 shadow-sm sm:p-5">
    <CustomerErrorDialog title="Voice note unavailable" message={error || uploadErrorNotice} onClose={() => {setError("");setUploadErrorNotice(null);}}/>
    <div className="mb-3 flex items-center gap-2 border-b border-[#E5EDF6] pb-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EDF4FF] text-[#2860AD]"><Mic className="h-5 w-5" /></span>
      <h2 className="text-[17px] font-bold text-[#112B51]">Incident Voice Note</h2>
    </div>
    {allowUpload ? <div className="flex flex-wrap items-center gap-2">
      {recording
        ? <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white"><Square className="h-4 w-4" /> Stop recording</button>
        : <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white"><Mic className="h-4 w-4" /> Record Voice</button>}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#B9CBE2] px-4 py-2 text-xs font-semibold text-[#174A87]"><Upload className="h-4 w-4" /> Choose audio <input type="file" accept="audio/mp4,audio/x-m4a,audio/m4a,audio/webm,audio/ogg" className="sr-only" onChange={event => { const file=event.target.files?.[0]; if (file) setAudioFile(file); }} /></label>
    </div> : null}
    {allowUpload && audioUrl && <div className="mt-3 flex flex-wrap items-center gap-2">
      <audio controls src={audioUrl} className="h-9 max-w-full" />
      <button type="button" onClick={() => setAudioFile(null)} aria-label="Delete recorded audio" className="rounded-md p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
      <button type="button" onClick={upload} disabled={uploadPending} className="rounded-lg bg-[#1253A7] px-4 py-2 text-xs font-semibold text-white">Upload voice note</button>
    </div>}
    <CustomerClaimSavedVoiceNotes documents={documents} accountId={accountId} claimId={claimId} allowDelete={allowUpload}/>
    <form action={uploadAction} ref={formRef} className="hidden">
      <input type="hidden" name="account" value={accountId} />
      <input type="hidden" name="claim" value={claimId} />
      <input type="hidden" name="stage" value="spot_intimation" />
      <input type="hidden" name="returnToSpotIntimation" value="1" />
      <input type="hidden" name="type" value="Incident Voice Note" />
      <input ref={fileRef} type="file" name="file" required />
    </form>
  </section>;
}
