import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isSafeAssistantHref,
  limitAssistantReplyLinks,
  normalizeAssistantReply,
} from "../components/assistant/assistant-response.ts";
import {
  developmentNavigationSection,
  navigationCatalogue,
  visibleNavigationCatalogue,
} from "../lib/navigation-catalogue.ts";

const serialized = JSON.stringify(navigationCatalogue);
assert.ok(serialized.includes('"/claims"'), "catalogue exposes route paths");
assert.ok(serialized.includes('"view_claims"'), "catalogue exposes route capabilities");
assert.ok(!serialized.includes("icon"), "catalogue stays serializable and UI-library free");

const catalogueRoutes = [...navigationCatalogue, developmentNavigationSection].flatMap((section) =>
  section.items.flatMap((node) => node.kind === "group" ? node.items.map((entry) => entry.href) : [node.href]),
);
assert.deepEqual(catalogueRoutes, [
  "/claims",
  "/claims?queue=documents",
  "/claims?journey=spot-intimation",
  "/claims?journey=spot-surveyor-assigned",
  "/claims?journey=under-repair",
  "/claims?journey=payment-advice-received",
  "/intermediaries/partner",
  "/intermediaries/portal-users",
  "/intermediaries/posp",
  "/intermediaries/posp/new",
  "/customers/posp-misp/existing/new?partner_type=posp",
  "/intermediaries/misp",
  "/intermediaries/misp/new",
  "/customers/posp-misp/existing/new?partner_type=misp",
  "/customers/posp-misp",
  "/customers",
  "/customers?choose_partner=1",
  "/customers/applications",
  "/customer-kyc",
  "/customers/new?partner_type=individual_proprietor",
  "/customers/dealership-type",
  "/customers/new?partner_type=corporate",
  "/customers/new?partner_type=group",
  "/vehicles",
  "/vehicles/new",
  "/policies",
  "/policies/new",
  "/master-data/vehicle-manufacturers",
  "/master-data/vehicle-manufacturers/new",
  "/employees",
  "/employees/new",
  "/tasks",
  "/tasks?status=open",
  "/tasks?status=in_progress",
  "/tasks?status=overdue",
  "/tasks?status=completed",
  "/customers/posp-misp/icall-uat",
  "/customers/posp-misp/import",
  "/customers/posp-misp/import/batches",
  "/system/assistant-knowledge",
], "shared catalogue preserves every existing sidebar route and order");

const claimsOnly = visibleNavigationCatalogue(
  { view_claims: "view", manage_claims: "none" },
  { role: "claim_processor", intermediaryOnly: false },
);
assert.deepEqual(
  claimsOnly.flatMap((section) => section.items.flatMap((node) => node.kind === "group" ? node.items.map((item) => item.href) : [node.href])),
  ["/claims", "/claims?queue=documents"],
  "navigation removes routes whose capability is denied",
);

const editableFleet = visibleNavigationCatalogue(
  { view_customers: "view", view_vehicles: "edit", view_policies: "view" },
  { role: "manager", intermediaryOnly: false },
);
assert.ok(
  editableFleet.some((section) => section.items.some((node) => node.kind === "group" && node.items.some((item) => item.href === "/vehicles/new"))),
  "minimum edit access exposes editable routes",
);

const superUserSections = visibleNavigationCatalogue(
  { manage_system: "approve" },
  { role: "it_super_user", intermediaryOnly: false },
);
assert.deepEqual(superUserSections.map((section) => section.key), ["development"], "development sidebar parity keeps the super-user approval gate");
assert.equal(superUserSections[0].items.some((item) => item.kind === "item" && item.href === "/system/assistant-knowledge"), false, "knowledge administration respects an effective capability denial");
const knowledgeManagerSections = visibleNavigationCatalogue(
  { manage_system: "approve", manage_assistant_knowledge: "approve" },
  { role: "it_super_user", intermediaryOnly: false },
);
assert.equal(knowledgeManagerSections[0].items.some((item) => item.kind === "item" && item.href === "/system/assistant-knowledge"), true, "knowledge administration appears only with effective approval access");
assert.deepEqual(
  visibleNavigationCatalogue({ manage_system: "approve" }, { role: "manager", intermediaryOnly: false }),
  [],
  "development routes stay hidden from other roles",
);

