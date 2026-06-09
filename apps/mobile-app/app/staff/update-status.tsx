import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { claimStatuses, getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Claim, ClaimStatus } from '@/lib/types';

export default function UpdateStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [status, setStatus] = useState<ClaimStatus>('Documents Pending');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data } = await supabase.from('claims').select('*').eq('id', id).maybeSingle();
      setClaim(data);
      if (data) setStatus(data.current_status);
    }
    void load();
  }, [id]);

  async function save() {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user || !claim) return;
    const fromStatus = claim.current_status;
    const { error } = await supabase.from('claims').update({ current_status: status }).eq('id', claim.id);
    if (error) return setMessage('We could not update the claim status. Please try again.');
    await supabase.from('claim_status_history').insert({ claim_id: claim.id, from_status: fromStatus, to_status: status, notes: notes.trim() || null, changed_by: session.user.id });
    router.replace({ pathname: '/staff/claim-detail', params: { id: claim.id } });
  }

  return (
    <Screen title="Update Claim Status" showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        <Row label="Claim" value={claim?.claim_no} />
        <TextField label="New status" value={status} onChangeText={(value: string) => setStatus(value as ClaimStatus)} />
        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
        <Button label="Save status" onPress={save} />
      </Card>
      <Card>
        <Row label="Available statuses" value={claimStatuses.join(', ')} />
      </Card>
    </Screen>
  );
}
