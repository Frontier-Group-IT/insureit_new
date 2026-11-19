import { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { partnerSelectionHaptic, partnerSuccessHaptic, partnerWarningHaptic } from '@/lib/partner-haptics';
import { getPartnerNotificationPermission, registerPartnerPushDevice, requestPartnerNotificationPermission } from '@/lib/partner-notifications';
import { PartnerAssets } from '@/lib/partner-assets';
import { checkForPartnerUpdate } from '@/lib/partner-updates';
import { partnerTheme } from '@/lib/theme';
import { usePartnerBiometricLock } from '@/providers/partner-biometric-lock-provider';

export default function SettingsScreen() {
  const router = useRouter();
  const biometricLock = usePartnerBiometricLock();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [requestingNotifications, setRequestingNotifications] = useState(false);

  useEffect(() => {
    let active = true;
    void getPartnerNotificationPermission().then((status) => {
      if (!active) return;
      setNotificationStatus(status === 'granted' || status === 'denied' ? status : 'undetermined');
    });
    return () => { active = false; };
  }, []);

  const checkForUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateMessage('Checking for the latest Partner update…');
    try {
      const result = await checkForPartnerUpdate();
      setUpdateMessage(result.message);
    } catch {
      setUpdateMessage('Could not check for updates right now. Try again later.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const changeBiometricLock = async (enabled: boolean) => {
    setSecurityMessage('');
    void partnerSelectionHaptic();
    const result = await biometricLock.setEnabled(enabled);
    if (result.ok) {
      setSecurityMessage(enabled ? 'Biometric re-entry is enabled on this device.' : 'Biometric re-entry is disabled.');
      if (enabled) void partnerSuccessHaptic();
      return;
    }
    setSecurityMessage(result.reason || 'Biometric setting could not be changed.');
    void partnerWarningHaptic();
  };

  const enableNotifications = async () => {
    if (requestingNotifications || notificationStatus === 'granted') return;
    setRequestingNotifications(true);
    setSecurityMessage('');
    try {
      const result = await requestPartnerNotificationPermission();
      setNotificationStatus(result.granted ? 'granted' : result.status === 'denied' ? 'denied' : 'undetermined');
      if (result.granted) {
        try {
          const registration = await registerPartnerPushDevice();
          if (registration.registered) {
            setSecurityMessage('Partner notifications are enabled and this device is registered.');
            void partnerSuccessHaptic();
          } else {
            setSecurityMessage('Notification permission is enabled, but this device is not registered for Partner alerts yet.');
            void partnerWarningHaptic();
          }
        } catch {
          setSecurityMessage('Notification permission is enabled, but this device could not be registered yet. Try again later.');
          void partnerWarningHaptic();
        }
      } else {
        setSecurityMessage('Notifications are not enabled. You can allow them from your device settings.');
        void partnerWarningHaptic();
      }
    } finally {
      setRequestingNotifications(false);
    }
  };

  return (
    <PartnerScreen title="Settings & app info" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <PartnerCasePageHeader title="Settings & app info" icon="settings-outline" onBack={() => router.back()} />
      <PartnerSectionHeader title="Account" settingsHeading compact />
      <View style={styles.menu}>
        <SettingsLink icon="person-outline" title="Profile & registration" subtitle="Manage your profile details" onPress={() => router.push('/profile')} />
        <SettingsLink icon="headset-outline" title="Support" subtitle="Get help and assistance" onPress={() => router.push('/support')} last />
      </View>

      <PartnerSectionHeader title="Device security" settingsHeading compact />
      <View style={styles.menu}>
        <SettingsToggleRow
          icon="finger-print-outline"
          title="Biometric re-entry"
          subtitle={biometricLock.available ? 'Lock after 2 minutes away from the app.' : 'Requires an enrolled biometric on this device.'}
          value={biometricLock.enabled}
          disabled={!biometricLock.ready || (!biometricLock.available && !biometricLock.enabled)}
          onValueChange={(value) => void changeBiometricLock(value)}
        />
        <SettingsActionRow
          icon="notifications-outline"
          title="Partner notifications"
          subtitle={notificationStatus === 'granted' ? 'Enabled on this device.' : notificationStatus === 'denied' ? 'Blocked in device settings.' : 'Enable renewal, claim and intake alerts.'}
          actionLabel={notificationStatus === 'granted' ? 'Enabled' : notificationStatus === 'denied' ? 'Settings' : requestingNotifications ? 'Enabling…' : 'Enable'}
          disabled={requestingNotifications}
          onPress={() => {
            if (notificationStatus === 'denied') void Linking.openSettings();
            else void enableNotifications();
          }}
          last
        />
      </View>
      {securityMessage ? <Text accessibilityLiveRegion="polite" style={styles.updateMessage}>{securityMessage}</Text> : null}

      <PartnerSectionHeader title="Privacy" settingsHeading compact />
      <View style={styles.menu}>
        <SettingsLink
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          onPress={() => void Linking.openURL('https://portal.insureit.in/privacy-policy')}
        />
        <SettingsLink icon="person-remove-outline" title="Request account deletion" onPress={() => router.push('/account-deletion')} last />
      </View>

      <PartnerSectionHeader title="App information" settingsHeading compact />
      <View style={styles.details}>
        <InfoRow label="App" value="INSUREIT Partner" />
        <InfoRow label="Version" value="0.2.0" />
        <InfoRow label="Runtime" value="0.2.0" />
        <InfoRow label="Updates" value="Automatic on launch" last />
      </View>

      <View style={[styles.menu, styles.updateMenu]}>
        <SettingsLink
          asset={PartnerAssets.status.settings}
          title={checkingUpdate ? 'Checking for updates…' : 'Check for updates'}
          onPress={() => void checkForUpdate()}
          last
        />
      </View>
      {updateMessage ? <Text accessibilityLiveRegion="polite" style={styles.updateMessage}>{updateMessage}</Text> : null}

      <View style={styles.note}>
        <Ionicons name="shield-checkmark-outline" size={18} color={partnerTheme.colors.brand} />
        <Text style={styles.noteText}>Business and commercial access follows your authorized Partner account.</Text>
      </View>
    </PartnerScreen>
  );
}

function SettingsLink({ icon, asset, title, subtitle, onPress, last = false }: {
  icon?: keyof typeof Ionicons.glyphMap;
  asset?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, !last && styles.divider, pressed && styles.pressed]}
    >
      <View style={[styles.linkIcon, asset ? styles.linkArtwork : undefined]}>
        {asset ? (
          <Image source={asset} style={styles.linkArtworkImage} resizeMode="contain" />
        ) : icon ? (
          <Ionicons name={icon} size={20} color="#6335B7" />
        ) : null}
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        {subtitle ? <Text style={styles.linkSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={21} color="#51468C" />
    </Pressable>
  );
}

function SettingsToggleRow({ icon, title, subtitle, value, disabled, onValueChange, last = false }: {
  icon: 'finger-print-outline';
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.controlRow, !last && styles.divider]}>
      <View style={styles.linkIcon}><Ionicons name={icon} size={20} color="#6335B7" /></View>
      <View style={styles.controlCopy}>
        <Text style={styles.controlTitle}>{title}</Text>
        <Text style={styles.controlSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: '#D5DCE6', true: partnerTheme.colors.brandSoft }}
        thumbColor={value ? partnerTheme.colors.brand : '#F8FAFC'}
      />
    </View>
  );
}

