import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { checkForCustomerUpdate } from '@/lib/customer-updates';
import { palette, roleTheme } from '@/lib/theme';
import { useCustomerBiometricLock } from '@/providers/customer-biometric-lock-provider';

export default function CustomerSettingsAppInfoScreen() {
  const router = useRouter();
  const biometricLock = useCustomerBiometricLock();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');

  const appVersion = Constants.expoConfig?.version ?? '0.3.0';
  const runtimeVersion = Updates.runtimeVersion ?? appVersion;

  async function changeBiometricLock(enabled: boolean) {
    setSecurityMessage('');
    const result = await biometricLock.setEnabled(enabled);
    if (result.ok) {
      setSecurityMessage(enabled ? 'Biometric re-entry is enabled on this device.' : 'Biometric re-entry is disabled.');
      return;
    }
    setSecurityMessage(result.reason || 'Biometric setting could not be changed.');
  }

  async function checkForUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateMessage('Checking for the latest INSUREIT update…');
    try {
      const result = await checkForCustomerUpdate();
      setUpdateMessage(result.message);
    } catch {
      setUpdateMessage('Could not check for updates right now. Try again later.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={palette.ink} />
          </Pressable>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={roleTheme.customer.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ACCOUNT</Text>
            <Text style={styles.title}>Settings & app info</Text>
          </View>
        </View>

        <SectionLabel>DEVICE SECURITY</SectionLabel>
        <View style={styles.card}>
          <View style={styles.securityRow}>
            <View style={styles.rowIcon}>
              <MaterialCommunityIcons name="fingerprint" size={24} color={roleTheme.customer.accent} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Biometric re-entry</Text>
              <Text style={styles.rowSubtitle}>
                {biometricLock.available ? 'Lock after 2 minutes away from the app.' : 'Requires an enrolled biometric on this device.'}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Biometric re-entry"
              value={biometricLock.enabled}
              disabled={!biometricLock.ready || (!biometricLock.available && !biometricLock.enabled)}
              onValueChange={(value) => void changeBiometricLock(value)}
              trackColor={{ false: '#D7DEE8', true: '#BFD8FF' }}
              thumbColor={biometricLock.enabled ? roleTheme.customer.accent : '#F8FAFC'}
            />
          </View>
        </View>
        {securityMessage ? <Text accessibilityLiveRegion="polite" style={styles.message}>{securityMessage}</Text> : null}

        <SectionLabel>APP INFORMATION</SectionLabel>
        <View style={styles.card}>
          <InfoRow label="App" value="INSUREIT" />
          <InfoRow label="Version" value={appVersion} />
          <InfoRow label="Runtime" value={runtimeVersion} />
          <InfoRow label="Updates" value="Automatic on launch" last />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check for updates"
          disabled={checkingUpdate}
          onPress={() => void checkForUpdate()}
          style={({ pressed }) => [styles.updateCard, pressed && styles.pressed, checkingUpdate && styles.disabled]}
        >
          <View style={styles.updateIcon}>
            <MaterialCommunityIcons name="update" size={24} color={roleTheme.customer.accent} />
          </View>
          <Text style={styles.updateTitle}>{checkingUpdate ? 'Checking for updates…' : 'Check for updates'}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#9BACBE" />
        </Pressable>
        {updateMessage ? <Text accessibilityLiveRegion="polite" style={styles.message}>{updateMessage}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF5FF' },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: roleTheme.customer.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { marginTop: 2, color: palette.ink, fontSize: 20, lineHeight: 25, fontWeight: '900' },
  sectionLabel: { marginTop: 34, marginBottom: 10, color: '#6F7C90', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  card: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: '#E0E6EE', backgroundColor: '#FFFFFF' },
  securityRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  rowIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EDFF' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  rowSubtitle: { marginTop: 4, color: palette.slate, fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  infoRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  infoLabel: { color: palette.slate, fontSize: 12, fontWeight: '700' },
  infoValue: { flex: 1, color: palette.ink, textAlign: 'right', fontSize: 12.5, fontWeight: '900' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EDF3' },
  updateCard: { minHeight: 70, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E0E6EE', backgroundColor: '#FFFFFF' },
  updateIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF5FF' },
  updateTitle: { flex: 1, color: palette.ink, fontSize: 14, fontWeight: '900' },
  message: { marginTop: 8, paddingHorizontal: 4, color: palette.slate, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.58 },
});
