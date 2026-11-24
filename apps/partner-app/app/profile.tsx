import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useActivityMotion } from '@/components/activity-motion';
import { ActivityIndicator, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCaseBottomNavigation } from '@/components/partner-case-bottom-navigation';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PARTNER_PROFILE_PHOTO_BUCKET, partnerProfilePhotoPath } from '@/lib/partner-profile-photo';
import { supabase } from '@/lib/supabase';
import { signedInOrganizationName, signedInPersonName, signedInPersonRole } from '@/lib/signed-in-person';
import { usePartnerSession } from '@/providers/partner-session-provider';

const native = Platform.OS !== 'web';
const spring = { stiffness: 205, damping: 23, mass: 0.8, overshootClamping: true, useNativeDriver: native, isInteraction: false } as const;
function useProfileEntrance(motion: boolean, delay = 0) {
  const value = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion) { value.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    value.setValue(0);
    const animation = Animated.sequence([Animated.delay(delay), Animated.spring(value, { ...spring, toValue: 1 })]);
    animation.start();
    return () => { animation.stop(); value.setValue(1); };
  }, [motion, delay, value]);
  return value;
}
function entrance(value: Animated.Value, distance = 5, scale = 0.98) {
  return { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }, { scale: value.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) }] };
}
function useProfileAmbient(motion: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { value.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
      Animated.timing(value, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
      Animated.delay(2200),
    ]));
    animation.start();
    return () => { animation.stop(); value.setValue(0); };
  }, [motion, value]);
  return value;
}
function useProfilePress(motion: boolean) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!motion) value.setValue(0); return () => value.stopAnimation(); }, [motion, value]);
  const move = (toValue: number) => { if (motion) Animated.spring(value, { ...spring, toValue }).start(); };
  return { value, onPressIn: () => move(1), onPressOut: () => move(0) };
}
const ringSegments = Array.from({ length: 48 }, (_, index) => {
  const angle = index * Math.PI * 2 / 48;
  return { left: 37 - 35 * Math.sin(angle), top: 37 - 35 * Math.cos(angle), backgroundColor: index < 12 ? '#6CA9F0' : index < 24 ? '#A5C9FC' : index < 36 ? '#D1E3FF' : '#BDD4FB' };
});
export default function ProfileScreen() {
  const router = useRouter();
  const { context, avatarUri, refreshAvatar, signOut } = usePartnerSession();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const { motion, visible } = useActivityMotion();
  const enabled = motion && !!context;
  const ambient = useProfileAmbient(enabled);
  const avatarEntrance = useProfileEntrance(enabled);
  const nameEntrance = useProfileEntrance(enabled, 100);
  const roleEntrance = useProfileEntrance(enabled, 210);
  const designationEntrance = useProfileEntrance(enabled, 320);
  const cameraPress = useProfilePress(enabled);
  const logoutPress = useProfilePress(enabled);
  const pickerBusy = useRef(false);
  const [selecting, setSelecting] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const success = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!photoSuccess) return;
    success.setValue(enabled ? 0.75 : 1);
    const animation = Animated.spring(success, { ...spring, toValue: 1 });
    if (enabled) animation.start();
    const timer = setTimeout(() => setPhotoSuccess(false), 1500);
    return () => { clearTimeout(timer); animation.stop(); success.setValue(1); };
  }, [photoSuccess, enabled, success]);
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
    if (pickerBusy.current || avatarUploading) return;
    pickerBusy.current = true;
    setSelecting(true);
    setPhotoSuccess(false);
    setAvatarMessage(null);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
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
      setPhotoSuccess(true);
    } catch {
      setAvatarMessage({ tone: 'danger', text: 'Profile photo upload failed. Please try again.' });
    } finally {
      setAvatarUploading(false);
    }
    } catch {
      setAvatarMessage({ tone: 'danger', text: 'Profile photo upload failed. Please try again.' });
    } finally { pickerBusy.current = false; setSelecting(false); }
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
          <Animated.View style={[styles.avatarStage, entrance(avatarEntrance, 3, 0.94)]}>
            <View style={styles.avatarShell}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
              ) : (
                <Text style={styles.avatarText}>{initials(signedInPersonName(identity))}</Text>
              )}
            </View>
            {enabled ? <Animated.View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFillObject, { transform: [{ rotate: ambient.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }]}>{ringSegments.map((segment, index) => <View key={index} style={[styles.ringSegment, segment]} />)}</Animated.View> : null}
            <Animated.View style={[styles.cameraMotion, { transform: [{ scale: cameraPress.value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }) }] }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              disabled={avatarUploading || selecting}
              onPressIn={cameraPress.onPressIn} onPressOut={cameraPress.onPressOut}
              onPress={() => void changeProfilePhoto()}
              style={({ pressed }) => [
                styles.avatarCamera,
                styles.cameraInner,
                (pressed || avatarUploading) && styles.avatarCameraDisabled,
              ]}
            >
              {avatarUploading ? (enabled ? <ActivityIndicator size="small" color="#FFFFFF" animating={visible} /> : <Ionicons name="cloud-upload-outline" size={15} color="#FFFFFF" />) : <Animated.View style={{ transform: [{ scale: photoSuccess ? success : 1 }] }}><Ionicons name={photoSuccess ? 'checkmark' : 'camera'} size={15} color="#FFFFFF" /></Animated.View>}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 13, backgroundColor: '#B5D9FF', opacity: cameraPress.value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }) }]} />
            </Pressable></Animated.View>
          </Animated.View>

          <View style={styles.heroBody}>
            <Animated.Text style={[styles.name, entrance(nameEntrance)]} numberOfLines={2}>{signedInPersonName(identity)}</Animated.Text>
            <Animated.View style={[styles.rolePill, entrance(roleEntrance), { overflow: 'hidden' }]}>
              {enabled ? <Animated.View pointerEvents="none" style={[styles.roleShimmer, { opacity: ambient.interpolate({ inputRange: [0, 0.4, 0.7, 1], outputRange: [0, 0.25, 0.25, 0] }), transform: [{ translateX: ambient.interpolate({ inputRange: [0, 1], outputRange: [-35, 160] }) }, { rotate: '20deg' }] }]} /> : null}
              <Text style={styles.roleText}>{roleLabel}</Text>
            </Animated.View>
            {identity.actor_kind === 'employee' && identity.designation ? <Animated.Text style={[styles.heroDesignation, entrance(designationEntrance)]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{identity.designation}</Animated.Text> : null}
          </View>

          <Animated.Image
            source={require('../assets/partner/profile/profile-team-3d.png')}
            resizeMode="contain"
            style={[styles.heroArtwork, { transform: [{ translateY: ambient.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }, { scale: ambient.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }]}
            accessible={false}
          />
        </View>
      </View>

      <SectionTitle title="Registration" motion={enabled} />

      <View style={styles.details}>
        {identity.actor_kind === 'employee' ? (
          <>
            <Detail
              motion={enabled} delay={330}
              icon="card-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Employee code"
              value={identity.employee_code}
            />
            <Detail
              motion={enabled} delay={440}
              icon="briefcase-outline"
              iconBackground="#F4EEFF"
              iconColor="#7C46E8"
              label="Designation"
              value={identity.designation || 'Not recorded'}
            />
            <Detail
              motion={enabled} delay={550}
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
              motion={enabled} delay={330}
              icon="card-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Intermediary code"
              value={identity.intermediary_code || 'Not recorded'}
            />
            <Detail
              motion={enabled} delay={440}
              icon="people-outline"
              iconBackground="#EAF9F0"
              iconColor="#11A86B"
              label="Role"
              value={roleLabel}
            />
            <Detail
              motion={enabled} delay={550}
              icon="business-outline"
              iconBackground="#EEF5FF"
              iconColor="#0C6FE8"
              label="Organization"
              value={organizationName || 'Not recorded'}
            />
            <Detail
              motion={enabled} delay={660}
              icon="pricetag-outline"
              iconBackground="#F4EEFF"
              iconColor="#7C46E8"
              label="Partner code"
              value={identity.partner_code}
            />
            <Detail
              motion={enabled} delay={770}
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

      <Animated.View style={{ transform: [{ scale: logoutPress.value.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }}><Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPressIn={logoutPress.onPressIn} onPressOut={logoutPress.onPressOut}
        disabled={signingOut}
        onPress={() => setLogoutOpen(true)}
        style={({ pressed }) => [
          styles.logoutButton,
          (pressed || signingOut) && styles.logoutButtonPressed,
        ]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: 16, backgroundColor: '#F4CDD4', opacity: logoutPress.value.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }) }]} />
        <Animated.View style={{ transform: [{ translateX: logoutPress.value.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) }] }}><Ionicons name="log-out-outline" size={20} color="#C43D4B" /></Animated.View>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </Pressable></Animated.View>

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

function SectionTitle({ title, motion }: { title: string; motion: boolean }) {
  const appear = useProfileEntrance(motion, 220);
  return (
    <View style={styles.sectionTitleRow}>
      <Animated.View style={[styles.sectionTitleIcon, entrance(appear, 3, 0.9)]}><Image source={require('../assets/partner/profile/registration-3d.png')} style={styles.registrationTitleArtwork} resizeMode="contain" accessible={false} /></Animated.View>
      <Animated.Text style={[styles.sectionTitle, { opacity: appear }]}>{title}</Animated.Text>
      <View style={[styles.sectionTitleRule, { backgroundColor: 'transparent', overflow: 'hidden' }]}><Animated.View style={{ flex: 1, backgroundColor: '#8D50D9', transformOrigin: 'left center', transform: [{ scaleX: appear }] }} /></View>
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
  motion, delay,
}: {
  motion: boolean; delay: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBackground: string;
  iconColor: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const artwork = registrationIcons[label];
  const appear = useProfileEntrance(motion, delay);
  const iconAppear = useProfileEntrance(motion, delay + 70);
  return (
    <Animated.View style={[styles.detailRow, isLast && styles.detailRowLast, { borderColor: iconBackground, shadowColor: iconColor }, entrance(appear)]}>
      <Animated.View style={[styles.detailIcon, { backgroundColor: iconBackground }, entrance(iconAppear, 3, 0.9)]}>
        {artwork ? <Image source={artwork} style={styles.detailArtworkLeft} resizeMode="contain" accessible={false} /> : <Ionicons name={icon} size={24} color={iconColor} />}
        {motion ? <Animated.View pointerEvents="none" style={[styles.iconReflection, { opacity: iconAppear.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.24, 0] }) }]} /> : null}
      </Animated.View>
      <View style={[styles.detailVerticalRule, { backgroundColor: iconColor }]} />
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value || 'Not recorded'}</Text>
      </View>
    </Animated.View>
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
  ringSegment: { position: 'absolute', width: 2, height: 2, borderRadius: 1 },
  cameraMotion: { position: 'absolute', right: -1, bottom: -1, width: 26, height: 26, zIndex: 8 },
  cameraInner: { right: 0, bottom: 0 },
  roleShimmer: { position: 'absolute', top: -8, bottom: -8, width: 15, backgroundColor: '#FFFFFF' },
  iconReflection: { position: 'absolute', top: 3, left: 6, right: 6, height: 12, borderRadius: 8, backgroundColor: '#FFFFFF' },
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
    marginTop: 3,
    marginHorizontal: 0,
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 82,
  },
  heroArtwork: {
    flexShrink: 0,
    width: 65,
    height: 75,
  },
  avatarStage: {
    width: 76,
    height: 76,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
  },
  avatarCamera: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B63CE',
    borderWidth: 2,
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
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  rolePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E7EEFF',
  },
  heroDesignation: { marginTop: 4, maxWidth: '100%', color: '#536B91', fontSize: 9.5, lineHeight: 12.5, fontWeight: '600' },
  roleText: {
    color: '#365CA2',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 12, paddingLeft: 3 },
  sectionTitleIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  registrationTitleArtwork: { width: 34, height: 34 },
  sectionTitle: { color: '#111A35', fontSize: 17, lineHeight: 23, fontWeight: '800' },
  sectionTitleRule: { flex: 1, height: 2, backgroundColor: '#8D50D9', marginLeft: 5 },
  details: { gap: 11, paddingBottom: 5 },
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
    marginTop: 10,
  },
  logoutButton: {
    minHeight: 48,
    marginTop: 10,
    marginBottom: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0CFD4',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutButtonPressed: {
    opacity: 0.7,
  },
  logoutButtonText: {
    color: '#B83B49',
    fontSize: 15,
    fontWeight: '700',
  },
});
