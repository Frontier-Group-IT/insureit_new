"use server";

import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { captureManagementPackSnapshot } from "@/lib/reports/management-pack-archive";

export async function captureManagementPackSnapshotAction(formData: FormData) {
  const profile = await requireCapability("view_reports");
  if (!profile) redirect("/access-denied");
  const monthValue = formData.get("month");
  const month = typeof monthValue === "string" ? monthValue.trim() : "";
  try {
    const snapshot = await captureManagementPackSnapshot(profile, month);
    redirect(`/reports/management-pack?snapshot=${encodeURIComponent(snapshot.id)}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unable to capture month-end snapshot.";
    redirect(`/reports/management-pack?month=${encodeURIComponent(month)}&archive_error=${encodeURIComponent(reason.slice(0, 180))}`);
  }
}