const appNavigationSource = readFileSync(new URL("../components/claim-manager/app-navigation.tsx", import.meta.url), "utf8");
assert.match(appNavigationSource, /pathname===\"\/system\/assistant-knowledge\"[^;]*return\"development\"/, "knowledge administration activates the development sidebar section");
assert.match(appNavigationSource, /from "@\/lib\/navigation-catalogue"/, "sidebar consumes the shared catalogue");
assert.doesNotMatch(appNavigationSource, /href:\s*"\/claims"/, "sidebar does not retain a second route catalogue");

assert.equal(isSafeAssistantHref("/claims?queue=documents"), true);
for (const unsafe of ["https://example.com", "//example.com", "javascript:alert(1)", "/\\evil"]) {
  assert.equal(isSafeAssistantHref(unsafe), false, `rejects unsafe assistant href ${unsafe}`);
}
const normalizedReply = normalizeAssistantReply({
  answer: "You can open the claims queue.",
  links: [
    { label: "Claims", href: "/claims" },
    { label: "Unsafe", href: "https://example.com" },
  ],
});
assert.deepEqual(normalizedReply, {
  text: "You can open the claims queue.",
  links: [{ label: "Claims", href: "/claims" }],
});
assert.deepEqual(
  limitAssistantReplyLinks(
    { text: "Choose a route.", links: [{ label: "Claims", href: "/claims" }, { label: "Settings", href: "/settings" }] },
    new Set(["/claims"]),
  ),
  { text: "Choose a route.", links: [{ label: "Claims", href: "/claims" }] },
  "assistant renders only permission-filtered catalogue links",
);
assert.equal(normalizeAssistantReply({ answer: "   " }), null, "blank answers become the no-answer state");

const assistantSource = readFileSync(new URL("../components/assistant/assistant-launcher.tsx", import.meta.url), "utf8");
for (const required of [
  'fetch("/api/assistant/chat"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-live="polite"',
  'event.key === "Escape"',
  "previousFocusRef.current?.focus()",
  "AbortController",
  "pathname",
  "md:",
]) assert.ok(assistantSource.includes(required), `assistant UI includes ${required}`);
assert.doesNotMatch(assistantSource, /navigation:\s*availableNavigation/, "client does not submit authorization-sensitive navigation scope");
assert.match(assistantSource, /messages:\s*\[/, "client submits the bounded API message contract");
assert.match(assistantSource, /currentPath:\s*pathname/, "client submits the validated current-path contract");
assert.doesNotMatch(assistantSource, /\bmessage:\s*cleanQuestion/, "client does not use the obsolete single-message contract");
assert.doesNotMatch(assistantSource, /\bhistory:/, "client does not use the obsolete history contract");
assert.doesNotMatch(assistantSource, /dangerouslySetInnerHTML/, "assistant renders no arbitrary HTML");
assert.doesNotMatch(assistantSource, /localStorage|sessionStorage|indexedDB/, "conversation history remains ephemeral in component memory");
assert.ok(
  assistantSource.split('bottom-[calc(max(.5rem,env(safe-area-inset-bottom))+70px)]').length - 1 >= 2,
  "mobile launcher and dialog clear the fixed bottom navigation and safe-area inset",
);
assert.match(assistantSource, /setStatus\("idle"\);\s*setOpen\(false\)/, "closing an in-flight request restores an interactive state");
assert.match(assistantSource, /!dialogRef\.current\.contains\(document\.activeElement\)/, "focus trap recovers focus when a disabled control drops focus");
assert.doesNotMatch(assistantSource, /handleDialogKeyDown/, "dialog does not intercept Escape before the document close handler");

const shellSource = readFileSync(new URL("../components/claim-manager/claim-manager-shell.tsx", import.meta.url), "utf8");
assert.match(shellSource, /use_assistant/, "shell gates the launcher on the assistant capability");
assert.match(shellSource, /<AssistantLauncher/, "authenticated internal shell owns the launcher mount");

console.log("assistant navigation catalogue regression: ok");
