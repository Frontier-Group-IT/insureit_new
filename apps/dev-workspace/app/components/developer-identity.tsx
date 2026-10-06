"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import type { DeveloperIdentity } from "../../lib/control-plane/developer-auth";

export default function DeveloperIdentityBadge() {
  const [identity, setIdentity] = useState<DeveloperIdentity | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function sync() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setIdentity(null);
        return;
      }
      const response = await fetch("/api/control-plane/session", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      if (!response.ok) {
        setIdentity(null);
        return;
      }
      setIdentity(await response.json());
    }

    sync();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void sync(); });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!identity?.authenticated) return <Link className="identity-link" href="/login">Developer sign in</Link>;
  if (!identity.authorized) return <Link className="identity-link denied" href="/login">Access not authorized</Link>;

  return (
    <Link className="identity-link verified" href="/login" title={identity.reason}>
      {identity.fullName || identity.email || "IT Super User"} · {identity.assuranceLevel.toUpperCase()}
    </Link>
  );
}
