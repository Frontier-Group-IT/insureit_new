"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

type RoleOption = { value: string; label: string };

export function UserRegisterFilters({
  initialQuery,
  initialRole,
  roles,
}: {
  initialQuery: string;
  initialRole: string;
  roles: RoleOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);

  function navigate(next: { q?: string; role?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "users");

    const nextQuery = next.q ?? query;
    const nextRole = next.role ?? initialRole;

    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");

    if (nextRole) params.set("role", nextRole);
    else params.delete("role");

    router.push(`/system/access-control?${params.toString()}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate({ q: query });
  }

  return (
    <form onSubmit={submitSearch} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search employee, role or location"
        aria-label="Search access-control users"
        className="h-9 min-w-[220px] flex-1 rounded-lg border border-[#D8E1EC] bg-white px-3 text-[10px] outline-none transition focus:border-[#94A3B8] lg:max-w-[330px]"
      />
      <select
        value={initialRole}
        onChange={(event) => navigate({ role: event.target.value })}
        aria-label="Filter users by role"
        className="h-9 min-w-[145px] cursor-pointer rounded-lg border border-[#D8E1EC] bg-white px-3 text-[10px] outline-none transition hover:border-[#B8C5D4] focus:border-[#94A3B8]"
      >
        <option value="">All roles</option>
        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
      </select>
    </form>
  );
}
