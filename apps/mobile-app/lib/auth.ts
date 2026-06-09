import type { Session, User } from '@supabase/supabase-js';
import { Router } from 'expo-router';

import { supabase } from './supabase';
import type { AppRole, Customer, Profile } from './types';

export const validRoles: AppRole[] = [
  'customer',
  'field_executive',
  'claim_processor',
  'manager',
  'admin',
  'super_admin',
];

export const claimStatuses = [
  'Draft',
  'Accident Reported',
  'Documents Pending',
  'Documents Submitted',
  'Claim Intimated',
  'Surveyor Appointed',
  'Vehicle Inspected',
  'Estimate Submitted',
  'Approval Pending',
  'Repair Started',
  'Repair Completed',
  'Final Bill Submitted',
  'Settlement Under Process',
  'Settled',
  'Rejected',
  'Closed',
] as const;

export function routeForRole(role: AppRole) {
  if (role === 'customer') return '/customer/home' as const;
  if (role === 'field_executive') return '/staff/dashboard' as const;
  if (role === 'claim_processor') return '/staff/dashboard' as const;
  if (role === 'manager' || role === 'admin' || role === 'super_admin') return '/staff/dashboard' as const;
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
  await supabase.auth.signOut();
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
