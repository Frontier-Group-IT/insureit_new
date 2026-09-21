import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getVoiceCampaignReportRows } from "@/lib/voice-campaigns";

export const runtime = "nodejs";

const HEADERS = [
  "Campaign Name",
  "Campaign Status",
  "Customer Name",
  "Mobile Number",
  "RC / Registration No.",
  "Manufacturer",
  "Current Insurer",
  "Current Policy No.",
  "Policy Expiry Date",
  "Call Attempt No.",
  "Customer Availability",
  "Call Duration (Sec)",
  "Connectivity Status",
  "Completion Status",
  "Submission Status",
  "Call Disposition",
  "Customer Interest",
  "Customer Objection",
  "Follow-up Required",
  "Follow-up Date & Time",
  "Follow-up Time Confidence",
  "Quote Requested",
  "Human Assistance Required",
  "Do Not Contact",
  "Wrong Person",
  "Already Renewed",
  "Add-on Interest",
  "Main Conversation Outcome",
  "Call Summary",
  "Next Recommended Action",
  "Failure Reason",
  "Last Updated At",
  "Conversation Quality Flag",
] as const;

function label(value: string | null | undefined) {
  return value
    ? value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : "";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

function maskMobile(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return "••••••" + digits.slice(-4);
}

function safeFileName(value: string) {
  const normalized = value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "voice-campaign";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const { id } = await params;
  const report = await getVoiceCampaignReportRows(id);

  if (!report) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const exportedRows = report.rows.map((row) => ({
    "Campaign Name": row.campaignName,
    "Campaign Status": label(row.campaignStatus),
    "Customer Name": row.customerName ?? "",
    "Mobile Number": maskMobile(row.mobileNumber),
    "RC / Registration No.": row.registrationNumber ?? "",
    Manufacturer: row.manufacturer ?? "",
    "Current Insurer": row.currentInsurer ?? "",
    "Current Policy No.": row.currentPolicyNumber ?? "",
    "Policy Expiry Date": row.policyExpiryDate ?? "",
    "Call Attempt No.": row.callAttemptNumber ?? "",
    "Customer Availability": row.customerAvailability,
    "Call Duration (Sec)": row.callDurationSeconds ?? "",
    "Connectivity Status": label(row.connectivityStatus),
    "Completion Status": label(row.completionStatus),
    "Submission Status": label(row.submissionStatus),
    "Call Disposition": label(row.callDisposition),
    "Customer Interest": label(row.customerInterest),
    "Customer Objection": row.customerObjection ?? "",
    "Follow-up Required": row.followUpRequired,
    "Follow-up Date & Time": formatDateTime(row.followUpDateTime),
    "Follow-up Time Confidence": row.followUpTimeConfidence,
    "Quote Requested": row.quoteRequested,
    "Human Assistance Required": row.humanAssistanceRequired,
    "Do Not Contact": row.doNotContact,
    "Wrong Person": row.wrongPerson,
    "Already Renewed": row.alreadyRenewed,
    "Add-on Interest": row.addOnInterest,
    "Main Conversation Outcome": row.mainConversationOutcome,
    "Call Summary": row.callSummary ?? "",
    "Next Recommended Action": row.nextRecommendedAction,
    "Failure Reason": row.failureReason ?? "",
    "Last Updated At": formatDateTime(row.lastUpdatedAt),
    "Conversation Quality Flag": row.conversationQualityFlag,
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportedRows, { header: [...HEADERS] });
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!autofilter"] = { ref: `A1:AG${Math.max(exportedRows.length + 1, 1)}` };
  worksheet["!cols"] = HEADERS.map((header) => {
    const longText = ["Customer Objection", "Main Conversation Outcome", "Call Summary", "Next Recommended Action", "Failure Reason"];
    if (longText.includes(header)) return { wch: 34 };
    if (header.includes("Date") || header.includes("Updated")) return { wch: 22 };
    return { wch: Math.min(Math.max(header.length + 2, 14), 24) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Campaign Report");

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Campaign", report.campaign.name],
    ["Status", label(report.campaign.status)],
    ["Total Uploaded", report.campaign.total_rows],
    ["Accepted", report.campaign.accepted_rows],
    ["Rejected", report.campaign.rejected_rows],
    ["Duplicates", report.campaign.duplicate_rows],
    ["Enriched", report.campaign.enriched_rows],
    ["Started At", formatDateTime(report.campaign.started_at)],
    ["Completed At", formatDateTime(report.campaign.completed_at)],
    ["Report Generated At", formatDateTime(new Date().toISOString())],
  ]);
  summarySheet["!cols"] = [{ wch: 22 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  const filename = `${safeFileName(report.campaign.name)}-detailed-report.xlsx`;

  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
