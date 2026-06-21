import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppSectionHeader } from '@/components/design-system';
import { Card, LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';

const fallbackPhone = '+916264911014';

type SupportContact = { name: string; phone: string | null; email: string | null; role: string };
type SupportContacts = {
  agent?: SupportContact | null;
  claim_handler?: SupportContact | null;
  field_executive?: SupportContact | null;
  manager_escalation?: SupportContact | null;
};

const contactDefinitions = [
  {
    title: 'Your Agent',
    role: 'Customer support',
    key: 'agent' as const,
    icon: 'account-tie-voice-outline' as const,
    tone: roleTheme.agent.soft,
    accent: roleTheme.agent.accent,
  },
  {
    title: 'Claim Handler',
    role: 'Claim processing',
    key: 'claim_handler' as const,
    icon: 'clipboard-pulse-outline' as const,
    tone: roleTheme.ops.soft,
    accent: roleTheme.ops.accent,
  },
  {
    title: 'Field Executive',
    role: 'Survey and field work',
    key: 'field_executive' as const,
    icon: 'wrench-outline' as const,
    tone: palette.emeraldSoft,
    accent: palette.emerald,
  },
  {
    title: 'Manager Escalation',
    role: 'Escalations',
    key: 'manager_escalation' as const,
    icon: 'account-supervisor-circle-outline' as const,
    tone: palette.amberSoft,
    accent: palette.amber,
  },
];

export default function SupportScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<SupportContacts>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const { data, error } = await supabase.functions.invoke<{ support_contacts?: SupportContacts }>('profile-context', { method: 'GET' });
      if (!active) return;
      if (error) setMessage('Support contacts could not be loaded. The emergency contact is still available.');
      setContacts(data?.support_contacts ?? {});
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) return <Screen title="Claims Desk"><LoadingState label="Loading support contacts" /></Screen>;

  return (
    <Screen title="Claims Desk" subtitle="Contacts and escalation." showLogout>
      {message ? <Message type="error">{message}</Message> : null}
      <AppSectionHeader title="Contact roles" />
      {contactDefinitions.map((definition) => {
        const contact = contacts[definition.key] ?? null;
        const phone = contact?.phone || fallbackPhone;
        return (
          <Card key={definition.title} style={styles.contactCard}>
            <View style={[styles.contactIcon, { backgroundColor: definition.tone }]}>
              <MaterialCommunityIcons name={definition.icon} size={23} color={definition.accent} />
            </View>
            <View style={styles.contactCopy}>
              <Text style={styles.contactTitle}>{definition.title}</Text>
              <Text style={styles.contactName}>{contact?.name ?? 'InsureIT support desk'}</Text>
              <Text style={styles.contactRole}>{definition.role}</Text>
              <Text style={styles.contactPhone}>{phone}</Text>
            </View>
            <View style={styles.contactActions}>
              <IconButton icon="phone-outline" onPress={() => void callPhone(phone)} />
              <IconButton icon="whatsapp" onPress={() => void openWhatsApp(phone)} />
            </View>
          </Card>
        );
      })}

      <Card style={styles.hoursCard}>
        <AppSectionHeader title="Support hours" />
        <Text style={styles.hoursText}>9:00 AM to 6:00 PM, Monday to Saturday</Text>
        <Pressable accessibilityRole="button" onPress={() => void callPhone(fallbackPhone)} style={styles.mailButton}>
          <MaterialCommunityIcons name="phone-outline" size={17} color={roleTheme.customer.accent} />
          <Text style={styles.mailButtonText}>Call {fallbackPhone}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void openWhatsApp(fallbackPhone)} style={styles.whatsappButton}>
          <MaterialCommunityIcons name="whatsapp" size={17} color="#128C7E" />
          <Text style={styles.whatsappButtonText}>WhatsApp {fallbackPhone}</Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

function IconButton({ icon, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
      <MaterialCommunityIcons name={icon} size={19} color={palette.ink} />
    </Pressable>
  );
}

async function callPhone(phone: string) {
  await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
}

async function openWhatsApp(phone: string) {
  const normalized = phone.replace(/[^\d]/g, '');
  const appUrl = `whatsapp://send?phone=${normalized}`;
  const webUrl = `https://wa.me/${normalized}`;
  const supported = await Linking.canOpenURL(appUrl);
  await Linking.openURL(supported ? appUrl : webUrl);
}

const styles = StyleSheet.create({
  contactCard: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 92 },
  contactIcon: { width: 40, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  contactCopy: { flex: 1, minWidth: 0 },
  contactTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  contactName: { color: palette.ink, fontSize: 14, fontWeight: '900', marginTop: 3 },
  contactRole: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 2 },
  contactPhone: { color: roleTheme.customer.accent, fontSize: 12, fontWeight: '800', marginTop: 3 },
  contactActions: { flexDirection: 'row', gap: 7 },
  iconButton: { width: 36, height: 36, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  hoursCard: { paddingBottom: 16 },
  hoursText: { color: palette.ink, fontSize: 15, fontWeight: '600' },
  mailButton: { alignSelf: 'flex-start', minHeight: 40, borderRadius: radii.sm, borderWidth: 1, borderColor: '#BCE9D2', backgroundColor: roleTheme.customer.soft, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  mailButtonText: { color: roleTheme.customer.accent, fontSize: 13, fontWeight: '700' },
  whatsappButton: { alignSelf: 'flex-start', minHeight: 40, borderRadius: radii.sm, borderWidth: 1, borderColor: '#B7E4D8', backgroundColor: '#E8F8F0', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  whatsappButtonText: { color: '#128C7E', fontSize: 13, fontWeight: '700' },
});
