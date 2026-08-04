import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, value) { fs.writeFileSync(file, value); }
function replace(file, from, to) {
  let text = read(file);
  if (!text.includes(from)) return false;
  text = text.replaceAll(from, to);
  write(file, text);
  return true;
}
function addImport(file, line) {
  let text = read(file);
  if (text.includes(line)) return;
  if (text.startsWith('"use server";\n')) text = text.replace('"use server";\n', `"use server";\n\n${line}\n`);
  else if (text.startsWith('"use client";\n')) text = text.replace('"use client";\n', `"use client";\n\n${line}\n`);
  else text = `${line}\n${text}`;
  write(file, text);
}

// Downloaded registration form follows intermediary/customer effective permissions.
{
  const file = "apps/web-portal/app/customers/applications/[id]/registration-form/route.ts";
  let text = read(file);
  text = text.replace('import { canManageMasterData, canManagePospMispOnboarding } from "@/lib/roles";\n', 'import { hasAnyEffectiveCapability } from "@/lib/effective-permissions";\n');
  text = text.replace('if (!actor?.id || (!canManageMasterData(actor.role) && !canManagePospMispOnboarding(actor.role))) {', 'if (!actor?.id || !(await hasAnyEffectiveCapability(actor, ["manage_customers", "create_intermediary_application", "review_intermediary_application"]))) {');
  write(file, text);
}

// Server-rendered action visibility must use employee overrides.
{
  const file = "apps/web-portal/app/dashboard/page.tsx";
  let text = read(file);
  text = text.replace('import { hasCapability } from "@/lib/roles";\n', 'import { hasEffectiveCapability } from "@/lib/effective-permissions";\n');
  text = text.replace('const canCreateCustomer = hasCapability(profile?.role, "manage_customers");', 'const canCreateCustomer = await hasEffectiveCapability(profile, "manage_customers", "edit");');
  text = text.replace('const canReviewKyc = hasCapability(profile?.role, "review_kyc");', 'const canReviewKyc = await hasEffectiveCapability(profile, "review_kyc", "edit");');
  write(file, text);
}
{
  const file = "apps/web-portal/app/customers/posp-misp/page.tsx";
  let text = read(file);
  text = text.replace('import { hasCapability } from "@/lib/roles";\n', 'import { hasEffectiveCapability } from "@/lib/effective-permissions";\n');
  text = text.replace('const canCreate=hasCapability(profile.role,"create_intermediary_application");', 'const canCreate=await hasEffectiveCapability(profile,"create_intermediary_application","edit");');
  text = text.replace('const canReview=hasCapability(profile.role,"review_intermediary_application");', 'const canReview=await hasEffectiveCapability(profile,"review_intermediary_application","edit");');
  write(file, text);
}
for (const file of [
  "apps/web-portal/app/intermediaries/intermediary-register.tsx",
  "apps/web-portal/app/intermediaries/overview-register.tsx",
]) {
  let text = read(file);
  text = text.replace('import { hasCapability } from "@/lib/roles";\n', 'import { hasEffectiveCapability } from "@/lib/effective-permissions";\n');
  text = text.replace('const canReview = hasCapability(profile.role, "review_intermediary_application");', 'const canReview = await hasEffectiveCapability(profile, "review_intermediary_application", "edit");');
  text = text.replace('const canCreate = hasCapability(profile.role, "create_intermediary_application");', 'const canCreate = await hasEffectiveCapability(profile, "create_intermediary_application", "edit");');
  write(file, text);
}

// Resolve all effective access levels once in the server shell.
{
  const file = "apps/web-portal/lib/effective-permissions.ts";
  let text = read(file);
  if (!text.includes('export async function getEffectivePermissionAccessMap')) {
    text += `\nexport async function getEffectivePermissionAccessMap(\n  profile: { id?: string | null; role?: string | null } | null | undefined,\n): Promise<Partial<Record<Capability, PermissionAccess>>> {\n  if (!profile?.id || !isAppRole(profile.role)) return {};\n  const entries = await Promise.all(permissionDefinitions.map(async ({ capability }) => {\n    const permission = await getEffectivePermission(profile.id!, profile.role as import("@/lib/roles").AppRole, capability);\n    return [capability, permission.access] as const;\n  }));\n  return Object.fromEntries(entries) as Partial<Record<Capability, PermissionAccess>>;\n}\n`;
  }
  write(file, text);
}

