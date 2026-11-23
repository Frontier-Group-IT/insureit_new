import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PARTNER_PROFILE_PHOTO_BUCKET, partnerProfilePhotoPath } from '@/lib/partner-profile-photo';
import { supabase } from '@/lib/supabase';
import { partnerTheme } from '@/lib/theme';
import { signedInOrganizationName, signedInPersonName, signedInPersonRole } from '@/lib/signed-in-person';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { context, avatarUri, refreshAvatar, signOut } = usePartnerSession();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  if (!context) return null;

  const { identity } = context;
  const roleLabel = signedInPersonRole(identity);
  const organizationName = signedInOrganizationName(identity);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError('');
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setLogoutError('We could not sign you out. Please try again.');
      setSigningOut(false);
      setLogoutOpen(false);
    }
  }

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
    <PartnerScreen title="Profile & registration" hideTopBar navyStatusBar bottomNavigationNavy bottomNavigation={<PartnerCaseBottomNavigation activeTab="More" />}>
      <PartnerCasePageHeader title="Profile & registration" icon="person-outline" onBack={() => router.back()} />
      {avatarMessage ? (
        <View style={styles.avatarFeedback}>
          <PartnerBanner tone={avatarMessage.tone} message={avatarMessage.text} />
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.avatarStage}>
            <View style={styles.avatarShell}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(signedInPersonName(identity))}</Text>
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
            <Text style={styles.name} numberOfLines={2}>{signedInPersonName(identity)}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
            {identity.actor_kind === 'employee' && identity.designation ? <Text style={styles.heroDesignation} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{identity.designation}</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={signingOut}
            onPress={() => setLogoutOpen(true)}
            style={({ pressed }) => [
              styles.heroProfileIcon,
              (pressed || signingOut) && styles.heroProfileIconPressed,
            ]}
          >
            <Ionicons name="log-out-outline" size={24} color="#174A96" />
          </Pressable>
        </View>
        <Image
          source={require('../assets/partner/profile/profile-team-3d.png')}
          resizeMode="contain"
          style={styles.heroArtwork}
          accessible={false}
        />
      </View>

      <SectionTitle title="Registration" />

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
              label="Role"
              value={roleLabel}
            />
            <Detail
              icon="business-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Organization"
              value={organizationName || 'Not recorded'}
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

      {logoutError ? (
        <View style={styles.logoutFeedback}>
          <PartnerBanner tone="danger" message={logoutError} />
        </View>
      ) : null}

      <PartnerConfirmDialog
        visible={logoutOpen}
        title="Sign out of INSUREIT Partner?"
        message="You will need to sign in again to access your business and service workspace."
        confirmLabel="Sign out"
        destructive
        busy={signingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
    </PartnerScreen>
  );
}

const registrationIcons: Record<string, ImageSourcePropType> = {
  'Employee code': require('../assets/partner/profile/employee-id-3d.png'),
  'Intermediary code': require('../assets/partner/profile/employee-id-3d.png'),
  'Partner code': require('../assets/partner/profile/employee-id-3d.png'),
  Designation: require('../assets/partner/profile/designation-bag-3d.png'),
  Organization: require('../assets/partner/profile/designation-bag-3d.png'),
  Role: require('../assets/partner/profile/role-team-3d.png'),
  'Portal status': require('../assets/partner/profile/role-team-3d.png'),
};

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleIcon}><Image source={require('../assets/partner/profile/registration-3d.png')} style={styles.registrationTitleArtwork} resizeMode="contain" accessible={false} /></View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionTitleRule} />
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
  const artwork = registrationIcons[label];
  return (
    <View style={[styles.detailRow, isLast && styles.detailRowLast, { borderColor: iconBackground }]}>
       <View style={[styles.detailIcon, { backgroundColor: iconBackground }]}>
        {artwork ? <Image source={artwork} style={styles.detailArtworkLeft} resizeMode="contain" accessible={false} /> : <Ionicons name={icon} size={24} color={iconColor} />}
      </View>
      <View style={[styles.detailVerticalRule, { backgroundColor: iconColor }]} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'Not recorded'}</Text>
      </View>
    </View>
  );
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
  // No colored hero card: profile is part of the page canvas.
  hero: {
    marginTop: 14,
    marginHorizontal: 0,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 6,
    minHeight: 212,
    alignItems: 'center',
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 76,
    zIndex: 1,
  },
  heroArtwork: {
    width: '100%',
    maxWidth: 320,
    height: 130,
    marginTop: -2,
    alignSelf: 'center',
  },
  avatarStage: {
    width: 74,
    height: 74,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarShell: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#DFEAFF',
    borderWidth: 2,
    borderColor: '#BDD4FB',
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
    color: '#153E83',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  avatarCamera: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 30,
    height: 30,
    borderRadius: 15,
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
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  name: {
    flexShrink: 1,
    color: '#0E2C64',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
  },
  rolePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E7EEFF',
  },
  heroDesignation: { marginTop: 7, maxWidth: '100%', color: '#536B91', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  roleText: {
    color: '#365CA2',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '500',
  },
  heroProfileIcon: {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7EFFC',
  },
  heroProfileIconPressed: {
    opacity: 0.68,
  },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 14, paddingLeft: 3 },
  sectionTitleIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  registrationTitleArtwork: { width: 34, height: 34 },
  sectionTitle: { color: '#111A35', fontSize: 17, lineHeight: 23, fontWeight: '800' },
  sectionTitleRule: { flex: 1, height: 2, backgroundColor: '#8D50D9', marginLeft: 5 },
  details: { gap: 11, paddingBottom: 18 },
  detailRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: '#264A82',
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  detailRowLast: {},
   detailIcon: { width: 56, height: 61, borderRadius: 16, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  detailArtworkLeft: { width: 54, height: 59 },
  detailVerticalRule: { width: 1, height: 56, marginHorizontal: 12, opacity: 0.5 },
  detailCopy: { flex: 1, minWidth: 0, paddingRight: 6, gap: 5 },
  detailLabel: { color: '#5A6683', fontSize: 11.5, lineHeight: 15, fontWeight: '600' },
  detailValue: { color: '#101833', fontSize: 13.5, lineHeight: 17, fontWeight: '800' },
  logoutFeedback: {
    marginTop: 12,
  },


});
