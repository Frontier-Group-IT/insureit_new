/**
 * Candidate configuration definitions; none are connected to production values.
 * No tokens, customer data, writable endpoints, or business-rule overrides.
 */
export type ConfigValueType = "text" | "boolean" | "image-reference" | "select";
export type ConfigCandidate = Readonly<{
  key: string;
  app: "portal" | "partner" | "customer" | "tech";
  section: string;
  label: string;
  type: ConfigValueType;
  description: string;
  effectiveValue: null;
  state: "proposed";
  rollout: "pending-implementation";
  validation: string;
  requiresAppIntegration: true;
}>;

const define = (
  key: string,
  app: ConfigCandidate["app"],
  section: string,
  label: string,
  type: ConfigValueType,
  description: string,
  validation: string
): ConfigCandidate => ({
  key, app, section, label, type, description, validation,
  effectiveValue: null,
  state: "proposed",
  rollout: "pending-implementation",
  requiresAppIntegration: true
});

export const CONFIGURATION_CANDIDATES: readonly ConfigCandidate[] = [
  define("portal.ui.announcement", "portal", "Content", "Portal announcement", "text", "Proposed non-critical announcement banner text", "max 160 characters; strip markup"),
  define("portal.support.help_url", "portal", "Support", "Help URL", "text", "Proposed help-center destination; no auth/security URL overrides", "https URL; allowlisted hosts"),
  define("partner.home.announcement", "partner", "Home", "Home announcement", "text", "Proposed configurable announcement text in Partner app", "max 140 characters; plain text"),
  define("partner.home.banner_asset", "partner", "Branding", "Banner artwork", "image-reference", "Proposed canonical asset reference; mobile bundle behavior requires review", "asset ID from approved catalogue"),
  define("customer.home.announcement", "customer", "Home", "Home announcement", "text", "Proposed customer-facing announcement text", "max 140 characters; plain text"),
  define("customer.support.help_url", "customer", "Support", "Support link", "text", "Proposed non-sensitive help destination", "https URL; allowlisted hosts"),
  define("tech.site.hero_subtitle", "tech", "Public Site", "Hero subtitle", "text", "Proposed editable non-technical site copy", "max 240 characters; plain text"),
  define("tech.site.show_engineering_links", "tech", "Public Site", "Engineering links visibility", "boolean", "Proposed visibility control for public engineering resource links", "boolean")
] as const;

export const CONFIGURATION_READINESS = {
  registryDesign: "ready",
  connectedProductionKeys: 0,
  publishedRevisions: 0,
  previewEnabledKeys: 1,
  previewEditorEnabled: true,
  draftWritesRequireAal2: true,
  publishEnabled: false,
  rollbackEnabled: false,
  rollbackPreviewEnabled: true,
  databaseSchemaCreated: true,
  auditLedgerCreated: true
} as const;
