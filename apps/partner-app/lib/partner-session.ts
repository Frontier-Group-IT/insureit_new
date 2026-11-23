import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { PartnerPermissionMap } from '@/lib/partner-permissions';

export type PartnerIdentity =
  | {
      actor_kind: 'employee';
      auth_user_id: string;
      profile_id: string;
      role: string;
      employee_id: string;
      employee_code: string;
      display_name: string;
      designation: string | null;
    }
  | {
      actor_kind: 'intermediary';
      auth_user_id: string;
      portal_account_id: string;
      intermediary_id: string;
      intermediary_type: 'partner' | 'posp' | 'misp' | 'group' | 'branch';
      portal_access_type?: 'partner' | 'posp' | 'misp' | 'group' | 'branch' | null;
      branch_id?: string | null;
      intermediary_code: string | null;
      display_name: string;
      partner_id: string;
      partner_code: string;
      partner_name: string;
    };

export type PartnerCommercialScope = {
  actor_kind: 'employee' | 'intermediary';
  scope_mode: 'organization' | 'hierarchy' | 'self' | 'partner_family' | 'none';
  employee_ids: string[];
  partner_ids: string[];
  intermediary_ids: string[];
  group_ids: string[];
  portal_access_type?: 'group' | 'branch' | null;
};

export type PartnerSessionContext = {
  identity: PartnerIdentity;
  scope: PartnerCommercialScope;
  permissions: PartnerPermissionMap;
  can_view_insurer_commercials: boolean;
};

export type PartnerSessionFailureKind = 'denied' | 'retryable';

export class PartnerSessionResolutionError extends Error {
  constructor(
    public readonly kind: PartnerSessionFailureKind,
    public readonly reason: string,
  ) {
    super(reason);
    this.name = 'PartnerSessionResolutionError';
  }
}

/** Never infer account revocation from network, RPC or temporary API errors. */
export function classifyPartnerSessionFailure(error: unknown): PartnerSessionFailureKind {
  return error instanceof PartnerSessionResolutionError ? error.kind : 'retryable';
}

/** Safe, actionable sign-in feedback. Never surface raw RPC data or session credentials. */
export function partnerLoginErrorMessage(error: unknown, phase: 'credentials' | 'account'): string {
  if (phase === 'credentials') {
    const authCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (authCode === 'invalid_credentials' || authCode === 'email_not_confirmed') {
      return authCode === 'email_not_confirmed'
        ? 'Please verify your email address before signing in.'
        : 'The email or password is incorrect. Please try again.';
    }
    return 'Sign-in service is unavailable right now. Check your connection and try again.';
  }
  if (error instanceof PartnerSessionResolutionError) {
    switch (error.reason) {
      case 'partner_identity_not_enabled':
      case 'commercial_scope_missing':
      case 'permission_api_forbidden':
      case 'permission_identity_mismatch':
        return 'Your sign-in succeeded, but Partner access is not enabled for this account. Contact INSUREIT support.';
      case 'session_expired':
      case 'permission_api_unauthorized':
        return 'Your sign-in session could not be verified. Please try signing in again.';
      case 'permission_api_not_deployed':
        return 'Sign-in succeeded, but the Partner permissions service is not available on the website. Please contact INSUREIT support.';
      case 'permission_api_unavailable':
      case 'permission_api_invalid_response':
        return 'Sign-in succeeded, but the Partner permissions service is temporarily unavailable. Please retry shortly.';
    }
  }
  return 'Sign-in succeeded, but your Partner account could not be loaded. Please check your connection and retry.';
}

/** Identify authenticated Branch accounts by server-provided identity/scope—not name or intermediary role alone. */
export function isPartnerBranchSession(context: PartnerSessionContext | null | undefined): boolean {
  if (context?.identity.actor_kind !== 'intermediary') return false;
  return context.identity.portal_access_type === 'branch'
    || context.scope.portal_access_type === 'branch'
    || context.identity.intermediary_type === 'branch'
    || Boolean(context.identity.branch_id);
}


export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function resolvePartnerSession(): Promise<PartnerSessionContext> {
  const { data: existingIdentity, error: identityError } = await supabase.rpc('partner_app_current_identity');
  if (identityError) throw identityError;

  let identity = existingIdentity as PartnerIdentity | null;

  if (!identity) {
    const { data: activatedIdentity, error: activationError } = await supabase.rpc('partner_app_activate_current_account');
    if (activationError) throw activationError;
    identity = activatedIdentity as PartnerIdentity | null;
  }

  if (!identity) throw new PartnerSessionResolutionError('denied', 'partner_identity_not_enabled');

  const { data: scope, error: scopeError } = await supabase.rpc('partner_app_commercial_scope');
  if (scopeError) throw scopeError;
  if (!scope) throw new PartnerSessionResolutionError('denied', 'commercial_scope_missing');
  const session = await getCurrentSession();
  if (!session?.access_token) throw new PartnerSessionResolutionError('retryable', 'session_expired');
  let response: Response;
  try {
    response = await fetch(
      `${(process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '')}/api/partner/effective-permissions`,
      { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
    );
  } catch {
    throw new PartnerSessionResolutionError('retryable', 'permission_api_unavailable');
  }
  if (response.status === 401) throw new PartnerSessionResolutionError('retryable', 'permission_api_unauthorized');
  if (response.status === 403) throw new PartnerSessionResolutionError('denied', 'permission_api_forbidden');
  if (response.status === 404 || response.status === 405) {
    throw new PartnerSessionResolutionError('retryable', 'permission_api_not_deployed');
  }
  if (!response.ok) throw new PartnerSessionResolutionError('retryable', 'permission_api_unavailable');
  let access: {
    actor_kind?: string;
    capabilities?: PartnerPermissionMap;
    can_view_insurer_commercials?: boolean;
  };
  try {
    access = await response.json();
  } catch {
    throw new PartnerSessionResolutionError('retryable', 'permission_api_invalid_response');
  }
  if (!access || typeof access !== 'object' || !access.capabilities || typeof access.capabilities !== 'object') {
    throw new PartnerSessionResolutionError('retryable', 'permission_api_invalid_response');
  }
  if (access.actor_kind !== identity.actor_kind) {
    throw new PartnerSessionResolutionError('denied', 'permission_identity_mismatch');
  }

  return {
    identity,
    scope: scope as PartnerCommercialScope,
    permissions: access.capabilities,
    can_view_insurer_commercials: identity.actor_kind === 'employee' && access.can_view_insurer_commercials === true,
  };
}
