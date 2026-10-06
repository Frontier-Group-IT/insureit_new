import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PARTNER_PROFILE_PHOTO_BUCKET, partnerProfilePhotoPath } from '@/lib/partner-profile-photo';
import type { PartnerCommercialScope } from '@/lib/partner-session';
import { supabase } from '@/lib/supabase';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { context, avatarUri, refreshAvatar } = usePartnerSession();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  if (!context) return null;

  const { identity, scope } = context;
  const roleLabel = identity.actor_kind === 'employee'
    ? humanize(identity.role)
    : humanize(identity.intermediary_type);

  async function changeProfilePhoto() {
    if (avatarUploading) return;

    setAvatarMessage(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setAvatarMessage({ tone: 'danger', text: 'Please choose a profile photo below 5 MB.' });
      return;
    }

    setAvatarUploading(true);
    try {
      const response = await fetch(asset.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > 5 * 1024 * 1024) {
        setAvatarMessage({ tone: 'danger', text: 'Please choose a profile photo below 5 MB.' });
        return;
      }

      const path = partnerProfilePhotoPath(identity.auth_user_id);
      const upload = await supabase.storage.from(PARTNER_PROFILE_PHOTO_BUCKET).upload(path, body, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: true,
      });
      if (upload.error) throw upload.error;

      const refreshedAvatar = await refreshAvatar();
      if (!refreshedAvatar) throw new Error('Profile photo signed URL unavailable.');

      setAvatarMessage({ tone: 'success', text: 'Profile photo updated everywhere.' });
    } catch {
      setAvatarMessage({ tone: 'danger', text: 'Profile photo upload failed. Please try again.' });
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <PartnerScreen title="Profile & registration" hideTopBar>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={24} color="#123B7A" />
        </Pressable>

        <View style={styles.headerIcon}>
          <Ionicons name="person" size={22} color="#0756C9" />
        </View>

        <View style={styles.headerTextWrap}>
          <Text style={styles.headerEyebrow}>ACCOUNT</Text>
          <Text style={styles.headerTitle}>Profile & registration</Text>
        </View>
      </View>

      {avatarMessage ? (
        <View style={styles.avatarFeedback}>
          <PartnerBanner tone={avatarMessage.tone} message={avatarMessage.text} />
        </View>
      ) : null}

      <View style={styles.hero}>
        <View pointerEvents="none" style={styles.heroGlowLarge} />
        <View pointerEvents="none" style={styles.heroGlowSmall} />

        <View style={styles.avatarStage}>
          <View style={styles.avatarShell}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials(identity.display_name)}</Text>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            disabled={avatarUploading}
            onPress={() => void changeProfilePhoto()}
            style={({ pressed }) => [
              styles.avatarCamera,
              (pressed || avatarUploading) && styles.avatarCameraDisabled,
            ]}
          >
            <Ionicons name={avatarUploading ? 'cloud-upload-outline' : 'camera'} size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.heroBody}>
          <Text numberOfLines={1} style={styles.name}>{identity.display_name}</Text>
          <View style={styles.rolePill}>
            <Text numberOfLines={1} style={styles.roleText}>{roleLabel}</Text>
          </View>
        </View>

        <View style={styles.heroProfileIcon}>
          <Ionicons name="person-outline" size={25} color="#BFD4FF" />
        </View>
      </View>

      <SectionTitle icon="document-text-outline" title="Registration" />

      <View style={styles.details}>
        {identity.actor_kind === 'employee' ? (
          <>
            <Detail
              icon="card-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Employee code"
              value={identity.employee_code}
            />
            <Detail
              icon="briefcase-outline"
              iconBackground="#F4EEFF"
              iconColor="#7C46E8"
              label="Designation"
              value={identity.designation || 'Not recorded'}
            />
            <Detail
              icon="people-outline"
              iconBackground="#EAF9F0"
              iconColor="#11A86B"
              label="Role"
              value={humanize(identity.role)}
              isLast
            />
          </>
        ) : (
          <>
            <Detail
              icon="card-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Intermediary code"
              value={identity.intermediary_code || 'Not recorded'}
            />
            <Detail
              icon="people-outline"
              iconBackground="#EAF9F0"
              iconColor="#11A86B"
              label="Intermediary type"
              value={humanize(identity.intermediary_type)}
            />
            <Detail
              icon="business-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Partner family"
              value={identity.partner_name}
            />
            <Detail
              icon="pricetag-outline"
              iconBackground="#F4EEFF"
              iconColor="#7C46E8"
              label="Partner code"
              value={identity.partner_code}
            />
            <Detail
              icon="checkmark-circle-outline"
              iconBackground="#EAF9F0"
              iconColor="#11A86B"
              label="Portal status"
              value="Active"
              isLast
            />
          </>
        )}
      </View>

      <SectionTitle icon="shield-checkmark-outline" title="Commercial Access" />
      <ProfileScopeCard scope={scope} />
    </PartnerScreen>
  );
}

