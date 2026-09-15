"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth-config";
import { internalLaunchHome } from "@/lib/launch-scope";
import { createClient } from "@/lib/supabase";

type UserMenuProps = {
  profile: Profile | null;
  user: Pick<User, "email" | "id"> | null;
  homeHref?: string;
  displayNameOverride?: string | null;
};

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function initialsFor(name?: string | null, email?: string | null) {
  const source = name || email || "InsureIt User";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "IU";
}

function avatarStorageKey(userId?: string | null) {
  return userId ? `insureit:user-avatar:${userId}` : null;
}

function Avatar({ src, initials, className }: { src: string | null; initials: string; className: string }) {
  return (
    <span className={`${className} relative overflow-hidden rounded-full bg-navy-700 text-white`}>
      {src ? <img src={src} alt="Profile" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

export function UserMenu({ profile, user, homeHref = internalLaunchHome, displayNameOverride }: UserMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const displayName = displayNameOverride?.trim() || profile?.full_name || user?.email || "Signed-in user";
  const initials = useMemo(() => initialsFor(displayName, user?.email), [displayName, user?.email]);

  useEffect(() => {
    const key = avatarStorageKey(user?.id);
    if (!key) {
      setAvatarDataUrl(null);
      return;
    }
    try {
      setAvatarDataUrl(window.localStorage.getItem(key));
    } catch {
      setAvatarDataUrl(null);
    }
  }, [user?.id]);

  function cancelCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openOnHover() {
    cancelCloseTimer();
    setIsOpen(true);
  }

  function closeAfterHover() {
    cancelCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 160);
  }

  useEffect(() => {
    return () => cancelCloseTimer();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsidePointer(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) return;
      cancelCloseTimer();
      setIsOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      cancelCloseTimer();
      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function openAvatarPicker(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    cancelCloseTimer();
    setIsOpen(true);
    setAvatarMessage(null);
    fileInputRef.current?.click();
  }

  function handleAvatarSelected(event: React.ChangeEvent<HTMLInputElement>) {
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
      const value = typeof reader.result === "string" ? reader.result : null;
      if (!value) return;
      setAvatarDataUrl(value);
      const key = avatarStorageKey(user?.id);
      if (key) {
        try {
          window.localStorage.setItem(key, value);
          setAvatarMessage("Profile photo updated.");
        } catch {
          setAvatarMessage("Photo updated for this session, but could not be saved in this browser.");
        }
      }
    };
    reader.onerror = () => setAvatarMessage("Could not read the selected image.");
    reader.readAsDataURL(file);
  }

  async function handleResetPassword() {
    if (!user?.email || isSendingReset) return;
    setIsSendingReset(true);
    setResetMessage(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(homeHref)}`;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
    setResetMessage(error ? error.message : "Password reset link sent to your email.");
    setIsSendingReset(false);
  }

  async function handleLogout() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div ref={menuRef} className="relative" onMouseEnter={openOnHover} onMouseLeave={closeAfterHover}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleAvatarSelected}
        aria-label="Choose profile photo"
      />
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-700 text-sm font-black text-white shadow-sm ring-2 ring-white transition hover:bg-navy-800 focus:outline-none focus:ring-4 focus:ring-green-100"
      >
        <Avatar src={avatarDataUrl} initials={initials} className="flex h-full w-full items-center justify-center text-sm font-black" />
      </button>
      {isOpen ? (
        <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="menu">
          <div className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50">
            <span className="relative h-10 w-10 shrink-0">
              <Avatar src={avatarDataUrl} initials={initials} className="flex h-10 w-10 items-center justify-center text-xs font-black" />
              <button
                type="button"
                onClick={openAvatarPicker}
                className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-navy-800 text-white shadow-sm transition hover:bg-navy-900 focus:outline-none focus:ring-2 focus:ring-green-100"
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <Camera className="h-2.5 w-2.5" />
              </button>
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setShowDetails((current) => !current)}
              role="menuitem"
            >
              <span className="block truncate text-sm font-semibold text-navy-900">{displayName}</span>
              <span className="block text-xs text-slate-500">View user details</span>
            </button>
          </div>
          {avatarMessage ? <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600">{avatarMessage}</div> : null}
          {showDetails ? (
            <div className="border-y border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <dl className="space-y-2">
                <div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Email</dt><dd className="truncate text-right text-slate-700">{user?.email ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Role</dt><dd className="text-right capitalize text-slate-700">{profile?.role?.replaceAll("_", " ") ?? "—"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="font-semibold text-slate-500">Status</dt><dd className="text-right text-slate-700">{profile?.is_active ? "Active" : "Inactive"}</dd></div>
              </dl>
            </div>
          ) : null}
          {resetMessage ? <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">{resetMessage}</div> : null}
          <button
            className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-navy-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleResetPassword}
            disabled={isSendingReset || !user?.email}
            role="menuitem"
          >
            <span>{isSendingReset ? "Sending reset link..." : "Reset Password"}</span>
            <span aria-hidden="true">→</span>
          </button>
          <button
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            role="menuitem"
          >
            <span>{isSigningOut ? "Signing out..." : "Logout"}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
