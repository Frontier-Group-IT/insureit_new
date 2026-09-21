"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, ClipboardList, FileInput, GraduationCap, Search, ShieldCheck } from "lucide-react";
import type { PartnerActivityData } from "@/lib/partner-web";
import { getInsurerLogo } from "@/lib/insurer-logo";

function dateLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

function activityHref(item: PartnerActivityData["items"][number]) {
  if (item.kind === "policy") return "/partner/policies/" + encodeURIComponent(item.entity_id);
  if (item.kind === "claim") return "/partner/claims/" + encodeURIComponent(item.entity_id);
  if (item.kind === "intake") return "/partner/policy-intakes/" + encodeURIComponent(item.entity_id);
  return null;
}

function iconFor(kind: PartnerActivityData["items"][number]["kind"]) {
  if (kind === "policy") return ShieldCheck;
  if (kind === "claim") return ClipboardList;
  if (kind === "intake") return FileInput;
  return GraduationCap;
}

function labelFor(kind: PartnerActivityData["items"][number]["kind"]) {
  if (kind === "policy") return "POLICY";
  if (kind === "claim") return "CLAIM";
  if (kind === "intake") return "OPERATIONS";
  return "LEARN";
}

function insurerNameFor(item: PartnerActivityData["items"][number]) {
  if (item.insurer_name) return item.insurer_name;
  if (item.kind !== "policy") return null;
  const [candidate] = item.meta.split(" · ");
  return getInsurerLogo(candidate) ? candidate : null;
}

function searchableText(item: PartnerActivityData["items"][number]) {
  return [labelFor(item.kind), item.kind, item.title, item.subtitle, item.meta, item.entity_id, dateLabel(item.event_at)]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en-IN");
}

export function ActivityTimelineClient({ data }: { data: PartnerActivityData }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("en-IN");
  const filteredItems = useMemo(
    () => (normalizedQuery ? data.items.filter((item) => searchableText(item).includes(normalizedQuery)) : data.items),
    [data.items, normalizedQuery],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_5px_18px_rgba(31,53,89,0.04)]">
      <div className="flex flex-col gap-3 border-b border-[#E3EAF2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EEF4FF] text-[#2374E1]"><ShieldCheck className="h-4 w-4" /></span>
            <h2 className="whitespace-nowrap text-[16px] font-extrabold text-[#172B4D]">Recent timeline</h2>
          </div>
          <label className="flex h-10 min-w-[280px] items-center gap-2 rounded-xl border border-[#DCE5EF] bg-white px-3 text-[#8593A8] transition focus-within:border-[#AFC7EA] focus-within:ring-2 focus-within:ring-[#3156B8]/10">
            <Search className="h-4 w-4 shrink-0" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search policy, customer, insurer, vehicle, etc."
              aria-label="Search activity"
              className="min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-[10px] font-medium text-[#243B5A] shadow-none outline-none placeholder:text-[#8593A8] hover:border-0 focus:border-0 focus:ring-0 focus:shadow-none"
            />
          </label>
        </div>
        <span className="whitespace-nowrap text-[11px] font-bold text-[#42526E]">
          {filteredItems.length}{normalizedQuery ? ` of ${data.items.length}` : ""} records
        </span>
      </div>

      {filteredItems.length ? (
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E3EAF2] bg-[#F7FAFD] px-4 py-2 text-[8px] font-extrabold uppercase tracking-[0.06em] text-[#6F7F95]">
              <span>Type</span><span>Date &amp; time</span><span>Policy / reference</span><span>Customer</span><span>Insurer / details</span><span className="text-center">Action</span>
            </div>
            {filteredItems.map((item) => {
              const Icon = iconFor(item.kind);
              const href = activityHref(item);
              const insurerName = insurerNameFor(item);
              const insurerLogo = getInsurerLogo(insurerName);
              const row = (
                <>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-9 shrink-0 items-center justify-center overflow-visible bg-transparent p-0">
                      {insurerLogo ? (
                        <Image
                          src={insurerLogo}
                          alt={insurerName ? `${insurerName} logo` : "Insurance company"}
                          width={32}
                          height={32}
                          className="max-h-7 max-w-[34px] w-auto object-contain"
                        />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]">
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-semibold text-[#213654]">{labelFor(item.kind)}</span>
                  </div>
                  <span className="self-center text-[10px] font-medium text-[#72829A]">{dateLabel(item.event_at)}</span>
                  <span className="self-center break-words text-[10.5px] font-extrabold text-[#172B4D]">{item.title}</span>
                  <span className="self-center break-words text-[10px] font-medium text-[#40536F]">{item.subtitle}</span>
                  <span className="self-center break-words text-[9px] font-medium text-[#7E8CA1]">{item.meta || "—"}</span>
                  <span className="flex items-center justify-center">{href ? <ArrowRight className="h-4 w-4 text-[#2374E1] transition group-hover:translate-x-0.5" /> : null}</span>
                </>
              );
              return href ? (
                <Link key={item.kind + "-" + item.entity_id + "-" + item.event_at} href={href} className="group grid min-h-[58px] grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E7EDF4] px-4 py-2.5 transition last:border-b-0 hover:bg-[#F8FBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">{row}</Link>
              ) : (
                <div key={item.kind + "-" + item.entity_id + "-" + item.event_at} className="grid min-h-[58px] grid-cols-[150px_170px_240px_240px_minmax(280px,1fr)_64px] border-b border-[#E7EDF4] px-4 py-2.5 last:border-b-0">{row}</div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-14 text-center">
          <BriefcaseBusiness className="mx-auto h-7 w-7 text-[#9AABC0]" />
          <p className="mt-3 text-[12px] font-bold text-[#23395D]">{normalizedQuery ? "No matching activity" : "No recent activity"}</p>
          <p className="mt-1 text-[10.5px] text-[#7A899F]">{normalizedQuery ? "Try a policy number, customer, insurer, vehicle, or activity type." : "New policy, claim and service activity will appear here."}</p>
        </div>
      )}
    </section>
  );
}
