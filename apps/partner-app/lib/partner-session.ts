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
};

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

  if (!identity) throw new Error('This account is not enabled for INSUREIT Partner.');

  const { data: scope, error: scopeError } = await supabase.rpc('partner_app_commercial_scope');
  if (scopeError) throw scopeError;
  if (!scope) throw new Error('Commercial access scope is unavailable.');
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('The Partner session expired.');
  const response = await fetch(
    `${(process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '')}/api/partner/effective-permissions`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
  );
  if (!response.ok) throw new Error('Permissions could not be verified. Sign in again or retry.');
  const access = await response.json() as {
    actor_kind?: string;
    capabilities?: PartnerPermissionMap;
  };
  if (access.actor_kind !== identity.actor_kind || !access.capabilities) {
    throw new Error('Partner authorization does not match the current account.');
  }

  return {
    identity,
    scope: scope as PartnerCommercialScope,
    permissions: access.capabilities,
  };
}
