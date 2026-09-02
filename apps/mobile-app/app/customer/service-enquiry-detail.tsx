import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ServiceEnquiry = {
  id: string;
  enquiry_no: string;
  service_type: 'insurance_quote' | 'challan_assistance';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  vehicle_no: string | null;
  created_at: string;
  updated_at: string;
};

export default function ServiceEnquiryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<ServiceEnquiry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!id) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from('service_enquiries')
        .select('id,enquiry_no,service_type,subject,description,status,vehicle_no,created_at,updated_at')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      setItem((data ?? null) as ServiceEnquiry | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <Screen title="Request"><LoadingState label="Loading request" /></Screen>;
  if (!item) return <Screen title="Request"><EmptyState title="Request not found" body="This request is unavailable or no longer linked to your account." /></Screen>;

  const quote = item.service_type === 'insurance_quote';
  return (
    <Screen title="Request" showTitleHeader={false}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><MaterialCommunityIcons name="chevron-left" size={22} color={palette.navy} /></Pressable>
        <Text style={styles.heading}>Request details</Text>
        <View style={styles.spacer} />
      </View>

      <View style={styles.hero}>
        <View style={[styles.icon, { backgroundColor: quote ? '#EEF5FF' : '#EAF9F7' }]}>
          <MaterialCommunityIcons name={quote ? 'file-document-edit-outline' : 'ticket-confirmation-outline'} size={24} color={quote ? '#0B63CE' : '#0F9F9A'} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{quote ? 'Insurance Quote' : 'Challan Assistance'}</Text>
          <Text style={styles.reference}>{item.enquiry_no}</Text>
        </View>
        <View style={[styles.status, { backgroundColor: statusTone(item.status).soft }]}><Text style={[styles.statusText, { color: statusTone(item.status).accent }]}>{statusLabel(item.status)}</Text></View>
      </View>

      <View style={styles.card}>
        {item.vehicle_no ? <Info label="Vehicle" value={item.vehicle_no} /> : null}
        <Info label="Requested" value={formatDate(item.created_at)} />
        <Info label="Details" value={item.description} multiline />
      </View>

      <View style={styles.note}>
        <MaterialCommunityIcons name="headset" size={19} color="#0B63CE" />
        <Text style={styles.noteText}>Our support team can see this request and will contact you using your registered details.</Text>
      </View>
    </Screen>
  );
}

function Info({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.label}>{label}</Text><Text style={[styles.value, multiline && styles.multiline]}>{value}</Text></View>;
}
function statusLabel(status: ServiceEnquiry['status']) { return status === 'in_progress' ? 'In progress' : status === 'resolved' ? 'Resolved' : status === 'closed' ? 'Closed' : 'Open'; }
function statusTone(status: ServiceEnquiry['status']) { return status === 'resolved' || status === 'closed' ? { accent: '#12805C', soft: '#E8F8F0' } : status === 'in_progress' ? { accent: '#0B63CE', soft: '#EEF5FF' } : { accent: '#B7791F', soft: '#FFF4E2' }; }
function formatDate(value: string) { return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F3F7FB', alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, textAlign: 'center', color: palette.navy, fontSize: 17, fontWeight: '900' }, spacer: { width: 38 },
  hero: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE8F3', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, heroCopy: { flex: 1 },
  eyebrow: { color: '#66758A', fontSize: 10, fontWeight: '900' }, reference: { color: palette.navy, fontSize: 14, fontWeight: '900', marginTop: 2 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusText: { fontSize: 9, fontWeight: '900' },
  card: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE8F3', paddingHorizontal: 13 },
  infoRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2F6' }, label: { color: '#7A8798', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' }, value: { color: palette.navy, fontSize: 12, fontWeight: '800', marginTop: 4 }, multiline: { lineHeight: 17, fontWeight: '700' },
  note: { marginTop: 10, borderRadius: 16, backgroundColor: '#F2F7FF', borderWidth: 1, borderColor: '#CFE0FF', padding: 11, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, noteText: { flex: 1, color: '#5B6B80', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