{
  const file = "apps/web-portal/components/claim-manager/claim-manager-shell.tsx";
  let text = read(file);
  text = text.replace('import { hasCapability } from "@/lib/roles";\n', 'import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";\n');
  text = text.replace('  const role = profile?.role;\n', '  const role = profile?.role;\n  const permissionAccess = await getEffectivePermissionAccessMap(profile);\n  const canViewNotifications = (permissionAccess.view_notifications ?? "none") !== "none";\n');
  text = text.replace('<AppNavigation activeNav={activeNav} role={role} />', '<AppNavigation activeNav={activeNav} role={role} permissionAccess={permissionAccess} />');
  text = text.replace('<MobileNavigation role={role} />', '<MobileNavigation role={role} permissionAccess={permissionAccess} />');
  text = text.replace('!isIntermediaryOnlyLaunch && hasCapability(role,"view_notifications")', '!isIntermediaryOnlyLaunch && canViewNotifications');
  text = text.replace('<MobileBottomNavigation role={role} />', '<MobileBottomNavigation role={role} permissionAccess={permissionAccess} />');
  write(file, text);
}

// Desktop navigation uses effective access and exact minimum level.
{
  const file = "apps/web-portal/components/claim-manager/app-navigation.tsx";
  let text = read(file);
  text = text.replace('import { hasCapability, type Capability } from "@/lib/roles";', 'import type { Capability } from "@/lib/roles";\nimport type { PermissionAccess } from "@/lib/permission-management";');
  text = text.replace('export type NavigationItem={kind?:"item";href:string;label:string;icon:LucideIcon;capability:Capability};', 'export type NavigationItem={kind?:"item";href:string;label:string;icon:LucideIcon;capability:Capability;minimumAccess?:Exclude<PermissionAccess,"none">};');
  text = text.replace('export type NavigationGroup={kind:"group";key:string;label:string;icon:LucideIcon;capability:Capability;items:NavigationItem[]};', 'export type NavigationGroup={kind:"group";key:string;label:string;icon:LucideIcon;capability:Capability;minimumAccess?:Exclude<PermissionAccess,"none">;items:NavigationItem[]};');
  text = text.replace('export type NavigationSection={key:SectionKey;label:string;icon:LucideIcon;tint:string;capability:Capability;items:NavigationNode[]};', 'export type NavigationSection={key:SectionKey;label:string;icon:LucideIcon;tint:string;capability:Capability;minimumAccess?:Exclude<PermissionAccess,"none">;items:NavigationNode[]};');
  text = text.replace('type Props={activeNav:ActiveNav;role:string|null|undefined};', 'type PermissionAccessMap=Partial<Record<Capability,PermissionAccess>>;\ntype Props={activeNav:ActiveNav;role:string|null|undefined;permissionAccess:PermissionAccessMap};');
  text = text.replace('{href:"/vehicles/new",label:"Add Vehicle",icon:Plus,capability:"manage_customers"}', '{href:"/vehicles/new",label:"Add Vehicle",icon:Plus,capability:"view_vehicles",minimumAccess:"edit"}');
  text = text.replace('{href:"/policies/new",label:"Add Policy",icon:Plus,capability:"manage_customers"}', '{href:"/policies/new",label:"Add Policy",icon:Plus,capability:"view_policies",minimumAccess:"edit"}');
  text = text.replace('{href:"/employees/new",label:"Add Employee",icon:UserPlus,capability:"manage_users"}', '{href:"/employees/new",label:"Add Employee",icon:UserPlus,capability:"manage_employees",minimumAccess:"edit"}');
  const oldVisible = 'export function visibleNavigationSections(role:string|null|undefined){const filterNode=(node:NavigationNode):NavigationNode|null=>{if(!hasCapability(role,node.capability))return null;if(node.kind!=="group")return node;const items=node.items.filter(item=>hasCapability(role,item.capability));return items.length?{...node,items}:null};const availableSections=isIntermediaryOnlyLaunch?navigationSections.filter(section=>section.key==="distribution"):navigationSections;const sections=availableSections.filter(section=>hasCapability(role,section.capability)).map(section=>({...section,items:section.items.map(filterNode).filter((node):node is NavigationNode=>Boolean(node))})).filter(section=>section.items.length);return !isIntermediaryOnlyLaunch&&role==="it_super_user"?[...sections,developmentSection]:sections}';
  const newVisible = 'const permissionRank:Record<PermissionAccess,number>={none:0,view:1,edit:2,approve:3};\nexport function permits(permissionAccess:PermissionAccessMap,capability:Capability,minimumAccess:Exclude<PermissionAccess,"none">="view"){return permissionRank[permissionAccess[capability]??"none"]>=permissionRank[minimumAccess]}\nexport function visibleNavigationSections(role:string|null|undefined,permissionAccess:PermissionAccessMap){const filterNode=(node:NavigationNode):NavigationNode|null=>{if(!permits(permissionAccess,node.capability,node.minimumAccess))return null;if(node.kind!=="group")return node;const items=node.items.filter(item=>permits(permissionAccess,item.capability,item.minimumAccess));return items.length?{...node,items}:null};const availableSections=isIntermediaryOnlyLaunch?navigationSections.filter(section=>section.key==="distribution"):navigationSections;const sections=availableSections.filter(section=>permits(permissionAccess,section.capability,section.minimumAccess)).map(section=>({...section,items:section.items.map(filterNode).filter((node):node is NavigationNode=>Boolean(node))})).filter(section=>section.items.length);return !isIntermediaryOnlyLaunch&&permits(permissionAccess,"manage_system","approve")?[...sections,developmentSection]:sections}';
  text = text.replace(oldVisible, newVisible);
  text = text.replace('export function AppNavigation({activeNav,role}:Props){', 'export function AppNavigation({activeNav,role,permissionAccess}:Props){');
  text = text.replace('visibleNavigationSections(role),[role]', 'visibleNavigationSections(role,permissionAccess),[role,permissionAccess]');
  text = text.replace('!isIntermediaryOnlyLaunch&&hasCapability(role,"view_dashboard")', '!isIntermediaryOnlyLaunch&&permits(permissionAccess,"view_dashboard")');
  text = text.replace('{!isIntermediaryOnlyLaunch?<div className="relative border-t', '{!isIntermediaryOnlyLaunch&&permits(permissionAccess,"manage_system","approve")?<div className="relative border-t');
  write(file, text);
}

