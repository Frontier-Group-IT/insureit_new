import type { PartnerSessionContext } from '@/lib/partner-session';
import { supabase } from '@/lib/supabase';

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
export function canPartnerSearch(context: PartnerSessionContext | null | undefined) {
  return canPartnerAccess(context, 'view_customers')
    || canPartnerAccess(context, 'view_policies')
    || canPartnerAccess(context, 'view_claims');
}

export function canPartnerStartClaim(context: PartnerSessionContext | null | undefined) {
  return context?.identity.actor_kind === 'intermediary'
    ? canPartnerAccess(context, 'view_claims')
    : canPartnerAccess(context, 'manage_claims', 'edit');
}

export function requiredPartnerRoutePermission(pathname: string): {
  capability: string; minimum: Exclude<PermissionLevel, 'none'>
} | null {
  const pathnameNormalized = pathname.replace(/^\/(?:\(tabs\)\/)?/, '/');
  if (pathnameNormalized === '/' || /^\/home(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_dashboard', minimum: 'view' };
  if (/^\/activity(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_notifications', minimum: 'view' };
  if (/^\/policy-intake-new(?:\/|$)/.test(pathnameNormalized)) return { capability: 'create_policy_intakes', minimum: 'edit' };
  if (/^\/customer-new(?:\/|$)/.test(pathnameNormalized)) return { capability: 'create_customers', minimum: 'edit' };
  if (/^\/claim\/(?:new|select-vehicle)(?:\/|$)/.test(pathnameNormalized)) return { capability: 'manage_claims', minimum: 'edit' };
  if (/^\/policy-intakes(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_policy_intakes', minimum: 'view' };
  if (/^\/customers?(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_customers', minimum: 'view' };
  if (/^\/policies(?:\/|$)|^\/policy(?:\/|$)|^\/renewals(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_policies', minimum: 'view' };
  if (/^\/claims(?:\/|$)|^\/claim(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_claims', minimum: 'view' };
  if (/^\/business-report(?:\/|$)|^\/insurers(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_reports', minimum: 'view' };
  if (/^\/business(?:\/|$)|^\/impact(?:\/|$)|^\/pulse(?:\/|$)/.test(pathnameNormalized)) return { capability: 'view_dashboard', minimum: 'view' };
  // Cross-module search is checked against each individual View grant, not Dashboard.
  return null;
}

/** Recheck current effective access before writes; never trust stale navigation state. */
export async function requirePartnerWritePermission(
  capability: string,
  minimum: Exclude<PermissionLevel, 'none'> = 'edit',
  allowPartnerScoped = false,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in again to continue.');
  const url = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
  const response = await fetch(`${url}/api/partner/effective-permissions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Permission verification failed. Refresh your session and retry.');
  const { actor_kind, capabilities } = await response.json() as {
    actor_kind?: string;
    capabilities?: PartnerPermissionMap;
  };
  if (actor_kind === 'intermediary' && allowPartnerScoped) {
    // Existing Partner-scoped write RPCs still enforce business ownership.
    if (rank[capabilities?.view_claims ?? 'none'] >= rank.view) return;
  }
  if (!capabilities || rank[capabilities[capability] ?? 'none'] < rank[minimum]) {
    throw new Error('Your website permission does not allow this action.');
  }
}
