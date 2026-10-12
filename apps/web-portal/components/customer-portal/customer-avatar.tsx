"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";

const UPDATED_EVENT = "insureit:customer-avatar-updated";
const MAX_BYTES = 2 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function keyFor(userId: string) { return `insureit:user-avatar:${userId}`; }

export function CustomerAvatar({ userId, size = "menu" }: { userId: string; size?: "menu" | "profile" | "header" }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => {
      try { setPhoto(window.localStorage.getItem(keyFor(userId))); }
      catch { setPhoto(null); }
    };
    sync();
    window.addEventListener(UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!allowedTypes.has(file.type)) { setError("Choose a JPG, PNG or WebP image."); return; }
    if (file.size > MAX_BYTES) { setError("Photo must be 2 MB or smaller."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") { setError("Could not read photo."); return; }
      try {
        window.localStorage.setItem(keyFor(userId), reader.result);
        setPhoto(reader.result);
        setError("");
        window.dispatchEvent(new Event(UPDATED_EVENT));
      } catch { setError("Could not save photo in this browser."); }
    };
    reader.onerror = () => setError("Could not read photo.");
    reader.readAsDataURL(file);
  }

  const large = size === "profile";
  const header = size === "header";
  return (
    <div className={`relative shrink-0 ${large ? "h-20 w-20" : header ? "h-11 w-11" : "h-12 w-12"}`}>
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#EAF2FF] p-1">
        {/* The existing INSUREIT shield is the default, never a generic user initial. */}
        <img src={photo || "/assets/brand/insureit-mark.webp"} alt={photo ? "Customer profile photo" : "INSUREIT shield"} className="h-full w-full object-contain" />
      </span>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Upload customer profile photo" onChange={selectFile} />
      <button type="button" aria-label="Change profile photo" title="Change profile photo" onClick={(event) => { event.preventDefault(); event.stopPropagation(); fileInput.current?.click(); }} className={`absolute bottom-0 right-0 z-10 grid ${large ? "h-7 w-7" : "h-6 w-6"} translate-x-1 translate-y-1 place-items-center rounded-full border-2 border-white bg-[#111A35] text-white shadow-md hover:bg-[#245A9A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`}>
        <Camera className={large ? "h-4 w-4" : "h-3.5 w-3.5"} />
      </button>
      {error ? <span role="alert" className="absolute left-0 top-full z-[80] mt-2 w-48 rounded-lg bg-white p-2 text-xs text-red-600 shadow-lg">{error}</span> : null}
    </div>
  );
}