// Mobile drawer consumes the same effective map.
{
  const file = "apps/web-portal/components/claim-manager/mobile-navigation.tsx";
  let text = read(file);
  text = text.replace('import { isCurrent, sectionForPath, visibleNavigationSections, type NavigationGroup, type NavigationItem }', 'import { isCurrent, permits, sectionForPath, visibleNavigationSections, type NavigationGroup, type NavigationItem }');
  text = text.replace('import { hasCapability } from "@/lib/roles";', 'import type { Capability } from "@/lib/roles";\nimport type { PermissionAccess } from "@/lib/permission-management";');
  text = text.replace('export function MobileNavigation({role}:{role:string|null|undefined}) {', 'export function MobileNavigation({role,permissionAccess}:{role:string|null|undefined;permissionAccess:Partial<Record<Capability,PermissionAccess>>}) {');
  text = text.replace('visibleNavigationSections(role),[role]', 'visibleNavigationSections(role,permissionAccess),[role,permissionAccess]');
  text = text.replace('!isIntermediaryOnlyLaunch&&hasCapability(role,"view_dashboard")', '!isIntermediaryOnlyLaunch&&permits(permissionAccess,"view_dashboard")');
  text = text.replace('{!isIntermediaryOnlyLaunch?<div className="mt-4', '{!isIntermediaryOnlyLaunch&&permits(permissionAccess,"manage_system","approve")?<div className="mt-4');
  write(file, text);
}

// Mobile quick navigation uses effective permissions.
{
  const file = "apps/web-portal/components/claim-manager/mobile-bottom-navigation.tsx";
  let text = read(file);
  text = text.replace('import { hasCapability, type Capability } from "@/lib/roles";', 'import type { Capability } from "@/lib/roles";\nimport type { PermissionAccess } from "@/lib/permission-management";');
  text = text.replace('{href:"/settings",label:"More",icon:Menu,capability:null}', '{href:"/settings",label:"More",icon:Menu,capability:"manage_system"}');
  text = text.replace('export function MobileBottomNavigation({role}:{role:string|null|undefined}) {\n  const pathname=usePathname();const items=isIntermediaryOnlyLaunch?intermediaryItems:standardItems;const visible=items.filter(item=>!item.capability||hasCapability(role,item.capability));', 'export function MobileBottomNavigation({role: _role,permissionAccess}:{role:string|null|undefined;permissionAccess:Partial<Record<Capability,PermissionAccess>>}) {\n  const pathname=usePathname();const items=isIntermediaryOnlyLaunch?intermediaryItems:standardItems;const rank:Record<PermissionAccess,number>={none:0,view:1,edit:2,approve:3};const visible=items.filter(item=>!item.capability||rank[permissionAccess[item.capability]??"none"]>=rank[item.capability==="manage_system"?"approve":"view"]);');
  write(file, text);
}

// Do not let a permission administrator remove their own critical administration access.
{
  const file = "apps/web-portal/app/system/access-control/actions.ts";
  let text = read(file);
  text = text.replace('if (profileId === actor.id && (capability === "manage_users" || capability === "manage_system") && access === "none") redirect(`${returnTo}?error=${encodeURIComponent("You cannot remove your own critical administration access")}`);', 'if (profileId === actor.id && (capability === "manage_users" || capability === "manage_system") && access !== "inherit" && access !== "approve") redirect(withMessage(returnTo, "error", "You cannot reduce your own critical administration access below Approve / critical"));');
  write(file, text);
}

console.log("Final effective permission alignment applied.");
