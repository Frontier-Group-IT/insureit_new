import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { AppSectionHeader } from '@/components/design-system';
import { Button, Card, LoadingState, Message, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canManageBusinessRecords } from '@/lib/permissions';
import { supabase } from '@/lib/supabase';

export default function StaffAddInsurerScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [claimsPortalUrl, setClaimsPortalUrl] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const profile = await getProfile(session.user.id);
      if (!isValidProfile(profile) || !canManageBusinessRecords(profile.role)) return router.replace('/access-denied');
      setLoading(false);
    }
    void load();
  }, [router]);

  async function save() {
    setMessage('');
    setSuccess('');
    if (!name.trim()) {
      setMessage('Insurer name is required.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('insurance_companies').insert({
        name: name.trim(),
        branch_name: branchName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        claims_portal_url: claimsPortalUrl.trim() || null,
      });
      if (error) throw error;
      setSuccess('Insurer added.');
      setName('');
      setBranchName('');
      setContactPhone('');
      setContactEmail('');
      setClaimsPortalUrl('');
    } catch (error) {
      console.error('Manager add insurer failed', error);
      setMessage('We could not save this insurer. Please check if it already exists.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Screen title="Add Insurer"><LoadingState label="Opening insurer form" /></Screen>;

  return (
    <Screen title="Add Insurer" subtitle="Create insurer records for policy setup.">
      {message ? <Message type="error">{message}</Message> : null}
      {success ? <Message type="success">{success}</Message> : null}
      <Card>
        <AppSectionHeader title="Insurer" />
        <TextField label="Insurer name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label="Branch name" value={branchName} onChangeText={setBranchName} autoCapitalize="words" />
        <TextField label="Contact phone" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" />
        <TextField label="Contact email" value={contactEmail} onChangeText={setContactEmail} keyboardType="email-address" autoCapitalize="none" />
        <TextField label="Claims portal URL" value={claimsPortalUrl} onChangeText={setClaimsPortalUrl} autoCapitalize="none" />
        <Button label={saving ? 'Saving insurer...' : 'Save insurer'} onPress={save} disabled={saving} />
      </Card>
    </Screen>
  );
}
