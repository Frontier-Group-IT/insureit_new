import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { Claim } from '@/lib/types';

export type DashboardCounts = { vehicles: number; policies: number; claims: number };

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
  { label: 'Approval', icon: 'shield-check-outline' },
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

export function DashboardHeader({ name, onProfile }: { name: string; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <MaterialCommunityIcons name="shield-check" size={22} color="#0B1F3A" />
        </View>
        <Text style={styles.brandText}>InsureIT</Text>
        <Pressable accessibilityRole="button" style={styles.notificationButton}>
          <MaterialCommunityIcons name="bell-outline" size={21} color="#0B1F3A" />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onProfile} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialFor(name)}</Text>
        </Pressable>
      </View>
      <Text style={styles.greeting}>
        {greeting()}, <Text style={styles.greetingName}>{name}</Text>
      </Text>
    </View>
  );
}

export function AccidentHeroCard({ onPress }: { onPress: () => void }) {
  return (
    <AnimatedPressable onPress={onPress} style={styles.accidentHero}>
      <View style={styles.heroRings} />
      <View style={styles.heroMainRow}>
        <View style={styles.heroCopy}>
          <View style={styles.heroLabelPill}>
            <MaterialCommunityIcons name="alert-outline" size={15} color="#FFFFFF" />
            <Text style={styles.heroLabel}>Quick Response</Text>
          </View>
          <Text style={styles.heroTitle}>Report New Accident</Text>
          <View style={styles.heroButton}>
            <Text style={styles.heroButtonText}>Start Report</Text>
            <MaterialCommunityIcons name="arrow-right" size={21} color="#B42318" />
          </View>
        </View>
        <View style={styles.heroGraphic}>
          <MaterialCommunityIcons name="truck-cargo-container" size={58} color="#FFFFFF" />
          <View style={styles.warningTriangle}>
            <MaterialCommunityIcons name="alert" size={25} color="#B42318" />
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export function ActiveClaimCard({ claim, onOpen }: { claim: ActiveClaimView | null; onOpen: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Active Claim</Text>
        {claim ? (
          <AnimatedPressable onPress={onOpen} style={styles.textActionButton}>
            <Text style={styles.textAction}>View Details</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#0B63CE" />
          </AnimatedPressable>
        ) : null}
      </View>
      {claim ? (
        <>
          <View style={styles.claimFacts}>
            <View style={styles.claimFact}>
              <Text style={styles.claimFactLabel}>Claim No.</Text>
              <Text style={styles.claimFactValue} numberOfLines={2}>{claim.claimNo}</Text>
            </View>
            <View style={styles.claimFact}>
              <Text style={styles.claimFactLabel}>Vehicle No.</Text>
              <Text style={styles.claimFactValue} numberOfLines={2}>{claim.vehicleNo}</Text>
            </View>
            <View style={styles.claimFact}>
              <Text style={styles.claimFactLabel}>Current Stage</Text>
              <View style={styles.stageBadge}>
                <View style={styles.stageDot} />
                <Text style={styles.stageBadgeText} numberOfLines={2}>{claim.status}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.lastUpdated}>Last Updated: {claim.lastUpdated}</Text>
          <ProgressSteps status={claim.status} />
        </>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="shield-search" size={30} color="#173B68" />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No active claim</Text>
            <Text style={styles.emptyText}>Report a new accident if you need claim assistance.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function ActionRequiredCard({ required, count, onUpload }: { required: boolean; count: number; onUpload: () => void }) {
  return (
    <View style={[styles.statusCard, required ? styles.actionCard : styles.successCard]}>
      <View style={[styles.statusIcon, required ? styles.actionIcon : styles.successIcon]}>
        <MaterialCommunityIcons name={required ? 'file-alert-outline' : 'shield-check-outline'} size={25} color={required ? '#B54708' : '#067647'} />
      </View>
      <View style={styles.statusCopy}>
        <Text style={[styles.statusTitle, required ? styles.actionTitle : styles.successTitle]}>{required ? 'Action Required' : 'No action required'}</Text>
        <Text style={styles.statusText}>{required ? `${count} item${count === 1 ? '' : 's'} need your attention.` : 'Our team will notify you when action is needed.'}</Text>
      </View>
      {required ? (
        <AnimatedPressable onPress={onUpload} style={styles.uploadButton}>
          <Text style={styles.uploadButtonText}>Upload Now</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

export function QuickActionGrid({ actions }: { actions: { title: string; subtitle: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; tone: string; onPress: () => void }[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.quickGrid}>
        {actions.map((action) => (
          <AnimatedPressable key={action.title} onPress={action.onPress} wrapperStyle={styles.quickCardSlot} style={styles.quickCard}>
            <View style={[styles.quickIconTile, { backgroundColor: action.tone }]}>
              <MaterialCommunityIcons name={action.icon} size={24} color="#0B1F3A" />
            </View>
            <View style={styles.quickCopy}>
              <Text style={styles.quickTitle} numberOfLines={1}>{action.title}</Text>
              {action.subtitle ? <Text style={styles.quickSubtitle} numberOfLines={1}>{action.subtitle}</Text> : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={21} color="#667085" />
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

export function SummaryCards({ counts }: { counts: DashboardCounts }) {
  const items = [
    { label: 'Vehicles', value: counts.vehicles, icon: 'truck-outline' as const, color: '#E8F1FB' },
    { label: 'Policies', value: counts.policies, icon: 'shield-outline' as const, color: '#EAF8F0' },
    { label: 'Claims', value: counts.claims, icon: 'file-document-check-outline' as const, color: '#FFF4E5' },
  ];

  return (
    <View style={styles.summaryRow}>
      {items.map((item) => (
        <View key={item.label} style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: item.color }]}>
            <MaterialCommunityIcons name={item.icon} size={21} color="#0B1F3A" />
          </View>
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function PolicyReminderCard({ vehicleNo, expiry, onView }: { vehicleNo?: string; expiry?: string; onView: () => void }) {
  return (
    <View style={styles.card}>
      {vehicleNo && expiry ? (
        <>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Policy Expiring Soon</Text>
            <MaterialCommunityIcons name="calendar-alert" size={24} color="#F79009" />
          </View>
          <Text style={styles.emptyText}>{vehicleNo} · Expires {expiry}</Text>
          <AnimatedPressable onPress={onView} style={styles.primarySmallButton}>
            <Text style={styles.primarySmallButtonText}>View Policy</Text>
          </AnimatedPressable>
        </>
      ) : (
        <>
          <Text style={styles.cardTitle}>Policy reminders</Text>
          <Text style={styles.emptyText}>No policy renewal action is needed right now.</Text>
        </>
      )}
    </View>
  );
}

export function SupportCard({ onSupport }: { onSupport: () => void }) {
  return (
    <View style={styles.supportCard}>
      <View style={styles.supportCopy}>
        <Text style={styles.supportTitle}>Need Help?</Text>
        <Text style={styles.supportText}>We are here to assist you.</Text>
      </View>
      <View style={styles.supportActions}>
        <SupportButton label="Call" icon="phone" disabled />
        <SupportButton label="WhatsApp" icon="whatsapp" disabled />
        <SupportButton label="Callback" icon="phone-return" onPress={onSupport} />
      </View>
    </View>
  );
}

export function BottomNavigation({ onClaims, onVehicles, onDocuments, onSupport }: { onClaims: () => void; onVehicles: () => void; onDocuments: () => void; onSupport: () => void }) {
  return (
    <View style={styles.bottomNav}>
      <BottomItem label="Home" icon="home-variant" active />
      <BottomItem label="Claims" icon="file-document-check-outline" onPress={onClaims} />
      <BottomItem label="Vehicles" icon="truck-outline" onPress={onVehicles} />
      <BottomItem label="Documents" icon="cloud-upload-outline" onPress={onDocuments} />
      <BottomItem label="Support" icon="headset" onPress={onSupport} />
    </View>
  );
}

function ProgressSteps({ status }: { status: Claim['current_status'] }) {
  const activeIndex = progressIndex(status);
  return (
    <View style={styles.progressGrid}>
      {progressSteps.map((step, index) => {
        const completed = index < activeIndex;
        const current = index === activeIndex;
        return (
          <View key={step.label} style={styles.progressItem}>
            <View style={[styles.progressDot, completed && styles.progressCompleted, current && styles.progressCurrent]}>
              {completed ? (
                <MaterialCommunityIcons name="check" size={17} color="#FFFFFF" />
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
    <AnimatedPressable disabled={disabled} onPress={onPress} style={[styles.supportButton, disabled && styles.supportButtonDisabled]}>
      <MaterialCommunityIcons name={icon} size={20} color="#0B63CE" />
      <Text style={[styles.supportButtonText, disabled && styles.supportButtonTextDisabled]}>{label}</Text>
    </AnimatedPressable>
  );
}

function BottomItem({ label, icon, onPress, active = false }: { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress?: () => void; active?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress} style={styles.bottomItem}>
      <MaterialCommunityIcons name={icon} size={20} color={active ? '#18A058' : '#667085'} />
      <Text style={[styles.bottomText, active && styles.bottomTextActive]}>{label}</Text>
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
  if (status === 'Documents Pending' || status === 'Documents Submitted') return 1;
  if (status === 'Claim Intimated' || status === 'Surveyor Appointed' || status === 'Vehicle Inspected') return 2;
  if (status === 'Estimate Submitted' || status === 'Approval Pending') return 3;
  if (status === 'Repair Started' || status === 'Repair Completed' || status === 'Final Bill Submitted') return 4;
  if (status === 'Settlement Under Process' || status === 'Settled') return 5;
  return 0;
}

const styles = StyleSheet.create({
  animatedBody: { width: '100%' },
  header: { marginBottom: 16, paddingTop: 8 },
  headerGlow: { position: 'absolute', right: -38, top: -52, width: 150, height: 150, borderRadius: 75, backgroundColor: '#EAF8F0' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#E8F1FB', alignItems: 'center', justifyContent: 'center' },
  brandText: { flex: 1, color: '#0B1F3A', fontSize: 23, fontWeight: '900' },
  notificationButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8DEE8' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0B1F3A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  greeting: { color: '#0B1F3A', fontSize: 18, fontWeight: '500', lineHeight: 26 },
  greetingName: { fontWeight: '900' },
  headerSubtitle: { color: '#667085', fontSize: 15, lineHeight: 22, marginTop: 6 },
  accidentHero: { minHeight: 132, marginBottom: 16, borderRadius: 24, padding: 16, overflow: 'hidden', backgroundColor: '#EF2F2A', shadowColor: '#B42318', shadowOpacity: 0.24, shadowRadius: 18, elevation: 5 },
  heroRings: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -76, top: -52, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  heroLabelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 30, borderRadius: 14, backgroundColor: 'rgba(180,35,24,0.36)', paddingHorizontal: 11, marginBottom: 8 },
  heroMainRow: { flexDirection: 'row', alignItems: 'center', minHeight: 100 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  heroButton: { marginTop: 12, alignSelf: 'flex-start', borderRadius: 15, backgroundColor: '#FFFFFF', paddingHorizontal: 15, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroButtonText: { color: '#B42318', fontSize: 15, fontWeight: '900' },
  heroGraphic: { width: 102, alignItems: 'center', justifyContent: 'center' },
  warningTriangle: { marginTop: -7, width: 43, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#B9D5FF', shadowColor: '#0B63CE', shadowOpacity: 0.1, shadowRadius: 16, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  cardTitle: { color: '#0B1F3A', fontSize: 19, fontWeight: '900' },
  textActionButton: { paddingVertical: 5, flexDirection: 'row', alignItems: 'center' },
  textAction: { color: '#0B63CE', fontSize: 13, fontWeight: '900' },
  claimNo: { color: '#0B1F3A', fontSize: 24, fontWeight: '900', marginBottom: 12 },
  claimMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  vehiclePill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#E8F1FB', borderRadius: 16, paddingHorizontal: 12, minHeight: 42 },
  vehicleText: { color: '#0B1F3A', fontSize: 14, fontWeight: '900' },
  claimFacts: { flexDirection: 'row', gap: 9, marginBottom: 12 },
  claimFact: { flex: 1, minWidth: 0 },
  claimFactLabel: { color: '#667085', fontSize: 12, marginBottom: 5 },
  claimFactValue: { color: '#0B1F3A', fontSize: 13, fontWeight: '900', lineHeight: 18 },
  stageBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E8F1FB', borderRadius: 12, borderWidth: 1, borderColor: '#9CC5FF', paddingHorizontal: 9, minHeight: 32 },
  stageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0B63CE' },
  stageBadgeText: { color: '#0B63CE', fontSize: 12, fontWeight: '900' },
  lastUpdated: { color: '#667085', fontSize: 13, marginBottom: 14 },
  progressGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, borderTopWidth: 1, borderTopColor: '#EEF2F6', paddingTop: 14 },
  progressItem: { flex: 1, alignItems: 'center' },
  progressDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#C7D7EA', alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  progressCompleted: { backgroundColor: '#18A058', borderColor: '#18A058' },
  progressCurrent: { backgroundColor: '#0B63CE', borderColor: '#0B63CE', shadowColor: '#0B63CE', shadowOpacity: 0.28, shadowRadius: 5, elevation: 3 },
  progressNumber: { color: '#98A2B3', fontSize: 13, fontWeight: '900' },
  progressNumberCurrent: { color: '#FFFFFF' },
  progressText: { color: '#667085', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  progressTextActive: { color: '#0B1F3A' },
  emptyState: { flexDirection: 'row', gap: 13, backgroundColor: '#F8FAFC', borderRadius: 20, padding: 14 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#0B1F3A', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  emptyText: { color: '#667085', fontSize: 14, lineHeight: 20 },
  statusCard: { borderRadius: 24, padding: 15, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1 },
  actionCard: { backgroundColor: '#FFF4E5', borderColor: '#FEDF89' },
  successCard: { backgroundColor: '#EAF8F0', borderColor: '#B7E4C7' },
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
  sectionTitle: { color: '#0B1F3A', fontSize: 19, fontWeight: '900', marginBottom: 11 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  quickCardSlot: { width: '48.3%' },
  quickCard: { width: '100%', minHeight: 84, backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: '#D8DEE8', shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2, flexDirection: 'row', alignItems: 'center', gap: 9 },
  quickIconTile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: '#0B1F3A', fontSize: 14, fontWeight: '900', lineHeight: 18 },
  quickSubtitle: { color: '#667085', fontSize: 11, lineHeight: 15, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 9, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 12, borderWidth: 1, borderColor: '#D8DEE8', minHeight: 116 },
  summaryIcon: { width: 34, height: 34, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryValue: { color: '#0B1F3A', fontSize: 28, fontWeight: '900' },
  summaryLabel: { color: '#667085', fontSize: 12, fontWeight: '800', marginTop: 3 },
  primarySmallButton: { alignSelf: 'flex-start', minHeight: 42, borderRadius: 14, paddingHorizontal: 16, backgroundColor: '#18A058', alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  primarySmallButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  supportCard: { borderRadius: 24, padding: 16, marginBottom: 16, backgroundColor: '#E8F1FB', borderWidth: 1, borderColor: '#B9D5FF', shadowColor: '#0B63CE', shadowOpacity: 0.1, shadowRadius: 14, elevation: 2, overflow: 'hidden' },
  supportGlow: { position: 'absolute', right: -40, top: -42, width: 145, height: 145, borderRadius: 73, backgroundColor: 'rgba(24,160,88,0.22)' },
  supportCopy: { marginBottom: 12 },
  supportTitle: { color: '#0B1F3A', fontSize: 20, fontWeight: '900' },
  supportText: { color: '#475467', fontSize: 14, lineHeight: 20, marginTop: 4 },
  supportActions: { flexDirection: 'row', gap: 8 },
  supportButton: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: '#D8DEE8' },
  supportButtonDisabled: { backgroundColor: '#FFFFFF', opacity: 0.58 },
  supportButtonText: { color: '#0B1F3A', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  supportButtonTextDisabled: { color: '#667085' },
  bottomNav: { backgroundColor: '#FFFFFF', borderRadius: 25, padding: 10, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D8DEE8', shadowColor: '#0B1F3A', shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  bottomItem: { flex: 1, alignItems: 'center', gap: 3 },
  bottomText: { color: '#667085', fontSize: 10, fontWeight: '800' },
  bottomTextActive: { color: '#0B1F3A' },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.72 },
});
