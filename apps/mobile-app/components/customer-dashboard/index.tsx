import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Linking, Platform, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';

import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Claim } from '@/lib/types';

export type DashboardCounts = { vehicles: number; policies: number; claims: number };
const claimsDeskPhone = '+916264911014';

export type ActiveClaimView = {
  id: string;
  claimNo: string;
  vehicleNo: string;
  status: Claim['current_status'];
  lastUpdated: string;
};

const progressSteps = [
  { label: 'Reported', icon: 'alert-circle-check-outline' },
  { label: 'Documents', icon: 'file-document-check-outline' },
  { label: 'Survey', icon: 'clipboard-search-outline' },
  { label: 'Approval', icon: 'file-certificate-outline' },
  { label: 'Repair', icon: 'wrench-outline' },
  { label: 'Payment', icon: 'cash-check' },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.animatedBody, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function DashboardHeader({ name, onProfile, onHome }: { name: string; onProfile: () => void; onHome?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerWash} />
      <View style={styles.brandRow}>
        <Pressable accessibilityRole="button" onPress={onHome} style={styles.brandHome}>
          <BrandLogo width={138} style={styles.headerLogo} />
        </Pressable>
        <View style={styles.notificationButton}>
          <NotificationBell />
        </View>
        <Pressable accessibilityRole="button" onPress={onProfile} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialFor(name)}</Text>
        </Pressable>
      </View>
      <Text style={styles.greeting}>{greeting()}, <Text style={styles.greetingName}>{name}</Text></Text>
    </View>
  );
}

