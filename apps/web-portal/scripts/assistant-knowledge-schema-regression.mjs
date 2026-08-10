import {
  ASSISTANT_KNOWLEDGE_HEADERS,
  ASSISTANT_METADATA_HEADERS,
  AssistantKnowledgeValidationError,
  validateAssistantKnowledgeRow,
  validateAssistantMetadata,
} from "../lib/assistant/knowledge-schema.ts";

function fail(message) {
  throw new Error(`[assistant-knowledge-schema] ${message}`);
}
function expectReject(name, callback, fragment) {
  try {
    callback();
  } catch (error) {
    if (error instanceof AssistantKnowledgeValidationError && error.message.toLowerCase().includes(fragment)) return;
    fail(`${name} rejected for the wrong reason: ${error instanceof Error ? error.message : String(error)}`);
  }
  fail(`${name} was accepted`);
}

if (JSON.stringify(ASSISTANT_METADATA_HEADERS) !== JSON.stringify(["Key", "Value"])) fail("Metadata headers drifted");
if (JSON.stringify(ASSISTANT_KNOWLEDGE_HEADERS) !== JSON.stringify(["Route", "Title", "Content", "Tags", "Source Reference", "Required Capabilities"])) fail("Knowledge headers drifted");

const metadata = validateAssistantMetadata([
  { Key: "template_version", Value: "1" },
  { Key: "knowledge_base_name", Value: "Operations handbook" },
  { Key: "owner", Value: "IT" },
  { Key: "classification", Value: "internal" },
]);
if (metadata.classification !== "internal" || metadata.templateVersion !== "1") fail("valid metadata was not normalized");

const valid = validateAssistantKnowledgeRow({
  Route: "/claims/intake",
  Title: "Claim intake checklist",
  Content: "Confirm the claim reference and follow the approved intake checklist.",
  Tags: "claims, intake",
  "Source Reference": "SOP-CLAIMS-01",
  "Required Capabilities": "view_claims",
}, 2);
if (valid.route !== "/claims/intake" || valid.tags.join("|") !== "claims|intake" || valid.requiredCapabilities.join("|") !== "view_claims") fail("valid knowledge row was not normalized");

expectReject("unknown capability", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "Safe operational content.", Tags: "safe", "Source Reference": "SOP-1", "Required Capabilities": "become_superuser" }, 2), "capabilit");
expectReject("missing capability", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "Safe operational content.", Tags: "safe", "Source Reference": "SOP-1", "Required Capabilities": "" }, 2), "required");

expectReject("absolute URL route", () => validateAssistantKnowledgeRow({ Route: "https://evil.example/x", Title: "Safe", Content: "Safe operational content.", Tags: "safe", "Source Reference": "SOP-1" }, 2), "route");
expectReject("traversal route", () => validateAssistantKnowledgeRow({ Route: "/claims/../admin", Title: "Safe", Content: "Safe operational content.", Tags: "safe", "Source Reference": "SOP-1" }, 2), "route");
expectReject("HTML", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "<img src=x onerror=alert(1)>", Tags: "safe", "Source Reference": "SOP-1" }, 2), "html");
expectReject("formula-like text", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "=HYPERLINK(\"x\")", Content: "Safe operational content.", Tags: "safe", "Source Reference": "SOP-1" }, 2), "formula");
expectReject("likely secret", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "api_key = sk_live_12345678901234567890", Tags: "safe", "Source Reference": "SOP-1" }, 2), "secret");
expectReject("PAN", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "Customer PAN is ABCDE1234F", Tags: "safe", "Source Reference": "SOP-1" }, 2), "sensitive identifier");
expectReject("Aadhaar", () => validateAssistantKnowledgeRow({ Route: "/claims", Title: "Safe", Content: "Aadhaar 1234 5678 9012", Tags: "safe", "Source Reference": "SOP-1" }, 2), "sensitive identifier");
expectReject("unexpected metadata", () => validateAssistantMetadata([{ Key: "template_version", Value: "1" }, { Key: "knowledge_base_name", Value: "KB" }, { Key: "owner", Value: "IT" }, { Key: "classification", Value: "internal" }, { Key: "prompt", Value: "store this" }]), "metadata key");

console.log(JSON.stringify({ validRows: 1, rejectedThreatCases: 10, metadataContract: "ok", status: "ok" }, null, 2));
