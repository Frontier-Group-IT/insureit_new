import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCurrentSession, getProfile, routeSignedInUser } from '@/lib/auth';
import {
  CustomerAccountReauthRequiredError,
  listRememberedCustomerAccounts,
  rememberCustomerAccount,
  restoreCustomerSessionSnapshot,
  switchToRememberedCustomerAccount,
  type RememberedCustomerAccount,
} from '@/lib/customer-account-vault';
import { getSelectedCustomerContext } from '@/lib/customer-context';
import { palette } from '@/lib/theme';

export function CustomerAccountSwitcherButton({ initial = 'C', style }: { initial?: string; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<RememberedCustomerAccount[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user || !active) return;
        const profile = await getProfile(session.user.id);
        if (!active || profile?.role !== 'customer' || !profile.is_active) return;
        const context = await getSelectedCustomerContext().catch(() => null);
        await rememberCustomerAccount({
          session,
          displayName: profile.full_name,
          customerCode: context?.customer_code ?? null,
          phone: profile.phone ?? session.user.phone ?? null,
        });
        if (active) setCurrentUserId(session.user.id);
      } catch (nextError) {
        console.warn('Customer account registration failed', nextError);
      }
    })();
    return () => { active = false; };
  }, []);

  async function openSwitcher() {
    setError('');
    try {
      setAccounts(await listRememberedCustomerAccounts());
    } catch {
      setAccounts([]);
      setError('Saved accounts could not be loaded securely.');
    }
    setOpen(true);
  }

  async function switchAccount(account: RememberedCustomerAccount) {
    if (busyUserId) return;
    if (account.userId === currentUserId) {
      setOpen(false);
      return;
    }

    setBusyUserId(account.userId);
    setError('');
    const previousSession = await getCurrentSession().catch(() => null);
    let targetSessionInstalled = false;
    try {
      const session = await switchToRememberedCustomerAccount(account.userId);
      targetSessionInstalled = true;
      await routeSignedInUser(session.user, router);
      setCurrentUserId(account.userId);
      setOpen(false);
    } catch (nextError) {
      if (targetSessionInstalled) {
        try {
          const restored = await restoreCustomerSessionSnapshot(previousSession);
          if (!restored?.user) throw new Error('Previous customer session was unavailable.');
          setCurrentUserId(restored.user.id);
        } catch (restoreError) {
          console.warn('Previous customer session restore failed after account switch error', restoreError);
          setOpen(false);
          router.replace('/login');
          return;
        }
      }
      if (nextError instanceof CustomerAccountReauthRequiredError) {
        setOpen(false);
        router.push({ pathname: '/login', params: { addAccount: '1' } });
      } else {
        setError('This account could not be switched safely. Please try again.');
      }
    } finally {
      setBusyUserId(null);
    }
  }

  function addAccount() {
    setOpen(false);
    router.push({ pathname: '/login', params: { addAccount: '1' } });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Switch customer account"
        onPress={() => void openSwitcher()}
        style={[styles.trigger, style]}
      >
        <Text style={styles.triggerText}>{initial.trim().charAt(0).toUpperCase() || 'C'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close account switcher" onPress={() => setOpen(false)} style={styles.backdrop} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.title}>Switch account</Text>
                <Text style={styles.subtitle}>Saved sign-ins stay securely separated on this device.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.close}>
                <MaterialCommunityIcons name="close" size={20} color={palette.ink} />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View>
              {accounts.map((account) => {
                const active = account.userId === currentUserId;
                const busy = account.userId === busyUserId;
                return (
                  <Pressable
                    key={account.userId}
                    accessibilityRole="button"
                    disabled={Boolean(busyUserId)}
                    onPress={() => void switchAccount(account)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(account.displayName)}</Text></View>
                    <View style={styles.copy}>
                      <Text style={styles.name} numberOfLines={1}>{account.displayName}</Text>
                      <Text style={[styles.meta, account.requiresReauth && styles.warning]} numberOfLines={1}>
                        {account.requiresReauth
                          ? 'OTP required to sign in again'
                          : account.customerCode
                            ? `Customer ID: ${account.customerCode}`
                            : account.maskedPhone || 'Saved customer account'}
                      </Text>
                    </View>
                    {busy
                      ? <ActivityIndicator size="small" color="#0B63CE" />
                      : active
                        ? <MaterialCommunityIcons name="check-circle" size={26} color="#0B8CEB" />
                        : account.requiresReauth
                          ? <MaterialCommunityIcons name="lock-alert-outline" size={22} color="#B36B00" />
                          : null}
                  </Pressable>
                );
              })}
            </View>

            <Pressable accessibilityRole="button" onPress={addAccount} style={styles.addRow}>
              <View style={styles.addIcon}><MaterialCommunityIcons name="plus" size={25} color="#FFFFFF" /></View>
              <Text style={styles.addText}>Add account</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'C';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase() || 'C';
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#12305F', borderWidth: 2, borderColor: 'rgba(255,255,255,0.96)', alignItems: 'center', justifyContent: 'center' },
  triggerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,10,22,0.58)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFFFFF', paddingHorizontal: 18, paddingTop: 9, shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 18, elevation: 18 },
  handle: { alignSelf: 'center', width: 72, height: 5, borderRadius: 999, backgroundColor: '#C9D1DB', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  headerCopy: { flex: 1 },
  title: { color: palette.ink, fontSize: 19, fontWeight: '900' },
  subtitle: { color: palette.slate, fontSize: 10.5, lineHeight: 15, fontWeight: '600', marginTop: 3 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  error: { color: '#B42318', fontSize: 11, lineHeight: 16, fontWeight: '700', backgroundColor: '#FFF3F2', borderRadius: 12, padding: 10, marginBottom: 8 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E9F0' },
  rowPressed: { opacity: 0.72 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0B3D78', borderWidth: 2, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 0.7 },
  copy: { flex: 1, minWidth: 0 },
  name: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  meta: { color: palette.slate, fontSize: 11, fontWeight: '600', marginTop: 4 },
  warning: { color: '#9A6700' },
  addRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, marginTop: 3 },
  addIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#071D49', alignItems: 'center', justifyContent: 'center' },
  addText: { color: palette.ink, fontSize: 15, fontWeight: '800' },
});
