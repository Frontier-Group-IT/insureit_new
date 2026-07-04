import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, roleTheme } from '@/lib/theme';
import type { Claim, SupportTicket } from '@/lib/types';

const fallbackPhone = '+916264911014';

const quickHelp = [
  { title: 'Claim Support', body: 'Track claims, status, and settlement help', icon: 'shield-check-outline' as const, category: 'claim' },
  { title: 'Policy Support', body: 'Policy details, changes, and endorsements', icon: 'file-document-edit-outline' as const, category: 'policy' },
  { title: 'Upload Help', body: 'Documents and file upload assistance', icon: 'cloud-upload-outline' as const, category: 'documents' },
  { title: 'Roadside Help', body: '24 × 7 emergency roadside support', icon: 'phone-in-talk-outline' as const, category: 'roadside' },
];

export default function SupportScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const customer = await getCustomerForUser(session.user.id);
    if (!customer) return router.replace('/customer/home');
    const [ticketResult, claimsResult] = await Promise.all([
      supabase.from('support_tickets').select('*').eq('customer_id', customer.id).order('updated_at', { ascending: false }).limit(6),
      supabase.from('claims').select('*').eq('customer_id', customer.id).order('updated_at', { ascending: false }),
    ]);
    if (ticketResult.error) setMessage('Support tickets could not be loaded. Apply the local support-ticket migration before using this section.');
    setTickets(ticketResult.data ?? []);
    setClaims(claimsResult.data ?? []);
    setLoading(false);
  }, [router]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tickets;
    return tickets.filter((ticket) => `${ticket.ticket_no} ${ticket.subject} ${ticket.category}`.toLowerCase().includes(query));
  }, [search, tickets]);

  if (loading) return <Screen title="Support"><LoadingState label="Loading support" /></Screen>;

  return (
    <Screen title="Support" showTitleHeader={false}>
      <View style={styles.pageHeading}>
        <Text style={styles.pageTitle}>Support</Text>
        <Text style={styles.pageSub}>Fast help for every mile.</Text>
      </View>
      {message ? <Message type="error">{message}</Message> : null}

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>InsureIT care desk</Text>
          <Text style={styles.heroTitle}>How can we help you today?</Text>
          <Text style={styles.heroBody}>Search for help, raise a ticket, or connect with the team.</Text>
        </View>
        <MaterialCommunityIcons name="headset" size={55} color="rgba(255,255,255,0.22)" />
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/customer/insurance-quote')} style={styles.quoteCard}>
        <View style={styles.quoteIcon}><MaterialCommunityIcons name="truck-outline" size={25} color="#0B63CE" /></View>
        <View style={styles.quoteCopy}><Text style={styles.quoteEyebrow}>Commercial vehicle insurance</Text><Text style={styles.quoteTitle}>Get quote in 2 minutes</Text><Text style={styles.quoteBody}>Compare policy options for truck, bus, pickup and JCB.</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={23} color={palette.navy} />
      </Pressable>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={20} color={palette.slate} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search tickets or support topics" placeholderTextColor="#8090A6" style={styles.searchInput} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/customer/help-faqs')} style={styles.searchFaqButton}>
          <MaterialCommunityIcons name="help-circle-outline" size={19} color={roleTheme.customer.accent} />
        </Pressable>
      </View>

      <View style={styles.quickGrid}>
        {quickHelp.map((item) => (
          <Pressable key={item.title} accessibilityRole="button" onPress={() => item.category === 'roadside' ? void callPhone(fallbackPhone) : router.push({ pathname: '/customer/raise-support-ticket', params: { category: item.category } })} style={styles.quickTile}>
            <View style={styles.quickIcon}><MaterialCommunityIcons name={item.icon} size={21} color={roleTheme.customer.accent} /></View>
            <Text style={styles.quickTitle}>{item.title}</Text>
            <Text style={styles.quickBody} numberOfLines={2}>{item.body}</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={palette.slate} style={styles.quickChevron} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionTop}>
        <View><Text style={styles.sectionEyebrow}>Your activity</Text><Text style={styles.sectionTitle}>Recent support tickets</Text></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/customer/raise-support-ticket')} style={styles.raiseSmall}><MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" /><Text style={styles.raiseSmallText}>Raise ticket</Text></Pressable>
      </View>

      {filteredTickets.length ? filteredTickets.map((ticket) => (
        <Pressable key={ticket.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/customer/support-ticket-detail', params: { id: ticket.id } })} style={styles.ticketCard}>
          <View style={[styles.ticketIcon, { backgroundColor: ticketTone(ticket.status).soft }]}><MaterialCommunityIcons name={categoryIcon(ticket.category)} size={20} color={ticketTone(ticket.status).accent} /></View>
          <View style={styles.ticketCopy}><View style={styles.ticketTitleRow}><Text style={styles.ticketNo}>{ticket.ticket_no}</Text><View style={[styles.ticketStatus, { backgroundColor: ticketTone(ticket.status).soft }]}><Text style={[styles.ticketStatusText, { color: ticketTone(ticket.status).accent }]}>{statusLabel(ticket.status)}</Text></View></View><Text style={styles.ticketSubject} numberOfLines={1}>{ticket.subject}</Text><Text style={styles.ticketMeta}>{formatDate(ticket.updated_at ?? ticket.created_at)}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={21} color={palette.slate} />
        </Pressable>
      )) : <EmptyState title={search ? 'No matching tickets' : 'No support tickets yet'} body={search ? 'Try a different ticket number or topic.' : 'Raise a ticket whenever you need help with a claim or policy.'} />}

      <View style={styles.contactCard}>
        <View style={styles.contactIcon}><MaterialCommunityIcons name="phone-in-talk-outline" size={21} color={roleTheme.customer.accent} /></View>
        <View style={styles.contactCopy}><Text style={styles.contactTitle}>Need urgent help?</Text><Text style={styles.contactBody}>Our support desk is available for quick assistance.</Text></View>
        <Pressable accessibilityRole="button" onPress={() => void callPhone(fallbackPhone)} style={styles.callButton}><MaterialCommunityIcons name="phone-outline" size={16} color="#FFFFFF" /><Text style={styles.callButtonText}>Call</Text></Pressable>
      </View>
      {claims.length === 0 ? <Text style={styles.claimHint}>Add a claim first to route claim-specific support directly to its manager.</Text> : null}
    </Screen>
  );
}

function categoryIcon(category: SupportTicket['category']): keyof typeof MaterialCommunityIcons.glyphMap { return category === 'policy' ? 'file-document-edit-outline' : category === 'documents' ? 'cloud-upload-outline' : category === 'roadside' ? 'car-wrench' : category === 'other' ? 'message-question-outline' : 'shield-check-outline'; }
function ticketTone(status: SupportTicket['status']) { return status === 'resolved' || status === 'closed' ? { accent: '#12805C', soft: '#E8F8F0' } : status === 'in_progress' ? { accent: '#0B63CE', soft: '#EEF5FF' } : { accent: '#B7791F', soft: '#FFF4E2' }; }
function statusLabel(status: SupportTicket['status']) { return status === 'in_progress' ? 'In progress' : status === 'resolved' ? 'Resolved' : status === 'closed' ? 'Closed' : 'Open'; }
function formatDate(value?: string) { return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'; }
async function callPhone(phone: string) { await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`); }

const styles = StyleSheet.create({
  pageHeading: { marginTop: -22, marginBottom: 10 }, pageTitle: { color: palette.ink, fontSize: 25, fontWeight: '900' }, pageSub: { color: palette.slate, fontSize: 12, fontWeight: '700', marginTop: 2 },
  hero: { minHeight: 142, borderRadius: 20, backgroundColor: palette.navy, padding: 16, marginBottom: 10, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroGlow: { position: 'absolute', width: 180, height: 180, right: -70, bottom: -90, borderRadius: 99, backgroundColor: '#0B63CE' }, heroCopy: { flex: 1, paddingRight: 8 }, heroEyebrow: { color: '#AFCBFF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .5 }, heroTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 25, fontWeight: '900', marginTop: 4 }, heroBody: { color: '#D5E5FC', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  quoteCard: { minHeight: 86, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE0FF', padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, quoteIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E8F2FF', alignItems: 'center', justifyContent: 'center' }, quoteCopy: { flex: 1, minWidth: 0 }, quoteEyebrow: { color: '#0B63CE', fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase' }, quoteTitle: { color: palette.navy, fontSize: 15, fontWeight: '900', marginTop: 2 }, quoteBody: { color: palette.slate, fontSize: 10.5, lineHeight: 14, fontWeight: '700', marginTop: 2 },
  searchBox: { height: 50, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }, searchInput: { flex: 1, color: palette.ink, fontSize: 12.5, fontWeight: '700' }, searchFaqButton: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 14 }, quickTile: { width: '48.7%', minHeight: 123, borderRadius: 17, padding: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4' }, quickIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' }, quickTitle: { color: palette.ink, fontSize: 12, fontWeight: '900', marginTop: 7 }, quickBody: { color: palette.slate, fontSize: 9.8, lineHeight: 13, fontWeight: '700', marginTop: 2, paddingRight: 10 }, quickChevron: { position: 'absolute', right: 8, bottom: 8 },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, sectionEyebrow: { color: palette.slate, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: .4 }, sectionTitle: { color: palette.navy, fontSize: 15.5, fontWeight: '900', marginTop: 2 }, raiseSmall: { minHeight: 33, borderRadius: 10, backgroundColor: roleTheme.customer.accent, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 3 }, raiseSmallText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  ticketCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 11, marginBottom: 8 }, ticketIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, ticketCopy: { flex: 1, minWidth: 0 }, ticketTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, ticketNo: { color: palette.navy, fontSize: 11.5, fontWeight: '900' }, ticketStatus: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }, ticketStatusText: { fontSize: 8.5, fontWeight: '900' }, ticketSubject: { color: palette.ink, fontSize: 11.5, fontWeight: '800', marginTop: 3 }, ticketMeta: { color: palette.slate, fontSize: 9.8, fontWeight: '700', marginTop: 2 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F8FCFF', borderWidth: 1, borderColor: '#CFE0FF', borderRadius: 17, padding: 12, marginTop: 5 }, contactIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#E8F8F0', alignItems: 'center', justifyContent: 'center' }, contactCopy: { flex: 1 }, contactTitle: { color: palette.ink, fontSize: 12.5, fontWeight: '900' }, contactBody: { color: palette.slate, fontSize: 10, lineHeight: 14, fontWeight: '700', marginTop: 2 }, callButton: { minHeight: 33, borderRadius: 10, backgroundColor: roleTheme.customer.accent, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }, callButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' }, claimHint: { color: palette.slate, fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 8, textAlign: 'center' },
});
