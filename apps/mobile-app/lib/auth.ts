import type { Session, User } from '@supabase/supabase-js';
import { Router } from 'expo-router';

import { supabase } from './supabase';
import type { AppRole, Customer, Profile } from './types';
import { isSalesHierarchyRole, isStaffRole } from './roles';

export const validRoles: AppRole[] = [
  'customer',
  'director',
  'sales_head',
  'zonal_head',
  'asm',
  'sales_manager',
  'agent',
  'it_super_user',
  'backoffice_executive',
  'field_executive',
  'claim_processor',
  'manager',
  'admin',
  'super_admin',
];

export const claimStatuses = [
  'Draft',
  'Accident Reported',
  'Initial Documents Pending',
  'Initial Documents Verification Pending',
  'Initial Documents Submitted',
  'Initial Documents Verified',
  'Documents Pending',
  'Documents Submitted',
  'Claim Intimated',
  'Surveyor Appointed',
  'Vehicle Inspected',
  'Final Documents Awaited',
  'Final Documents Verification Pending',
  'Final Documents Submitted',
  'Final Documents Verified',
  'Claim Intimation',
  'Final Surveyor Details',
  'Survey Status',
  'Survey Done',
  'Work Approval Status',
  'Work Approval Received',
  'Under Repair',
  'Repair Done',
  'RA Intimation',
  'RA Intimation Done',
  'DO Status',
  'Payment Stage',
  'Claim Completion In Progress',
  'Claim Complete',
  'Estimate Submitted',
  'Approval Pending',
  'Repair Started',
  'Repair Completed',
  'DO Submitted',
  'Final Bill Submitted',
  'Settlement Under Process',
  'Settled',
  'Rejected',
  'Closed',
] as const;

export function routeForRole(role: AppRole) {
  if (role === 'customer') return '/customer/home' as const;
  if (role === 'agent') return '/agent/dashboard' as const;
  if (isSalesHierarchyRole(role)) return '/hierarchy/dashboard' as const;
  if (role === 'admin' || role === 'super_admin') return '/admin/dashboard' as const;
  if (role === 'it_super_user') return '/it/dashboard' as const;
  if (isStaffRole(role)) return '/staff/dashboard' as const;
  return '/access-denied' as const;
}

export function isValidProfile(profile: Profile | null): profile is Profile {
  return Boolean(profile?.is_active && validRoles.includes(profile.role));
}

export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerForUser(userId: string): Promise<Customer | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('profile_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureCustomerForUser(user: User): Promise<Customer | null> {
  const existing = await getCustomerForUser(user.id);
  if (existing) return existing;

  const profile = await getProfile(user.id);
  if (!isValidProfile(profile) || profile.role !== 'customer') return null;

  const fallbackName = profile.full_name && profile.full_name !== 'New user' ? profile.full_name : 'Customer';
  const { data, error } = await supabase
    .from('customers')
    .insert({
      profile_id: user.id,
      customer_code: `CUST-${Date.now()}`,
      contact_name: fallbackName,
      phone: profile.phone ?? '',
      email: user.email ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, fullName: string, phone?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone,
        app_role: 'customer',
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut(router: Router) {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (error) {
    console.warn('Local sign out failed; returning to login.', error);
  }
  router.replace('/login');
}

export async function routeSignedInUser(user: User, router: Router) {
  const profile = await getProfile(user.id);
  if (!isValidProfile(profile)) {
    router.replace('/access-denied');
    return profile;
  }
  router.replace(routeForRole(profile.role));
  return profile;
}

export function makeClaimNumber() {
  const date = new Date();
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `CLM-${stamp}-${date.getTime().toString().slice(-6)}`;
}



