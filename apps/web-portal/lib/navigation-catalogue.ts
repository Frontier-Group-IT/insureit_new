import type { Capability } from "./roles.ts";
import type { PermissionAccess } from "./permission-management.ts";

export type NavigationSectionKey = "claims" | "distribution" | "master-data" | "tasks" | "reports" | "development";
export type NavigationMinimumAccess = Exclude<PermissionAccess, "none">;
export type NavigationPermissionMap = Partial<Record<Capability, PermissionAccess>>;

export type NavigationCatalogueItem = {
  kind: "item";
  href: string;
  label: string;
  presentationKey: string;
  capability: Capability;
  minimumAccess?: NavigationMinimumAccess;
};

export type NavigationCatalogueGroup = {
  kind: "group";
  key: string;
  label: string;
  presentationKey: string;
  capability: Capability;
  minimumAccess?: NavigationMinimumAccess;
  items: NavigationCatalogueItem[];
};

export type NavigationCatalogueNode = NavigationCatalogueItem | NavigationCatalogueGroup;
export type NavigationCatalogueSection = {
  key: NavigationSectionKey;
  label: string;
  presentationKey: string;
  tint: string;
  capability: Capability;
  minimumAccess?: NavigationMinimumAccess;
  items: NavigationCatalogueNode[];
};

const item = (href: string, label: string, presentationKey: string, capability: Capability, minimumAccess?: NavigationMinimumAccess): NavigationCatalogueItem => ({ kind: "item", href, label, presentationKey, capability, ...(minimumAccess ? { minimumAccess } : {}) });

export const navigationCatalogue: NavigationCatalogueSection[] = [
  { key: "claims", label: "Claims", presentationKey: "shield-check", tint: "from-[#ff6f61] to-[#ff9f68]", capability: "view_claims", items: [
    item("/claims", "All Claims", "clipboard-list", "view_claims"),
    { kind: "group", key: "claim-queues", label: "Work Queues", presentationKey: "gauge", capability: "view_claims", items: [
      item("/claims?queue=documents", "Documents", "file-check", "view_claims"),
      item("/claims?journey=spot-intimation", "Verification", "check-square", "manage_claims"),
      item("/claims?journey=spot-surveyor-assigned", "Survey", "gauge", "manage_claims"),
      item("/claims?journey=under-repair", "Under Repair", "settings", "manage_claims"),
      item("/claims?journey=payment-advice-received", "Settlement", "bar-chart", "manage_claims"),
    ] },
  ] },
  { key: "distribution", label: "Intermediatory", presentationKey: "sparkles", tint: "from-[#17c7c9] to-[#6759ff]", capability: "view_intermediaries", items: [
    { kind: "group", key: "partners", label: "Partners", presentationKey: "users", capability: "view_intermediaries", items: [
      item("/intermediaries/partner", "All Partner", "users", "view_intermediaries"),
      item("/intermediaries/portal-users", "Portal Users", "user-cog", "review_intermediary_application"),
    ] },
    { kind: "group", key: "posp", label: "POSP", presentationKey: "users", capability: "view_intermediaries", items: [
      item("/intermediaries/posp", "All POSP", "users", "view_intermediaries"),
      item("/intermediaries/posp/new", "Add POSP", "user-plus", "create_intermediary_application"),
      item("/customers/posp-misp/existing/new?partner_type=posp", "Add Existing POSP", "user-plus", "create_intermediary_application"),
    ] },
    { kind: "group", key: "misp", label: "MISP", presentationKey: "users", capability: "view_intermediaries", items: [
      item("/intermediaries/misp", "All MISP", "users", "view_intermediaries"),
      item("/intermediaries/misp/new", "Add MISP", "user-plus", "create_intermediary_application"),
      item("/customers/posp-misp/existing/new?partner_type=misp", "Add Existing MISP", "user-plus", "create_intermediary_application"),
    ] },
    { kind: "group", key: "intermediary-onboarding", label: "Onboarding", presentationKey: "file-check", capability: "view_intermediaries", items: [
      item("/customers/posp-misp", "Pending Applications", "file-check", "view_intermediaries"),
    ] },
  ] },
  { key: "master-data", label: "Customers & Fleet", presentationKey: "layout-grid", tint: "from-[#6759ff] to-[#8f7cff]", capability: "view_customers", items: [
    { kind: "group", key: "customers", label: "Customers", presentationKey: "users", capability: "view_customers", items: [
      item("/customers", "Customer Register", "users", "view_customers"),
      item("/customers?choose_partner=1", "Add Customer", "plus", "manage_customers"),
      item("/customers/applications", "Onboarding Applications", "file-check", "review_kyc"),
      item("/customer-kyc", "Customer KYC", "file-check", "view_kyc"),
    ] },
    { kind: "group", key: "customer-types", label: "Add by Customer Type", presentationKey: "user-plus", capability: "manage_customers", items: [
      item("/customers/new?partner_type=individual_proprietor", "Individual / Proprietor", "user-plus", "manage_customers"),
      item("/customers/dealership-type", "Dealership", "user-plus", "manage_customers"),
      item("/customers/new?partner_type=corporate", "Corporate", "user-plus", "manage_customers"),
      item("/customers/new?partner_type=group", "Group", "user-plus", "manage_customers"),
    ] },
    { kind: "group", key: "fleet", label: "Fleet Management", presentationKey: "gauge", capability: "view_vehicles", items: [
      item("/vehicles", "Vehicle Register", "gauge", "view_vehicles"),
      item("/vehicles/new", "Add Vehicle", "plus", "view_vehicles", "edit"),
      item("/policies", "Policy Register", "shield-check", "view_policies"),
      item("/policies/new", "Add Policy", "plus", "view_policies", "edit"),
    ] },
    { kind: "group", key: "reference-master", label: "Master Data", presentationKey: "settings", capability: "manage_master_data", items: [
      item("/master-data/vehicle-manufacturers", "Vehicle Manufacturers", "settings", "manage_master_data"),
      item("/master-data/vehicle-manufacturers/new", "Add Manufacturer", "plus", "manage_master_data", "edit"),
    ] },
    { kind: "group", key: "employees", label: "Employees", presentationKey: "users", capability: "view_employees", items: [
      item("/employees", "Employee Directory", "users", "view_employees"),
      item("/employees/new", "Add Employee", "user-plus", "manage_employees", "edit"),
    ] },
  ] },
  { key: "tasks", label: "Tasks", presentationKey: "check-square", tint: "from-[#17c7c9] to-[#62ddd3]", capability: "view_tasks", items: [
    item("/tasks", "All Tasks", "check-square", "view_tasks"),
    item("/tasks?status=open", "Open", "clipboard-list", "view_tasks"),
    item("/tasks?status=in_progress", "In Progress", "gauge", "view_tasks"),
    item("/tasks?status=overdue", "Overdue", "gauge", "view_tasks"),
    item("/tasks?status=completed", "Completed", "file-check", "view_tasks"),
  ] },
];

