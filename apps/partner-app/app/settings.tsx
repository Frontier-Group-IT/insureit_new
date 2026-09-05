import { useState } from 'react';
import { Image, type ImageSourcePropType, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerAssets } from '@/lib/partner-assets';
import { checkForPartnerUpdate } from '@/lib/partner-updates';
import { partnerTheme } from '@/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

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

  return (
    <PartnerScreen eyebrow="ACCOUNT" title="Settings & app info" onBack={() => router.back()}>
      <PartnerSectionHeader title="Account" />
      <View style={styles.menu}>
        <SettingsLink asset={PartnerAssets.navigation.profile} title="Profile & registration" onPress={() => router.push('/profile')} />
        <SettingsLink asset={PartnerAssets.actions.support} title="Support" onPress={() => router.push('/support')} last />
      </View>

      <PartnerSectionHeader title="Privacy" />
      <View style={styles.menu}>
        <SettingsLink
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          onPress={() => void Linking.openURL('https://portal.insureit.in/privacy-policy')}
          last
        />
      </View>

      <PartnerSectionHeader title="App information" />
      <View style={styles.details}>
        <InfoRow label="App" value="INSUREIT Partner" />
        <InfoRow label="Version" value="0.1.0" />
        <InfoRow label="Runtime" value="0.1.0" />
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

function SettingsLink({ icon, asset, title, onPress, last = false }: {
  icon?: 'shield-checkmark-outline';
  asset?: ImageSourcePropType;
  title: string;
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
          <Ionicons name={icon} size={18} color={partnerTheme.colors.brand} />
        ) : null}
      </View>
      <Text style={styles.linkTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
    </Pressable>
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
  menu: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  updateMenu: { marginTop: 8 },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13 },
  linkIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  linkArtwork: { backgroundColor: 'transparent' },
  linkArtworkImage: { width: 34, height: 34 },
  linkTitle: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  details: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  infoRow: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  infoLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  infoValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.bodyStrong },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  updateMessage: { marginTop: 6, paddingHorizontal: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  note: { marginTop: partnerTheme.spacing.lg, minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.brandSoft },
  noteText: { flex: 1, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  pressed: { backgroundColor: partnerTheme.colors.surfaceMuted },
});
