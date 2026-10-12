"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { Bell, Camera, ChevronRight, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const avatarKey = (userId: string) => `insureit:user-avatar:${userId}`;

export function CustomerHeaderActions({ name, userId }: { name: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initial = name.trim().charAt(0).toUpperCase() || "C";

  useEffect(() => {
    try { setAvatarDataUrl(window.localStorage.getItem(avatarKey(userId))); }
    catch { setAvatarDataUrl(null); }
  }, [userId]);

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setAvatarMessage("Choose a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarMessage("Profile image must be 2 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setAvatarDataUrl(result);
      try {
        window.localStorage.setItem(avatarKey(userId), result);
        setAvatarMessage("Profile photo updated.");
      } catch {
        setAvatarMessage("Photo updated for this session, but could not be saved in this browser.");
      }
    };
    reader.onerror = () => setAvatarMessage("Could not read the selected image.");
    reader.readAsDataURL(file);
  }

  async function signOut() {
    await createClient().auth.signOut();
    await fetch("/api/customer/auth/session", { method: "DELETE" });
    window.location.href = "/customer/login";
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/customer/support" aria-label="Customer updates and support" title="Updates and support" className="grid h-10 w-10 place-items-center rounded-full border border-[#D7E3F2] bg-[#EDF4FC] text-[#142746] hover:bg-[#DFEAFA]">
        <Bell className="h-5 w-5" />
      </Link>
      <span className="h-8 w-px bg-[#D2DAE7]" aria-hidden="true" />
      <div className="relative">
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Choose customer profile photo" onChange={chooseAvatar} />
        <button type="button" aria-label="Open customer profile menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid h-11 w-11 overflow-hidden place-items-center rounded-full border-2 border-[#245A9A] bg-white text-base font-bold text-[#10213D]">
          {avatarDataUrl ? <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" /> : initial}
        </button>
        {open ? (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-label="Close profile menu" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-14 z-50 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-[#DBE4F0] bg-white shadow-[0_20px_50px_rgba(15,32,57,0.17)]">
              <div className="flex items-center gap-3 border-b border-[#EDF1F6] px-4 py-4">
                <span className="relative h-11 w-11 shrink-0">
                  <span className="grid h-11 w-11 overflow-hidden place-items-center rounded-full bg-[#EDF3FF] text-[#1A4F9D]">
                    {avatarDataUrl ? <img src={avatarDataUrl} alt="Customer profile" className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" />}
                  </span>
                  <button type="button" aria-label="Change profile photo" title="Change profile photo" onClick={() => { setAvatarMessage(null); fileInputRef.current?.click(); }} className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-[#111A35] text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#245A9A]">
                    <Camera className="h-2.5 w-2.5" />
                  </button>
                </span>
                <Link href="/customer/profile" onClick={() => setOpen(false)} className="min-w-0 flex-1 hover:text-[#245A9A]">
                  <span className="block truncate text-sm font-bold text-[#142746]">{name}</span>
                  <span className="text-xs text-[#78869A]">View user details</span>
                </Link>
              </div>
              {avatarMessage ? <p role="status" className="border-b border-[#EDF1F6] bg-[#F7FAFF] px-4 py-2 text-xs text-[#596A83]">{avatarMessage}</p> : null}
              <Link href="/customer/profile" onClick={() => setOpen(false)} className="flex items-center justify-between px-5 py-4 text-sm font-semibold text-[#142746] hover:bg-[#F6F9FD]">Profile & account <ChevronRight className="h-4 w-4" /></Link>
              <button type="button" onClick={() => void signOut()} className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-red-600 hover:bg-red-50">Logout <LogOut className="h-4 w-4" /></button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