export const developmentNavigationSection: NavigationCatalogueSection = { key: "development", label: "Development", presentationKey: "flask", tint: "from-[#7C3AED] to-[#2563EB]", capability: "manage_system", items: [
  item("/customers/posp-misp/icall-uat", "iCall UAT Integration", "flask", "manage_system"),
  item("/customers/posp-misp/import", "Bulk POSP / MISP Import", "upload", "manage_system"),
  item("/customers/posp-misp/import/batches", "Import History", "clipboard-list", "manage_system"),
] };

const permissionRank: Record<PermissionAccess, number> = { none: 0, view: 1, edit: 2, approve: 3 };
export function navigationPermits(permissionAccess: NavigationPermissionMap, capability: Capability, minimumAccess: NavigationMinimumAccess = "view") {
  return permissionRank[permissionAccess[capability] ?? "none"] >= permissionRank[minimumAccess];
}

function dedupeItems(items: NavigationCatalogueItem[]) {
  const seen = new Set<string>();
  return items.filter((entry) => {
    const key = `${entry.href}::${entry.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function visibleNavigationCatalogue(permissionAccess: NavigationPermissionMap, options: { role: string | null | undefined; intermediaryOnly: boolean }) {
  const filterNode = (node: NavigationCatalogueNode): NavigationCatalogueNode | null => {
    if (!navigationPermits(permissionAccess, node.capability, node.minimumAccess)) return null;
    if (node.kind === "item") return node;
    const items = dedupeItems(node.items.filter((entry) => navigationPermits(permissionAccess, entry.capability, entry.minimumAccess)));
    return items.length ? { ...node, items } : null;
  };
  const available = options.intermediaryOnly ? navigationCatalogue.filter((section) => section.key === "distribution") : navigationCatalogue;
  const sections = available
    .filter((section) => navigationPermits(permissionAccess, section.capability, section.minimumAccess))
    .map((section) => ({ ...section, items: section.items.map(filterNode).filter((node): node is NavigationCatalogueNode => Boolean(node)) }))
    .filter((section) => section.items.length);
  return !options.intermediaryOnly && options.role === "it_super_user" && navigationPermits(permissionAccess, "manage_system", "approve")
    ? [...sections, developmentNavigationSection]
    : sections;
}
