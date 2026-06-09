"use client";

import { useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase";

type UserMenuProps = {
  profile: Profile | null;
  user: Pick<User, "email" | "id"> | null;
};

function initialsFor(name?: string | null, email?: string | null) {
  const source = name || email || "InsureIt User";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "IU";
}

export function UserMenu({ profile, user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = profile?.full_name || user?.email || "Signed-in user";
  const initials = useMemo(() => initialsFor(profile?.full_name, user?.email), [profile?.full_name, user?.email]);

  async function handleLogout() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/auth/session", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-700 text-sm font-black text-white shadow-sm ring-2 ring-white transition hover:bg-navy-800 focus:outline-none focus:ring-4 focus:ring-green-100"
      >
        {initials}
      </button>
      {isOpen ? (
        <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="menu">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
            onClick={() => setShowDetails((current) => !current)}
            role="menuitem"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-black text-white">{initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-navy-900">{displayName}</span>
              <span className="block text-xs text-slate-500">View user details</span>
            </span>
          </button>
          {showDetails ? (
            <div className="border-y border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <dl className="space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Email</dt>
                  <dd className="truncate text-right text-slate-700">{user?.email ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Role</dt>
                  <dd className="text-right capitalize text-slate-700">{profile?.role?.replaceAll("_", " ") ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-slate-500">Status</dt>
                  <dd className="text-right text-slate-700">{profile?.is_active ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
            </div>
          ) : null}
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
