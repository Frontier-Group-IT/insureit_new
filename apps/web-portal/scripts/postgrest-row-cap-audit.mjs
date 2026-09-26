import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["app", "components", "lib"];
const highRiskTables = new Set([
  "audit_logs",
  "vehicle_rc_lookup_cache",
  "external_renewal_voice_attempt_events",
  "external_renewal_voice_attempts",
  "voice_campaign_members",
  "intermediary_referrals",
  "customers",
  "commercial_control_events",
  "policy_intermediary_payouts",
  "policies",
  "policy_premium_details",
  "policy_payin_details",
  "policy_documents",
  "external_renewal_opportunities",
  "activities",
  "policy_ocr_training_labels",
  "policy_ocr_training_samples",
  "vehicles",
]);

const explicitBoundingMethods = [".range(", ".limit(", ".single(", ".maybeSingle("];
const mutationMethods = [".insert(", ".upsert(", ".update(", ".delete("];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const findings = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const source = await readFile(file, "utf8");
    const fromPattern = /\.from\(["']([^"']+)["']\)/g;
    for (const match of source.matchAll(fromPattern)) {
      const table = match[1];
      if (!highRiskTables.has(table)) continue;
      const start = match.index ?? 0;
      const semicolon = source.indexOf(";", start);
      const end = semicolon === -1 ? Math.min(source.length, start + 3000) : Math.min(source.length, semicolon + 1);
      const chain = source.slice(start, end);
      if (!chain.includes(".select(")) continue;
      if (mutationMethods.some((method) => chain.includes(method))) continue;
      if (explicitBoundingMethods.some((method) => chain.includes(method))) continue;

      // Query-builder assignments are sometimes bounded a few lines later (for example
      // `let query = ...select(...)` followed by conditional filters and `query.limit(2)`).
      // Treat a nearby explicit bound as safe while still flagging broad list reads.
      const nearby = source.slice(start, Math.min(source.length, start + 1800));
      if (explicitBoundingMethods.some((method) => nearby.includes(method))) continue;

      const line = source.slice(0, start).split("\n").length;
      findings.push({ file, line, table, chain: chain.replace(/\s+/g, " ").slice(0, 500) });
    }
  }
}

if (findings.length) {
  console.error(`Found ${findings.length} potentially unbounded PostgREST reads on high-volume tables:`);
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.table}] ${finding.chain}`);
  }
  process.exit(1);
}

console.log("PostgREST row-cap audit passed: no unbounded high-volume reads detected.");
