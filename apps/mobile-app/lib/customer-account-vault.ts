import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const accountIndexKey = 'insureit:customer-account-index:v1';
const sessionKeyPrefix = 'insureit.customer.session.v1.';
const maxRememberedAccounts = 5;

export type RememberedCustomerAccount = {
  userId: string;
  displayName: string;
  customerCode: string | null;
  maskedPhone: string | null;
  updatedAt: string;
  requiresReauth: boolean;
};

type StoredCustomerAccount = Omit<RememberedCustomerAccount, 'requiresReauth'>;
type StoredSession = { accessToken: string; refreshToken: string };

export class CustomerAccountReauthRequiredError extends Error {
  constructor() {
    super('This saved account needs OTP verification again.');
    this.name = 'CustomerAccountReauthRequiredError';
  }
}

export async function rememberCustomerAccount(input: {
  session: Session;
  displayName: string;
  customerCode?: string | null;
  phone?: string | null;
}) {
  if (Platform.OS === 'web' || !input.session.user?.id || !input.session.access_token || !input.session.refresh_token) return;
  if (!(await SecureStore.isAvailableAsync())) return;

  await writeSession(input.session.user.id, {
    accessToken: input.session.access_token,
    refreshToken: input.session.refresh_token,
  });

  const current = await readIndex();
  const account: StoredCustomerAccount = {
    userId: input.session.user.id,
    displayName: input.displayName.trim() || 'Customer',
    customerCode: input.customerCode?.trim() || null,
    maskedPhone: maskPhone(input.phone ?? input.session.user.phone ?? null),
    updatedAt: new Date().toISOString(),
  };
  const next = [account, ...current.filter((item) => item.userId !== account.userId)].slice(0, maxRememberedAccounts);
  const evicted = current.filter((item) => !next.some((saved) => saved.userId === item.userId));
  await writeIndex(next);
  await Promise.all(evicted.map((item) => SecureStore.deleteItemAsync(sessionKey(item.userId))));
}

export async function syncRememberedCustomerSession(session: Session) {
  if (Platform.OS === 'web' || !session.user?.id || !session.access_token || !session.refresh_token) return;
  if (!(await SecureStore.isAvailableAsync())) return;
  const current = await readIndex();
  if (!current.some((item) => item.userId === session.user.id)) return;
  await writeSession(session.user.id, {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

export async function listRememberedCustomerAccounts(): Promise<RememberedCustomerAccount[]> {
  if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync())) return [];
  const accounts = await readIndex();
  return Promise.all(accounts.map(async (account) => ({
    ...account,
    requiresReauth: !(await SecureStore.getItemAsync(sessionKey(account.userId))),
  })));
}

export async function isRememberedCustomerUser(userId: string) {
  const accounts = await readIndex();
  return accounts.some((account) => account.userId === userId);
}

export async function switchToRememberedCustomerAccount(userId: string): Promise<Session> {
  if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync())) {
    throw new CustomerAccountReauthRequiredError();
  }

  const previous = await supabase.auth.getSession();
  const secret = await readSession(userId);
  if (!secret) throw new CustomerAccountReauthRequiredError();

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: secret.accessToken,
      refresh_token: secret.refreshToken,
    });
    if (error || !data.session?.user || data.session.user.id !== userId) {
      await SecureStore.deleteItemAsync(sessionKey(userId));
      throw new CustomerAccountReauthRequiredError();
    }
    await syncRememberedCustomerSession(data.session);
    await touchAccount(userId);
    return data.session;
  } catch (error) {
    await restoreSession(previous.data.session);
    if (error instanceof CustomerAccountReauthRequiredError) throw error;
    await SecureStore.deleteItemAsync(sessionKey(userId));
    throw new CustomerAccountReauthRequiredError();
  }
}

export async function restoreRememberedCustomerAccount(userId: string) {
  return switchToRememberedCustomerAccount(userId);
}

export async function restoreCustomerSessionSnapshot(session: Session | null): Promise<Session | null> {
  if (!session?.user?.id || !session.access_token || !session.refresh_token) return null;
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error || !data.session?.user || data.session.user.id !== session.user.id) {
    throw error ?? new Error('Previous customer session identity could not be restored.');
  }
  return data.session;
}

export async function removeRememberedCustomerAccount(userId: string) {
  if (Platform.OS !== 'web' && await SecureStore.isAvailableAsync()) {
    await SecureStore.deleteItemAsync(sessionKey(userId));
  }
  const current = await readIndex();
  await writeIndex(current.filter((item) => item.userId !== userId));
}

export async function clearRememberedCustomerAccounts() {
  const current = await readIndex();
  if (Platform.OS !== 'web' && await SecureStore.isAvailableAsync()) {
    await Promise.all(current.map((item) => SecureStore.deleteItemAsync(sessionKey(item.userId))));
  }
  await AsyncStorage.removeItem(accountIndexKey);
}

async function restoreSession(session: Session | null) {
  if (session?.access_token && session.refresh_token) {
    await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }).catch(() => undefined);
  }
}

async function touchAccount(userId: string) {
  const current = await readIndex();
  const target = current.find((item) => item.userId === userId);
  if (!target) return;
  await writeIndex([{ ...target, updatedAt: new Date().toISOString() }, ...current.filter((item) => item.userId !== userId)]);
}

async function readIndex(): Promise<StoredCustomerAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(accountIndexKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredCustomerAccount).slice(0, maxRememberedAccounts);
  } catch {
    return [];
  }
}

async function writeIndex(accounts: StoredCustomerAccount[]) {
  await AsyncStorage.setItem(accountIndexKey, JSON.stringify(accounts.slice(0, maxRememberedAccounts)));
}

async function writeSession(userId: string, session: StoredSession) {
  await SecureStore.setItemAsync(sessionKey(userId), JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function readSession(userId: string): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(sessionKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function sessionKey(userId: string) {
  return `${sessionKeyPrefix}${userId}`;
}

function maskPhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `••••••${digits.slice(-4)}`;
}

function isStoredCustomerAccount(value: unknown): value is StoredCustomerAccount {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<StoredCustomerAccount>;
  return typeof account.userId === 'string'
    && typeof account.displayName === 'string'
    && typeof account.updatedAt === 'string'
    && (account.customerCode === null || typeof account.customerCode === 'string')
    && (account.maskedPhone === null || typeof account.maskedPhone === 'string');
}
