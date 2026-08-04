import fs from "node:fs";
import path from "node:path";

const roots = ["apps/web-portal/app", "apps/web-portal/lib", "apps/web-portal/components"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const patterns = [
  ["MASTER_DATA_GUARD", /requireMasterDataManager\s*\(/g],
  ["DIRECT_ROLE_LIST", /\[(?:\s*["'][a-z_]+["']\s*,?){2,}\]\.includes\([^\n]+role/g],
  ["DIRECT_ROLE_EQUALITY", /(?:profile|viewer|user|actor)\??\.role\s*(?:===|!==)\s*["'][a-z_]+["']/g],
  ["LEGACY_HAS_CAPABILITY", /\bhasCapability\s*\(/g],
  ["LEGACY_ROLE_CAPABILITIES", /\broleCapabilities\b/g],
  ["LEGACY_CAN_ROLE_HELPER", /\bcan(?:Manage|View|Review|Approve|Activate|Update|Verify)[A-Z][A-Za-z]+\s*\(/g],
  ["ACCESS_DENIED_REDIRECT", /redirect\s*\(\s*["']\/access-denied["']\s*\)/g],
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (extensions.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const findings = [];
for (const root of roots) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (const [kind, regex] of patterns) {
      for (let i = 0; i < lines.length; i += 1) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) findings.push({ kind, file, line: i + 1, text: lines[i].trim().slice(0, 400) });
      }
    }
  }
}

findings.sort((a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file) || a.line - b.line);
for (const item of findings) console.log(`${item.kind}\t${item.file}:${item.line}\t${item.text}`);
console.log(`\nTOTAL_FINDINGS=${findings.length}`);
