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

  // Preserve fetched RC details in the vehicle form submission without a separate UI panel.
  return <input type="hidden" name="rc_details_json" value={snapshot ? JSON.stringify(snapshot) : ""} readOnly />;
}