export function NextStepCard({ hasClaim, required, count, onUpload }: { hasClaim: boolean; required: boolean; count: number; onUpload: () => void; onReport: () => void }) {
  const title = required ? 'Documents needed' : hasClaim ? 'No action needed' : 'No active claim';
  const body = required
    ? `${count} request${count === 1 ? '' : 's'} pending`
    : hasClaim
      ? 'We will notify you when something changes.'
      : 'Start a claim when required.';
  const icon = required ? 'file-alert-outline' : hasClaim ? 'check-circle-outline' : 'information-outline';
  return (
    <View style={[styles.nextStepCard, required ? styles.nextStepWarning : styles.nextStepCalm]}>
      <View style={[styles.nextStepIcon, required ? styles.nextStepIconWarning : styles.nextStepIconCalm]}>
        <MaterialCommunityIcons name={icon} size={required ? 24 : 19} color={required ? palette.amber : roleTheme.customer.accent} />
      </View>
      <View style={styles.nextStepCopy}>
        <Text style={styles.nextStepLabel}>Next step</Text>
        <Text style={styles.nextStepTitle}>{title}</Text>
        <Text style={styles.nextStepText} numberOfLines={1}>{body}</Text>
      </View>
      {required ? (
        <AnimatedPressable onPress={onUpload} style={[styles.nextStepButton, styles.nextStepButtonWarning]}>
          <Text style={styles.nextStepButtonText}>Upload</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

export function AccidentHeroCard({ onPress }: { onPress: () => void; hasActiveClaim?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.34] });

  return (
    <AnimatedPressable onPress={onPress} style={styles.accidentHero}>
      <View style={styles.heroAura} />
      <Animated.View style={[styles.heroPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
      <View style={styles.heroMainRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Report an accident</Text>
        </View>
        <View style={styles.heroGraphic}>
          <View style={styles.heroRouteArc} />
          <View style={styles.heroRouteArcSmall} />
          <View style={[styles.heroRouteNode, styles.heroRouteNodeStart]} />
          <View style={[styles.heroRouteNode, styles.heroRouteNodeEnd]} />
          <View style={styles.heroVehiclePlate}>
            <MaterialCommunityIcons name="truck-cargo-container" size={38} color={palette.surface} />
          </View>
          <View style={styles.heroAlertBadge}>
            <MaterialCommunityIcons name="alert" size={18} color={palette.surface} />
          </View>
          <View style={styles.heroArrowBadge}>
            <MaterialCommunityIcons name="arrow-right" size={22} color={palette.blue} />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export function ActiveClaimCard({ claim, claims, onOpen }: { claim?: ActiveClaimView | null; claims?: ActiveClaimView[]; onOpen: (claim?: ActiveClaimView) => void }) {
  const visibleClaims = claims ?? (claim ? [claim] : []);
  const { width } = useWindowDimensions();
  const claimSlideWidth = Math.max(280, width - 60);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Active claim</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{visibleClaims.length}</Text>
          </View>
        </View>
        {visibleClaims.length > 1 ? <Text style={styles.cardHint}>Swipe</Text> : null}
      </View>
      {visibleClaims.length ? (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={visibleClaims.length > 1}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.claimSlider, visibleClaims.length === 1 && styles.claimSliderSingle]}
        >
          {visibleClaims.map((item) => (
            <ClaimSlide key={item.id} item={item} width={claimSlideWidth} onOpen={onOpen} />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="shield-search" size={30} color={palette.blue} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No active claims</Text>
            <Text style={styles.emptyText}>New claims will appear here.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function ClaimSlide({ item, width, onOpen }: { item: ActiveClaimView; width: number; onOpen: (claim?: ActiveClaimView) => void }) {
  const tone = claimStageTone(item.status);

  return (
    <View style={[styles.claimSlide, { width, backgroundColor: tone.background, borderColor: tone.border }]}>
      <View style={[styles.claimHeroGlow, { backgroundColor: tone.wash }]} />
      <View style={[styles.claimHeroGlowSecondary, { backgroundColor: tone.washAlt }]} />
      <View style={styles.claimTopRow}>
        <View style={[styles.claimIconBubble, { backgroundColor: tone.accent }]}>
          <MaterialCommunityIcons name="truck-fast-outline" size={24} color={palette.surface} />
        </View>
        <View style={styles.claimTopCopy}>
          <Text style={styles.claimNo} numberOfLines={1}>{item.claimNo}</Text>
          <Text style={styles.lastUpdated}>Updated {item.lastUpdated}</Text>
        </View>
      </View>
      <View style={styles.claimTruckGraphic}>
        <View style={styles.claimTruckCab}>
          <View style={styles.claimTruckGlass} />
        </View>
        <View style={styles.claimTruckBody} />
        <View style={styles.claimTruckWheelA} />
        <View style={styles.claimTruckWheelB} />
      </View>
      <View style={styles.claimFacts}>
        <View style={styles.claimFact}>
          <Text style={styles.claimFactLabel}>Vehicle No.</Text>
          <Text style={styles.claimFactValue} numberOfLines={2}>{item.vehicleNo}</Text>
        </View>
        <View style={[styles.claimFact, styles.claimStageFact]}>
          <Text style={styles.claimFactLabel}>Stage</Text>
          <View style={styles.stageBadge}>
            <View style={[styles.stageDot, { backgroundColor: tone.accent }]} />
            <Text style={styles.stageBadgeText} numberOfLines={2}>{item.status}</Text>
          </View>
        </View>
      </View>
      <ProgressSteps status={item.status} accent={tone.accent} />
      <AnimatedPressable onPress={() => onOpen(item)} style={[styles.primarySmallButton, { backgroundColor: tone.button }]}>
        <Text style={styles.primarySmallButtonText}>View Claim</Text>
      </AnimatedPressable>
    </View>
  );
}

type ClaimStageTone = {
  background: string;
  wash: string;
  washAlt: string;
  border: string;
  accent: string;
  button: string;
};

function claimStageTone(status: Claim['current_status']): ClaimStageTone {
  if (status === 'Draft' || status === 'Accident Reported' || status === 'Initial Documents Pending' || status === 'Documents Pending' || status === 'Final Documents Awaited') {
    return { background: '#FFF8EA', wash: 'rgba(245,158,11,0.14)', washAlt: 'rgba(255,255,255,0.74)', border: '#F4D999', accent: palette.amber, button: '#D97706' };
  }
  if (status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Documents Submitted' || status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted') {
    return { background: '#EFFBFD', wash: 'rgba(14,175,200,0.13)', washAlt: 'rgba(255,255,255,0.76)', border: '#BCEBF1', accent: palette.cyan, button: '#078EA3' };
  }
  if (status === 'Initial Documents Verified' || status === 'Final Documents Verified') {
    return { background: '#F0FBF5', wash: 'rgba(16,166,111,0.13)', washAlt: 'rgba(255,255,255,0.78)', border: '#BFEBD0', accent: palette.emerald, button: '#07885A' };
  }
  if (status === 'Claim Intimated' || status === 'Surveyor Appointed' || status === 'Vehicle Inspected') {
    return { background: '#F2F7FF', wash: 'rgba(7,94,234,0.13)', washAlt: 'rgba(14,175,200,0.08)', border: '#C9DDFF', accent: palette.blue, button: palette.blue };
  }
  if (status === 'Estimate Submitted' || status === 'Approval Pending') {
    return { background: '#F7F5FF', wash: 'rgba(98,87,215,0.13)', washAlt: 'rgba(255,255,255,0.78)', border: '#D8D4FF', accent: palette.violet, button: '#5548C8' };
  }
  if (status === 'Repair Started' || status === 'Repair Completed' || status === 'DO Submitted' || status === 'Final Bill Submitted') {
    return { background: '#FFF4EF', wash: 'rgba(229,72,77,0.1)', washAlt: 'rgba(245,158,11,0.1)', border: '#FFD2C7', accent: '#E05F2D', button: '#C94E20' };
  }
  if (status === 'Settlement Under Process' || status === 'Settled' || status === 'Closed') {
    return { background: '#EFFAF4', wash: 'rgba(16,166,111,0.14)', washAlt: 'rgba(14,175,200,0.07)', border: '#BCEBD5', accent: palette.emerald, button: '#07885A' };
  }
  if (status === 'Rejected') {
    return { background: '#FFF1F2', wash: 'rgba(229,72,77,0.12)', washAlt: 'rgba(255,255,255,0.76)', border: '#FAC7C9', accent: palette.coral, button: palette.coral };
  }
  return { background: palette.surface, wash: palette.blueSoft, washAlt: 'rgba(255,255,255,0.8)', border: palette.line, accent: palette.blue, button: palette.blue };
}

export function ActionRequiredCard({ required, count, onUpload }: { required: boolean; count: number; onUpload: () => void }) {
  return (
    <View style={[styles.statusCard, required ? styles.actionCard : styles.successCard]}>
      <View style={[styles.statusIcon, required ? styles.actionIcon : styles.successIcon]}>
        <MaterialCommunityIcons name={required ? 'file-alert-outline' : 'truck-check-outline'} size={25} color={required ? '#B54708' : '#067647'} />
      </View>
      <View style={styles.statusCopy}>
        <Text style={[styles.statusTitle, required ? styles.actionTitle : styles.successTitle]}>{required ? 'Action Required' : 'No action required'}</Text>
        <Text style={styles.statusText}>{required ? `${count} document request${count === 1 ? '' : 's'} open.` : 'No document request is open.'}</Text>
      </View>
      {required ? (
        <AnimatedPressable onPress={onUpload} style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>Upload Now</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

export function QuickActionGrid({ actions }: { actions: { title: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; onPress: () => void }[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.quickGrid}>
        {actions.map((action) => (
          <AnimatedPressable key={action.title} onPress={action.onPress} wrapperStyle={styles.quickCardSlot} style={styles.quickCard}>
            <View style={[styles.quickIconTile, { backgroundColor: action.tone }]}>
              <MaterialCommunityIcons name={action.icon} size={20} color={palette.ink} />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle} numberOfLines={2}>{action.title}</Text>
            </View>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

export function SummaryCards({ counts, onVehicles, onPolicies, onClaims }: { counts: DashboardCounts; onVehicles?: () => void; onPolicies?: () => void; onClaims?: () => void }) {
  const items = [
    { label: 'Vehicles', value: counts.vehicles, icon: 'truck-outline' as const, color: '#E8F1FB', onPress: onVehicles },
    { label: 'Policies', value: counts.policies, icon: 'file-certificate-outline' as const, color: '#EAF8F0', onPress: onPolicies },
    { label: 'Claims', value: counts.claims, icon: 'file-document-check-outline' as const, color: '#FFF4E5', onPress: onClaims },
  ];

  return (
    <View style={styles.summaryRow}>
      {items.map((item) => (
        <Pressable key={item.label} accessibilityRole="button" onPress={item.onPress} style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: item.color }]}>
            <MaterialCommunityIcons name={item.icon} size={21} color={palette.ink} />
          </View>
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PolicyReminderCard({ vehicleNo, expiry, onView }: { vehicleNo?: string; expiry?: string; onView: () => void }) {
  return (
    <View style={styles.policyReminderCard}>
      <View style={styles.policyReminderWashBlue} />
      <View style={styles.policyReminderWashGreen} />
      {vehicleNo && expiry ? (
        <>
          <View style={styles.policyReminderHeader}>
            <View style={styles.policyReminderIcon}>
              <MaterialCommunityIcons name="calendar-alert-outline" size={23} color={palette.amber} />
            </View>
            <View style={styles.policyReminderCopy}>
              <Text style={styles.policyReminderKicker}>Renewal reminder</Text>
              <Text style={styles.policyReminderTitle}>Policy expiring soon</Text>
            </View>
          </View>
          <View style={styles.policyReminderInfo}>
            <Text style={styles.policyReminderVehicle}>{vehicleNo}</Text>
            <Text style={styles.policyReminderDate}>Expires {expiry}</Text>
          </View>
          <AnimatedPressable onPress={onView} style={styles.policyReminderButton}>
            <Text style={styles.policyReminderButtonText}>View Policy</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={palette.surface} />
          </AnimatedPressable>
        </>
      ) : (
        <>
          <View style={styles.policyReminderHeader}>
            <View style={styles.policyReminderIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={23} color={roleTheme.customer.accent} />
            </View>
            <View style={styles.policyReminderCopy}>
              <Text style={styles.policyReminderKicker}>Policy reminders</Text>
              <Text style={styles.policyReminderTitle}>No renewal due</Text>
            </View>
          </View>
          <Text style={styles.policyReminderText}>No renewal is due in the next 30 days.</Text>
        </>
      )}
    </View>
  );
}

export function SupportCard({ onSupport }: { onSupport: () => void }) {
  return (
    <View style={styles.supportCard}>
      <View style={styles.supportGradientBlue} />
      <View style={styles.supportGradientGreen} />
      <View style={styles.supportGradientAmber} />
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle}>Claims Desk</Text>
        <Text style={styles.supportText}>Quick claim support and escalation</Text>
        <Text style={styles.supportPhone}>{claimsDeskPhone}</Text>
      </View>
      <View style={styles.supportActions}>
        <SupportButton label="Call" icon="phone-outline" onPress={() => void callClaimsDesk()} />
        <SupportButton label="WhatsApp" icon="whatsapp" onPress={() => void openClaimsDeskWhatsApp()} />
        <SupportButton label="Callback" icon="phone-return-outline" onPress={() => void requestClaimsDeskCallback(onSupport)} />
      </View>
    </View>
  );
}

export function BottomNavigation({ onClaims, onVehicles, onSupport, onProfile }: { onClaims: () => void; onVehicles: () => void; onSupport: () => void; onProfile: () => void }) {
  return (
    <View style={styles.bottomNav}>
      <BottomItem label="Home" icon="home-variant" active tone={{ accent: palette.navy, soft: palette.amberSoft }} />
      <BottomItem label="Claims" icon="file-document-check-outline" onPress={onClaims} tone={{ accent: palette.navy, soft: palette.blueSoft }} />
      <BottomItem label="Vehicles" icon="truck-outline" onPress={onVehicles} tone={{ accent: palette.navy, soft: palette.blueSoft }} />
      <BottomItem label="Support" icon="headset" onPress={onSupport} tone={{ accent: palette.navy, soft: palette.amberSoft }} />
      <BottomItem label="Profile" icon="account-outline" onPress={onProfile} tone={{ accent: palette.navy, soft: palette.blueSoft }} />
    </View>
  );
}

function ProgressSteps({ status, accent = roleTheme.customer.accent }: { status: Claim['current_status']; accent?: string }) {
  const activeIndex = progressIndex(status);
  return (
    <View style={styles.progressGrid}>
      {progressSteps.map((step, index) => {
        const completed = index < activeIndex;
        const current = index === activeIndex;
        return (
          <View key={step.label} style={styles.progressItem}>
            <View style={[styles.progressDot, completed && { backgroundColor: accent, borderColor: accent }, current && { backgroundColor: accent, borderColor: accent }]}>
              {completed ? (
              <MaterialCommunityIcons name={step.icon} size={16} color={palette.surface} />
            ) : (
              <Text style={[styles.progressNumber, current && styles.progressNumberCurrent]}>{index + 1}</Text>
            )}
            </View>
            <Text style={[styles.progressText, (completed || current) && styles.progressTextActive]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function SupportButton({ label, icon, onPress, disabled = false }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress?: () => void; disabled?: boolean }) {
  return (
    <AnimatedPressable disabled={disabled} onPress={onPress} wrapperStyle={styles.supportButtonSlot} style={[styles.supportButton, disabled && styles.supportButtonDisabled]}>
      <MaterialCommunityIcons name={icon} size={20} color={palette.blue} />
      <Text style={[styles.supportButtonText, disabled && styles.supportButtonTextDisabled]} numberOfLines={1}>{label}</Text>
    </AnimatedPressable>
  );
}

async function callClaimsDesk() {
  await Linking.openURL(`tel:${claimsDeskPhone}`);
}

async function openClaimsDeskWhatsApp() {
  const phone = claimsDeskPhone.replace(/[^\d]/g, '');
  const appUrl = `whatsapp://send?phone=${phone}`;
  const webUrl = `https://wa.me/${phone}`;
  const supported = await Linking.canOpenURL(appUrl);
  await Linking.openURL(supported ? appUrl : webUrl);
}

async function requestClaimsDeskCallback(fallback: () => void) {
  const body = encodeURIComponent('Please call me back regarding my claim.');
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${claimsDeskPhone}${separator}body=${body}`;
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
    return;
  }
  fallback();
}

function BottomItem({ label, icon, onPress, active = false, tone }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress?: () => void; active?: boolean; tone: { accent: string; soft: string } }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress} style={styles.bottomItem}>
      <View style={[styles.bottomIconShell, active && [styles.bottomIconShellActive, { borderColor: tone.accent }]]}>
        <MaterialCommunityIcons name={icon} size={19} color={active ? tone.accent : palette.slate} />
      </View>
      <Text style={[styles.bottomText, active && { color: tone.accent }]}>{label}</Text>
    </Pressable>
  );
}

function AnimatedPressable({ children, style, wrapperStyle, disabled, ...props }: PressableProps & { children: ReactNode; wrapperStyle?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={(event) => {
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 5 }).start();
          props.onPressOut?.(event);
        }}
        style={(state) => [
          typeof style === 'function' ? style(state) : style,
          state.pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'I';
}

function progressIndex(status: Claim['current_status']) {
  if (status === 'Initial Documents Pending' || status === 'Initial Documents Verification Pending' || status === 'Initial Documents Submitted' || status === 'Initial Documents Verified' || status === 'Documents Pending' || status === 'Documents Submitted') return 1;
  if (status === 'Claim Intimated' || status === 'Surveyor Appointed' || status === 'Vehicle Inspected') return 2;
  if (status === 'Final Documents Awaited' || status === 'Final Documents Verification Pending' || status === 'Final Documents Submitted' || status === 'Final Documents Verified' || status === 'Estimate Submitted' || status === 'Approval Pending') return 3;
  if (status === 'Repair Started' || status === 'Repair Completed' || status === 'DO Submitted' || status === 'Final Bill Submitted') return 4;
  if (status === 'Settlement Under Process' || status === 'Settled') return 5;
  return 0;
}

const styles = StyleSheet.create({
  animatedBody: { width: '100%' },
  header: { marginHorizontal: -16, paddingHorizontal: 8, paddingBottom: 10, marginBottom: 0, paddingTop: 4, backgroundColor: 'transparent', zIndex: 10, overflow: 'hidden' },
  headerWash: { position: 'absolute', left: -70, top: -88, width: 210, height: 210, borderRadius: 105, backgroundColor: palette.emeraldSoft },
  headerGlow: { position: 'absolute', right: -38, top: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: palette.blueSoft },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  brandHome: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line },
  headerLogo: { alignSelf: 'flex-start' },
  brandText: { color: palette.ink, fontSize: 22, fontWeight: '800' },
  notificationButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.line, marginLeft: 'auto' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: palette.surface, fontSize: 16, fontWeight: '800' },
  greeting: { color: palette.ink, fontSize: 18, fontWeight: '500', lineHeight: 24 },
  greetingName: { fontWeight: '700' },
  headerSubtitle: { color: palette.slate, fontSize: 13, lineHeight: 19, marginTop: 5, maxWidth: 310 },
  nextStepCard: { borderRadius: radii.md, padding: 10, marginTop: -2, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1 },
  nextStepCalm: { backgroundColor: 'rgba(255,255,255,0.74)', borderColor: 'rgba(224,231,240,0.82)' },
  nextStepWarning: { backgroundColor: palette.amberSoft, borderColor: '#F7D58B' },
  nextStepIcon: { width: 42, height: 42, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  nextStepIconCalm: { backgroundColor: 'rgba(232,248,240,0.72)' },
  nextStepIconWarning: { backgroundColor: '#FFE7B0' },
  nextStepCopy: { flex: 1, minWidth: 0 },
  nextStepLabel: { color: palette.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  nextStepTitle: { color: palette.ink, fontSize: 15, fontWeight: '700', marginTop: 1 },
  nextStepText: { color: palette.slate, fontSize: 12, lineHeight: 16, marginTop: 1 },
  nextStepButton: { minHeight: 40, borderRadius: radii.sm, backgroundColor: roleTheme.customer.accent, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  nextStepButtonWarning: { backgroundColor: palette.amber },
  nextStepButtonText: { color: palette.surface, fontSize: 12, fontWeight: '700' },
  accidentHero: { minHeight: 112, marginBottom: 10, borderRadius: radii.lg, padding: 15, overflow: 'hidden', backgroundColor: '#075EEA', borderWidth: 1, borderColor: '#0750C7', shadowColor: '#075EEA', shadowOpacity: 0.18, shadowRadius: 18, elevation: 4 },
  heroAura: { position: 'absolute', width: 270, height: 270, borderRadius: 135, right: -92, top: -108, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroPulse: { position: 'absolute', right: 22, top: 22, width: 84, height: 84, borderRadius: 42, backgroundColor: '#FFFFFF' },
  heroLabelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 28, borderRadius: 12, backgroundColor: palette.blueSoft, paddingHorizontal: 10, marginBottom: 7, borderWidth: 1, borderColor: '#C7DEFF' },
  heroMainRow: { flexDirection: 'row', alignItems: 'center', minHeight: 82 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroLabel: { color: palette.blue, fontSize: 12, fontWeight: '700' },
  heroTitle: { color: palette.surface, fontSize: 22, fontWeight: '900', lineHeight: 27 },
  heroText: { color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 18, marginTop: 7, maxWidth: 230, fontWeight: '600' },
  heroChecklist: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  heroCheckItem: { minHeight: 28, borderRadius: 13, backgroundColor: palette.emeraldSoft, borderWidth: 1, borderColor: '#BCEBD5', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroCheckText: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  heroButton: { marginTop: 12, alignSelf: 'flex-start', borderRadius: radii.sm, backgroundColor: palette.blue, paddingHorizontal: 14, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroButtonText: { color: palette.surface, fontSize: 14, fontWeight: '700' },
  heroGraphic: { width: 104, minHeight: 86, alignItems: 'center', justifyContent: 'center' },
  heroRouteArc: { position: 'absolute', width: 96, height: 54, borderRadius: 30, borderTopWidth: 2, borderColor: 'rgba(255,255,255,0.46)', transform: [{ rotate: '-8deg' }] },
  heroRouteArcSmall: { position: 'absolute', width: 58, height: 34, borderRadius: 22, borderTopWidth: 2, borderColor: 'rgba(255,255,255,0.26)', right: 10, top: 18, transform: [{ rotate: '9deg' }] },
  heroRouteNode: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: palette.surface },
  heroRouteNodeStart: { left: 7, bottom: 24 },
  heroRouteNodeEnd: { right: 8, top: 21 },
  heroVehiclePlate: { width: 70, height: 56, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)', alignItems: 'center', justifyContent: 'center' },
  heroAlertBadge: { position: 'absolute', left: 12, top: 4, width: 31, height: 31, borderRadius: 12, backgroundColor: palette.amber, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  heroArrowBadge: { position: 'absolute', right: 0, bottom: 4, width: 38, height: 38, borderRadius: 15, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#C7DEFF', alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  card: { backgroundColor: palette.surface, borderRadius: radii.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: palette.line, shadowColor: palette.ink, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '800' },
  countPill: { minWidth: 27, height: 24, borderRadius: 12, paddingHorizontal: 8, backgroundColor: palette.blueSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7DEFF' },
  countPillText: { color: palette.blue, fontSize: 12, fontWeight: '900' },
  cardHint: { color: palette.slate, fontSize: 12, fontWeight: '600' },
  textActionButton: { paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  textAction: { color: '#0B63CE', fontSize: 13, fontWeight: '900' },
  claimTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  claimIconBubble: { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  claimTopCopy: { flex: 1, minWidth: 0 },
  claimNo: { color: palette.ink, fontSize: 18, fontWeight: '800' },
  claimMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  vehiclePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#E8F1FB', borderRadius: 16, paddingHorizontal: 12, minHeight: 42 },
  vehicleText: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  claimSlider: { gap: 10 },
  claimSliderSingle: { gap: 0 },
  claimSlide: { minHeight: 216, borderRadius: radii.md, overflow: 'hidden', padding: 14, backgroundColor: palette.surface, borderWidth: 1 },
  claimHeroGlow: { position: 'absolute', right: -58, top: -72, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(255,255,255,0.16)' },
  claimHeroGlowSecondary: { position: 'absolute', left: -80, bottom: -88, width: 190, height: 190, borderRadius: 95 },
  claimTruckGraphic: { position: 'absolute', right: 8, top: 74, width: 104, height: 56, opacity: 0.16 },
  claimTruckCab: { position: 'absolute', left: 0, bottom: 12, width: 42, height: 38, borderRadius: 10, backgroundColor: '#7B8A9A', padding: 7 },
  claimTruckGlass: { width: 18, height: 11, borderRadius: 4, backgroundColor: '#BFD8FF', alignSelf: 'flex-end' },
  claimTruckBody: { position: 'absolute', left: 38, right: 0, bottom: 12, height: 40, borderRadius: 10, backgroundColor: '#A8B7C7' },
  claimTruckWheelA: { position: 'absolute', left: 26, bottom: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#17202F' },
  claimTruckWheelB: { position: 'absolute', right: 18, bottom: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#17202F' },
  claimFacts: { flexDirection: 'row', gap: 9, marginBottom: 10, zIndex: 2 },
  claimFact: { flex: 1, minWidth: 0 },
  claimStageFact: { alignItems: 'flex-start' },
  claimFactLabel: { color: palette.slate, fontSize: 12, marginBottom: 5, fontWeight: '700' },
  claimFactValue: { color: palette.ink, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  stageBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 9, paddingVertical: 5, minHeight: 34, maxWidth: '100%', shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: roleTheme.customer.accent },
  stageBadgeText: { color: palette.ink, fontSize: 11, fontWeight: '800', lineHeight: 15, flexShrink: 1 },
  lastUpdated: { color: palette.slate, fontSize: 12, marginTop: 2 },
  progressGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, borderTopWidth: 1, borderTopColor: 'rgba(17,24,39,0.08)', paddingTop: 14 },
  progressItem: { flex: 1, alignItems: 'center' },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#C7D7EA', alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  progressNumber: { color: '#98A2B3', fontSize: 13, fontWeight: '700' },
  progressNumberCurrent: { color: '#FFFFFF' },
  progressText: { color: palette.muted, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  progressTextActive: { color: palette.ink, fontWeight: '800' },
  emptyState: { flexDirection: 'row', gap: 13, backgroundColor: palette.surfaceAlt, borderRadius: radii.lg, padding: 14, borderWidth: 1, borderColor: palette.line },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: palette.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyText: { color: palette.slate, fontSize: 14, lineHeight: 20 },
  statusCard: { borderRadius: 18, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1 },
  actionCard: { backgroundColor: palette.amberSoft, borderColor: '#FEDF89' },
  successCard: { backgroundColor: palette.emeraldSoft, borderColor: '#B7E4C7' },
  statusIcon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { backgroundColor: '#FFEDD5' },
  successIcon: { backgroundColor: '#D1FADF' },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 17, fontWeight: '900', marginBottom: 3 },
  actionTitle: { color: '#B54708' },
  successTitle: { color: '#067647' },
  statusText: { color: '#667085', fontSize: 13, lineHeight: 18 },
  uploadButton: { backgroundColor: '#F79009', borderRadius: 14, paddingHorizontal: 12, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  uploadButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  sectionTitle: { color: palette.ink, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  quickGrid: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  quickCardSlot: { flex: 1, minWidth: 0 },
  quickCard: { width: '100%', minHeight: 66, backgroundColor: palette.surface, borderRadius: radii.sm, paddingHorizontal: 4, paddingVertical: 8, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', gap: 6 },
  quickIconTile: { width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { alignItems: 'center', alignSelf: 'stretch', minWidth: 0 },
  quickTitle: { color: palette.ink, fontSize: 11, fontWeight: '800', lineHeight: 13, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: radii.sm, padding: 10, borderWidth: 1, borderColor: '#D8DEE8', minHeight: 86 },
  summaryIcon: { width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { color: palette.ink, fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: '#667085', fontSize: 12, fontWeight: '600', marginTop: 3 },
  primarySmallButton: { alignSelf: 'flex-start', minHeight: 42, borderRadius: radii.sm, paddingHorizontal: 16, backgroundColor: roleTheme.customer.accent, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  primarySmallButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  policyReminderCard: { borderRadius: radii.md, padding: 14, marginBottom: 10, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: '#C9DDFF', overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.035, shadowRadius: 10, elevation: 1 },
  policyReminderWashBlue: { position: 'absolute', right: -46, top: -58, width: 156, height: 156, borderRadius: 78, backgroundColor: 'rgba(19,99,223,0.12)' },
  policyReminderWashGreen: { position: 'absolute', left: -60, bottom: -76, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(15,159,110,0.1)' },
  policyReminderHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  policyReminderIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.surface, borderWidth: 1, borderColor: '#D8E7FF', alignItems: 'center', justifyContent: 'center' },
  policyReminderCopy: { flex: 1, minWidth: 0 },
  policyReminderKicker: { color: palette.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  policyReminderTitle: { color: palette.ink, fontSize: 18, fontWeight: '800', marginTop: 2 },
  policyReminderInfo: { borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: '#D8E7FF', padding: 11, marginTop: 12 },
  policyReminderVehicle: { color: palette.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  policyReminderDate: { color: palette.slate, fontSize: 13, fontWeight: '600', marginTop: 3, textAlign: 'center' },
  policyReminderText: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '500', marginTop: 11, textAlign: 'center' },
  policyReminderButton: { alignSelf: 'stretch', minHeight: 42, borderRadius: radii.sm, backgroundColor: palette.blue, alignItems: 'center', justifyContent: 'center', marginTop: 12, flexDirection: 'row', gap: 7 },
  policyReminderButtonText: { color: palette.surface, fontSize: 14, fontWeight: '800' },
  supportCard: { borderRadius: radii.md, padding: 16, marginBottom: 10, backgroundColor: '#F5FAFF', borderWidth: 1, borderColor: '#B9D5FF', overflow: 'hidden', shadowColor: palette.blue, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  supportGradientBlue: { position: 'absolute', left: -80, top: -94, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(19,99,223,0.15)' },
  supportGradientGreen: { position: 'absolute', right: -72, top: -52, width: 172, height: 172, borderRadius: 86, backgroundColor: 'rgba(15,159,110,0.16)' },
  supportGradientAmber: { position: 'absolute', alignSelf: 'center', bottom: -92, width: 240, height: 160, borderRadius: 120, backgroundColor: 'rgba(245,165,36,0.1)' },
  supportGlow: { position: 'absolute', right: -40, top: -42, width: 145, height: 145, borderRadius: 73, backgroundColor: 'rgba(24,160,88,0.22)' },
  supportCopy: { alignItems: 'center', marginBottom: 14 },
  supportTitle: { color: palette.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  supportText: { color: palette.slate, fontSize: 14, lineHeight: 20, marginTop: 5, textAlign: 'center', fontWeight: '600' },
  supportPhone: { color: palette.blue, fontSize: 13, fontWeight: '900', marginTop: 7, textAlign: 'center' },
  supportActions: { flexDirection: 'row', justifyContent: 'center', gap: 9, alignSelf: 'stretch' },
  supportButtonSlot: { width: 96 },
  supportButton: { width: 96, height: 62, borderRadius: radii.sm, backgroundColor: 'rgba(255,255,255,0.86)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderWidth: 1, borderColor: '#D8E7FF', gap: 5 },
  supportButtonDisabled: { backgroundColor: '#FFFFFF', opacity: 0.58 },
  supportButtonText: { color: palette.ink, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  supportButtonTextDisabled: { color: '#667085' },
  bottomNav: { minHeight: 66, backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 5, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: palette.line, shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  bottomItem: { flex: 1, alignItems: 'center', gap: 3, minHeight: 52, justifyContent: 'center' },
  bottomIconShell: { width: 42, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', backgroundColor: 'transparent' },
  bottomIconShellActive: { backgroundColor: '#FFFFFF', shadowColor: palette.ink, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  bottomText: { color: palette.slate, fontSize: 11, fontWeight: '900' },
  bottomTextActive: { color: palette.ink },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.72 },
});





