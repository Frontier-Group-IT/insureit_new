import type { PartnerSessionContext } from '@/lib/partner-session';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'approve';
export type PartnerPermissionMap = Record<string, PermissionLevel>;

const rank: Record<PermissionLevel, number> = { none: 0, view: 1, edit: 2, approve: 3 };

/** Deny unknown, absent or untrusted capabilities by default. */
export function canPartnerAccess(
  context: PartnerSessionContext | null | undefined,
  capability: string,
  minimum: Exclude<PermissionLevel, 'none'> = 'view',
) {
  return Boolean(context?.permissions && rank[context.permissions[capability] ?? 'none'] >= rank[minimum]);
}

/** Partner submitter operations are distinct from internal claim-processing authority. */
export function canPartnerStartClaim(context: PartnerSessionContext | null | undefined) {
  return context?.identity.actor_kind === 'intermediary'
    ? canPartnerAccess(context, 'view_claims')
    : canPartnerAccess(context, 'manage_claims', 'edit');
}

export function requiredPartnerRoutePermission(pathname: string): {
  capability: string; minimum: Exclude<PermissionLevel, 'none'>
} | null {
  const pathnameNormalized = pathname.replace(/^\/(?:\(tabs\)\/)?/, '/');
  if (/^\/policy-intake-new(?:\/|$)/.test(pathnameNormalized)) return { capability: 'create_policy_intakes', minimum: 'edit' };
  if (/^\/customer-new(?:\/|$)/.test(pathnameNormalized)) return { capability: 'create_customers', minimum: 'edit' };
  if (/^\/claim\/(?:new|select-vehicle)(?:\/|$)/.test(pathnameNormalized)) return { capability: 'manage_claims', minimum: 'edit' };
  if (/^\/policy-intakes(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_policy_intakes', minimum: 'view' };
  if (/^\/customers?(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_customers', minimum: 'view' };
  if (/^\/policies(?:\/|$)|^\/policy(?:\/|$)|^\/renewals(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_policies', minimum: 'view' };
  if (/^\/claims(?:\/|$)|^\/claim(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_claims', minimum: 'view' };
  if (/^\/business(?:\/|$)|^\/business-report(?:\/|$)|^\/insurers(?:\/|$)|^\/impact(?:\/|$)|^\/pulse(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_dashboard', minimum: 'view' };
  if (/^\/search(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_dashboard', minimum: 'view' };
  return null;
}
