"use client";

import { useEffect, useState } from "react";

type RcSection = { title: string; fields: Array<{ label: string; value: string }> };
type Snapshot = { sections: RcSection[]; lookedUpAt?: string | null; source?: string | null };

function initialSnapshot(value: unknown): Snapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.sections) ? (record as Snapshot) : null;
}

export function VehicleRcSnapshot({ initialDetails }: { initialDetails?: unknown }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(() => initialSnapshot(initialDetails));
  useEffect(() => {
    const apply = (event: Event) => {
      const details = (event as CustomEvent<Record<string, unknown>>).detail;
      if (!details || !Array.isArray(details.sections)) return;
      setSnapshot({
        sections: details.sections as RcSection[],
        lookedUpAt: typeof details.lookedUpAt === "string" ? details.lookedUpAt : null,
        source: typeof details.source === "string" ? details.source : null,
      });
    };
    window.addEventListener("insureit:vehicle-rc-applied", apply);
    return () => window.removeEventListener("insureit:vehicle-rc-applied", apply);
  }, []);

  return (
    <div className="rounded-xl border border-[#D9E2F0] bg-white px-4 py-3">
      <input type="hidden" name="rc_details_json" value={snapshot ? JSON.stringify(snapshot) : ""} readOnly />
      <details>
        <summary className="cursor-pointer text-[12px] font-semibold text-[#17365D]">
          Complete RC API Details (Optional) {snapshot ? "· saved snapshot" : "· available after RC fetch"}
        </summary>
        {snapshot ? (
          <div className="mt-3 space-y-3">
            <p className="text-[10px] text-[#64748B]">
              Source: {snapshot.source ?? "Previously saved RC data"} {snapshot.lookedUpAt ? `· Fetched ${snapshot.lookedUpAt}` : ""}
            </p>
            {snapshot.sections.map((section, index) => (
              <section key={index} className="rounded-lg border border-[#E2E8F0]">
                <h3 className="border-b bg-[#F8FAFC] px-3 py-2 text-[11px] font-bold">{section.title}</h3>
                <dl className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="min-w-0">
                      <dt className="text-[9px] font-semibold text-[#667085]">{field.label}</dt>
                      <dd className="break-words text-[11px] text-[#17203A]">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : <p className="mt-2 text-[11px] text-[#667085]">No RC snapshot saved. You can still enter and save vehicle details manually.</p>}
      </details>
    </div>
  );
}
