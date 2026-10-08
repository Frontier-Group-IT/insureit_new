import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/intermediaries/intermediary-register.tsx", import.meta.url), "utf8");

function requireText(text, message) {
  if (!source.includes(text)) throw new Error(message);
}

requireText("buildPartnerRegisterMetrics(admin, partnerCountRows, applicationMap)", "Partner Register must load commercial metrics in one server-side aggregation path.");
requireText('.from("posp_misp_onboarding_profiles")', "Partner family metrics must include linked POSP/MISP onboarding profiles.");
requireText('.from("customers")', "Partner Register metrics must count attributed customers.");
requireText("lead_source_intermediary_id", "Customer attribution must use the canonical lead-source intermediary relationship.");
requireText('.from("policies")', "Partner Register metrics must load policies by intermediary family.");
requireText('.from("policy_premium_details")', "Net Premium must come from policy premium details.");
requireText("net_premium", "Net Premium aggregation field is missing.");
requireText('.from("policy_intermediary_payouts")', "Payout metrics must use policy intermediary payouts.");
requireText("partner_payout_amount", "Partner payout amount must be preferred when payout basis exists.");
requireText("gross_payout", "Legacy payout rows must retain gross payout fallback.");
requireText("customerCount: metrics?.customerCount", "Partner Register customer column is not wired to metrics.");
requireText("netPremium: metrics?.netPremium", "Partner Register Net Premium column is not wired to metrics.");
requireText("payout: metrics?.payout", "Partner Register Payout column is not wired to metrics.");
requireText("loadPagedRows", "Partner Register high-volume metric reads must remain paged.");

if (source.includes("customerCount: null,\n        netPremium: null,\n        payout: null")) {
  throw new Error("Partner Register metrics regressed to hard-coded null values.");
}

console.log("Partner Register customer, net premium and payout metrics regression OK.");
