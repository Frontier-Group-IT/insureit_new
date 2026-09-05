import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerActivity, type PartnerActivityData } from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function ActivityScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getPartnerActivity(40));
    } catch {
      setData(null);
      setError('Recent activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PartnerScreen eyebrow="ACTIVITY" title="What changed" onBack={() => router.back()}>
      {loading ? (
        <PartnerStateView state="loading" title="Loading recent activity" />
      ) : error || !data ? (
        <PartnerStateView
          state="error"
          title="Activity is temporarily unavailable"
          message={error || 'Recent activity could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : <>
        {data.attention.length ? <>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Needs attention</Text></View>
          <View style={styles.attentionList}>
            {data.attention.slice(0, 3).map((item) => <Pressable key={`${item.kind}-${item.title}`} onPress={() => router.push(item.route as never)} style={styles.attentionCard}>
              <View style={styles.attentionIcon}><Image source={PartnerAssets.status.opportunityAlert} style={styles.attentionArtwork} resizeMode="contain" /></View>
              <View style={styles.attentionBody}><Text style={styles.attentionTitle}>{item.title}</Text><Text style={styles.attentionText}>{item.subtitle}</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#9AA3B2" />
            </Pressable>)}
          </View>
        </> : null}

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Recent timeline</Text></View>
        {data.items.length ? <View style={styles.timeline}>
          {data.items.map((item, index) => <Pressable key={`${item.kind}-${item.entity_id}-${item.event_at}`} onPress={() => router.push(item.route as never)} style={styles.item}>
            <View style={styles.rail}>
              <View style={styles.eventArtwork}><Image source={activityAsset(item.kind)} style={styles.eventArtworkImage} resizeMode="contain" /></View>
              {index < data.items.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.itemBody}>
              <View style={styles.itemTop}><Text style={[styles.kind, toneText(item.tone)]}>{labelFor(item.kind)}</Text><Text style={styles.date}>{formatDate(item.event_at)}</Text></View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.meta}>{item.meta}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color="#B2B8C2" />
          </Pressable>)}
        </View> : (
          <PartnerStateView
            state="empty"
            asset={PartnerAssets.status.announcement}
            title="No recent activity"
            message="New policy, claim, intake and learning events will appear here when they are recorded."
          />
        )}
      </>}
    </PartnerScreen>
  );
}

function activityAsset(kind: PartnerActivityData['items'][number]['kind']) {
  if (kind === 'policy') return PartnerAssets.status.policyActive;
  if (kind === 'claim') return PartnerAssets.navigation.claims;
  if (kind === 'intake') return PartnerAssets.navigation.policyIntake;
  return PartnerAssets.actions.policyChecklist;
}

function labelFor(kind: PartnerActivityData['items'][number]['kind']) { if (kind === 'policy') return 'POLICY'; if (kind === 'claim') return 'CLAIM'; if (kind === 'intake') return 'OPERATIONS'; return 'LEARN'; }
function toneText(tone: PartnerActivityData['items'][number]['tone']) { if (tone === 'service') return styles.textService; if (tone === 'attention') return styles.textAttention; if (tone === 'learn') return styles.textLearn; if (tone === 'operations') return styles.textOps; return styles.textBusiness; }
function formatDate(value: string) { const d = new Date(value); if (Number.isNaN(d.getTime())) return value; return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d); }

const styles = StyleSheet.create({
  sectionHeader: { marginTop: 14, marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  attentionList: { gap: 8 },
  attentionCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 13, backgroundColor: '#FFF9EE', borderWidth: 1, borderColor: '#F5DFC1' },
  attentionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  attentionArtwork: { width: 38, height: 38 },
  attentionBody: { flex: 1 },
  attentionTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  attentionText: { marginTop: 3, color: '#806B52', ...partnerTheme.typography.caption },
  timeline: { marginTop: 2 },
  item: { minHeight: 88, flexDirection: 'row', gap: 10 },
  rail: { width: 36, alignItems: 'center' },
  eventArtwork: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  eventArtworkImage: { width: 32, height: 32 },
  line: { width: 1, flex: 1, marginTop: 4, backgroundColor: partnerTheme.colors.line },
  itemBody: { flex: 1, paddingBottom: 13 },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  kind: { fontSize: 9.5, lineHeight: 13, fontWeight: '800', letterSpacing: 0.8 },
  textBusiness: { color: partnerTheme.colors.brand },
  textService: { color: partnerTheme.colors.accent },
  textAttention: { color: partnerTheme.colors.warning },
  textLearn: { color: '#A3630D' },
  textOps: { color: '#667085' },
  date: { color: partnerTheme.colors.inkMuted, fontSize: 9.5, lineHeight: 13 },
  title: { marginTop: 5, color: partnerTheme.colors.ink, fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  subtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 10.5, lineHeight: 15 },
  meta: { marginTop: 4, color: '#8A94A6', fontSize: 9.5, lineHeight: 13 },
});
