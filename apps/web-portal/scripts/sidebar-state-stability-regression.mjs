import fs from "node:fs";

const source = fs.readFileSync(new URL("../components/claim-manager/app-navigation.tsx", import.meta.url), "utf8");

const checks = [
  [source.includes('useRef<string|null>(null)'), "Sidebar must track the last route pathname independently from render state."],
  [source.includes('if(lastSyncedPathname.current===pathname)return'), "Sidebar route sync must not rerun for unrelated renders on the same pathname."],
  [source.includes('lastSyncedPathname.current=pathname'), "Sidebar must record the pathname after a real route synchronization."],
  [source.includes('setOpenSection(resolved)'), "A real pathname change must still open the section that owns the destination route."],
  [source.includes('setOpenGroups(nextGroups)'), "A real pathname change must deterministically restore only the destination route group."],
  [!source.includes('DESKTOP_SIDEBAR_EXPANDED_EVENT'), "Desktop expansion events must not clear nested navigation state."],
  [!source.includes('setOpenGroups({})'), "Unrelated sidebar events must not wipe nested group expansion state."],
  [source.includes('onClick={()=>setOpenSection(current=>current===section.key?null:section.key)}'), "Top-level manual section toggles must remain locally authoritative."],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  console.error(failed.join("\n"));
  process.exit(1);
}

console.log("Sidebar state stability regression passed.");
