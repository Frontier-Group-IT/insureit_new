import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const campaigns = readFileSync(resolve(process.cwd(), "lib/voice-campaigns.ts"), "utf8");
const route = readFileSync(
  resolve(process.cwd(), "app/api/system/voice-integration/campaigns/[id]/export/route.ts"),
  "utf8",
);

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) throw new Error(`${label} missing: ${expected}`);
}

function assertExcludes(source, unexpected, label) {
  if (source.includes(unexpected)) throw new Error(`${label} must not contain: ${unexpected}`);
}

const reportStart = campaigns.indexOf("export async function getVoiceCampaignReportRows");
if (reportStart < 0) throw new Error("voice campaign report function missing");
const reportSource = campaigns.slice(reportStart);

for (const expected of [
  "const VOICE_CAMPAIGN_REPORT_PAGE_SIZE = 500",
  "const VOICE_CAMPAIGN_REPORT_ID_CHUNK_SIZE = 100",
  '.from("voice_campaign_members")',
  ".range(offset, offset + VOICE_CAMPAIGN_REPORT_PAGE_SIZE - 1)",
  "const opportunityIds = [...new Set(memberRows.map((row) => row.opportunity_id))]",
  "opportunityIds.slice(index, index + VOICE_CAMPAIGN_REPORT_ID_CHUNK_SIZE)",
  '.from("external_renewal_voice_attempts")',
  '.eq("voice_campaign_id", campaignId)',
  "attemptIds.slice(index, index + VOICE_CAMPAIGN_REPORT_ID_CHUNK_SIZE)",
  '.from("external_renewal_voice_attempt_events")',
  '.select("id,voice_attempt_id,failure_reason,created_at")',
]) {
  assertIncludes(campaigns, expected, "large campaign export");
}

assertExcludes(reportSource, ".limit(100)", "large campaign report");

for (const expected of [
  'viewer.role !== "it_super_user"',
  'hasEffectiveCapability(viewer, "manage_system", "approve")',
  '"Mobile Number": maskMobile(row.mobileNumber)',
  '"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"',
]) {
  assertIncludes(route, expected, "export route safety");
}

console.log("voice campaign large export regression passed");