function SectionTitle({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={23} color="#0C6FE8" />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Detail({
  icon,
  iconBackground,
  iconColor,
  label,
  value,
  isLast = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBackground: string;
  iconColor: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast]}>
      <View style={[styles.detailIcon, { backgroundColor: iconBackground }]}>
        <Ionicons name={icon} size={19} color={iconColor} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ProfileScopeCard({ scope }: { scope: PartnerCommercialScope }) {
  return (
    <View style={styles.scopeCard}>
      <View style={styles.scopeHalo}>
        <View style={styles.scopeIconWrap}>
          <Ionicons name="shield-checkmark-outline" size={27} color="#12A86B" />
        </View>
      </View>

      <View style={styles.scopeBody}>
        <Text style={styles.scopeEyebrow}>AUTHORIZED BUSINESS SCOPE</Text>
        <Text style={styles.scopeTitle}>{scopeLabel(scope.scope_mode)}</Text>
        <Text style={styles.scopeCopy}>This view is generated from your server-authorized commercial relationships.</Text>
      </View>
    </View>
  );
}

function scopeLabel(mode: PartnerCommercialScope['scope_mode']) {
  if (mode === 'partner_family') return 'My Partner family';
  if (mode === 'hierarchy') return 'My sales hierarchy';
  if (mode === 'organization') return 'Organization-wide';
  if (mode === 'self') return 'My business';
  return 'No commercial scope';
}


function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  header: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  backButton: {
    width: 36,
    height: 44,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.65 },
  headerIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  headerTextWrap: { flex: 1, justifyContent: 'center' },
  headerEyebrow: {
    color: '#0C6FE8',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1.25,
  },
  headerTitle: {
    marginTop: 1,
    color: '#0C1735',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    letterSpacing: -0.25,
  },

  avatarFeedback: {
    marginBottom: 10,
  },
  hero: {
    position: 'relative',
    minHeight: 126,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#103FA5',
  },
  heroGlowLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -18,
    top: -105,
    backgroundColor: '#0A66D8',
    opacity: 0.72,
  },
  heroGlowSmall: {
    position: 'absolute',
    width: 145,
    height: 145,
    borderRadius: 73,
    right: 34,
    top: -60,
    backgroundColor: '#1778E8',
    opacity: 0.34,
  },
  avatarStage: {
    width: 94,
    height: 94,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarShell: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#8EA6ED',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: partnerTheme.colors.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  avatarCamera: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B63CE',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 7,
  },
  avatarCameraDisabled: {
    opacity: 0.65,
  },
  heroBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  name: {
    color: partnerTheme.colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  rolePill: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  roleText: {
    color: '#DCE7FF',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '500',
  },
  heroProfileIcon: {
    width: 42,
    height: 42,
    marginLeft: 8,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 9,
    paddingLeft: 2,
  },
  sectionTitle: {
    color: '#111A35',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  details: {
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF2',
    shadowColor: '#162A55',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  detailRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E9EDF4',
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  detailLabel: {
    flexShrink: 1,
    color: '#68748B',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  detailValue: {
    flex: 1,
    marginLeft: 12,
    textAlign: 'right',
    color: '#101833',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '800',
  },

  scopeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 118,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#CDECDD',
    backgroundColor: '#EFFAF5',
  },
  scopeHalo: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2F7EC',
  },
  scopeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7EBD8',
  },
  scopeBody: { flex: 1, minWidth: 0 },
  scopeEyebrow: {
    color: '#27886A',
    fontSize: 8.5,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1.05,
  },
  scopeTitle: {
    marginTop: 5,
    color: '#0F1C3A',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  scopeCopy: {
    marginTop: 5,
    color: '#5D6E8A',
    fontSize: 10.5,
    lineHeight: 15,
  },
});