function SettingsActionRow({ icon, title, subtitle, actionLabel, disabled, onPress, last = false }: {
  icon: 'notifications-outline';
  title: string;
  subtitle: string;
  actionLabel: string;
  disabled?: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.controlRow, !last && styles.divider]}>
      <View style={styles.linkIcon}><Ionicons name={icon} size={20} color="#6335B7" /></View>
      <View style={styles.controlCopy}>
        <Text style={styles.controlTitle}>{title}</Text>
        <Text style={styles.controlSubtitle}>{subtitle}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel} ${title}`} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={styles.smallActionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
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
  menu: { overflow: 'hidden', borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DAE0F4', shadowColor: '#6570B4', shadowOpacity: 0.06, shadowRadius: 9, elevation: 1 },
  updateMenu: { marginTop: 7 },
  linkRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 7 },
  controlRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, paddingVertical: 7 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE8FF' },
  linkArtwork: { backgroundColor: 'transparent' },
  linkArtworkImage: { width: 30, height: 30 },
  linkCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  linkTitle: { color: '#141C3F', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  linkSubtitle: { color: '#525A81', fontSize: 12, lineHeight: 16, marginTop: 2 },
  controlCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  controlTitle: { color: '#141C3F', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  controlSubtitle: { marginTop: 2, color: '#525A81', fontSize: 12, lineHeight: 16 },
  smallAction: { minHeight: 38, minWidth: 76, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9, borderRadius: 17, backgroundColor: '#EDE7FF' },
  smallActionText: { color: '#6335B7', ...partnerTheme.typography.label },
  details: { overflow: 'hidden', borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DAE0F4' },
  infoRow: { minHeight: 37, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  infoLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  infoValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.bodyStrong },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DBE0F1' },
  updateMessage: { marginTop: 6, paddingHorizontal: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  note: { marginTop: 7, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: partnerTheme.radius.md, backgroundColor: partnerTheme.colors.brandSoft },
  noteText: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
