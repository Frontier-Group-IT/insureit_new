import fs from "node:fs";

const frame = fs.readFileSync(new URL("../components/claim-manager/desktop-sidebar-frame.tsx", import.meta.url), "utf8");
const nav = fs.readFileSync(new URL("../components/claim-manager/app-navigation.tsx", import.meta.url), "utf8");

const checks = [
  [frame.includes(".desktop-sidebar-collapsed > aside nav > div > a,"), "Collapsed sidebar must style direct workspace links such as Service Enquiries."],
  [frame.includes(".desktop-sidebar-collapsed > aside nav > div > a > span:first-child,"), "Collapsed direct workspace links must keep their icon tile sizing."],
  [frame.includes(".desktop-sidebar-collapsed > aside nav > div > a > .flex-1,"), "Collapsed direct workspace links must hide their text label."],
  [nav.includes('<span className="flex-1">Settings</span>'), "Settings label must participate in the collapsed text-hiding rule."],
  [nav.includes('data-sidebar-label="Service Enquiries"'), "Service Enquiries must retain its collapsed hover tooltip label."],
  [nav.includes('data-sidebar-label="Settings"'), "Settings must retain its collapsed hover tooltip label."],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1);
}

console.log("Collapsed sidebar direct-link regression passed.");
