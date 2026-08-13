import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LoadingState, Message, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';

type ClaimRow = {
  id: string;
  claim_no: string;
  claim_service_mode: string | null;
  assistance_status: string | null;
  external_policy_id: string | null;
};

export default function RequestClaimAssistanceScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Claim reference is missing.');
      setLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from('claims')
        .select('id,claim_no,claim_service_mode,assistance_status,external_policy_id')
        .eq('id', id)
        .maybeSingle();
      if (!active) return;
      if (loadError || !data) setError('We could not load this claim.');
      else setClaim(data as ClaimRow);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  async function submit() {
    if (!claim || submitting) return;
    setSubmitting(true);
    setError('');
    const { error: rpcError } = await supabase.rpc('request_claim_assistance', {
      p_claim_id: claim.id,
      p_note: note.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message || 'We could not send your assistance request.');
      return;
    }
    router.replace({ pathname: '/customer/self-managed-claim-detail', params: { id: claim.id, assistance: 'requested' } });
  }

  if (loading) return <Screen title="Request Assistance" showTitleHeader={false}><LoadingState label="Opening assistance request" /></Screen>;
  if (error && !claim) return <Screen title="Request Assistance" showTitleHeader={false}><Message type="error">{error}</Message></Screen>;
  if (!claim) return null;

  const alreadyRequested = claim.assistance_status === 'requested';
  const alreadyAccepted = claim.assistance_status === 'accepted' || claim.claim_service_mode === 'broker_managed';

  return (
    <Screen title="Request Assistance" showTitleHeader={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>EXTERNAL CLAIM • {claim.claim_no}</Text><Text style={styles.title}>Request Sankalp Assistance</Text></View>
      </View>

      {error ? <Message type="error">{error}</Message> : null}

      <View style={styles.info}>
        <MaterialCommunityIcons name="account-tie-voice-outline" size={26} color="#0A43A3" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Ask our Claims Desk to review your case</Text>
          <Text style={styles.infoText}>Sending this request does not transfer claim handling immediately. Your claim remains self-tracked until Sankalp reviews and accepts the request.</Text>
        </View>
      </View>

      {alreadyRequested ? (
        <View style={styles.pending}><MaterialCommunityIcons name="clock-outline" size={21} color="#9A6700" /><View style={{ flex: 1 }}><Text style={styles.pendingTitle}>Assistance already requested</Text><Text style={styles.pendingText}>Your request is waiting for Claims Desk review.</Text></View></View>
      ) : alreadyAccepted ? (
        <View style={styles.accepted}><MaterialCommunityIcons name="check-decagram" size={21} color="#0A6B4B" /><View style={{ flex: 1 }}><Text style={styles.acceptedTitle}>Sankalp assistance accepted</Text><Text style={styles.acceptedText}>This claim has moved into Sankalp-managed handling.</Text></View></View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>Tell us what help you need <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput value={note} onChangeText={setNote} multiline maxLength={800} placeholder="For example: surveyor follow-up, work approval delay, settlement guidance..." placeholderTextColor="#98A2B3" style={styles.input} textAlignVertical="top" />
            <Text style={styles.counter}>{note.length}/800</Text>
          </View>
          <Pressable onPress={submit} disabled={submitting} style={[styles.submit, submitting && styles.submitDisabled]}>
            <Text style={styles.submitText}>{submitting ? 'Sending request...' : 'Send Assistance Request'}</Text><MaterialCommunityIcons name="send-check-outline" size={18} color="#FFF" />
          </Pressable>
          <Text style={styles.footnote}>After you submit, you can continue viewing the claim. Sankalp becomes responsible only if the Claims Desk accepts the request.</Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header:{flexDirection:'row',gap:10,alignItems:'center',marginTop:-12,marginBottom:15},back:{width:42,height:42,borderRadius:14,borderWidth:1,borderColor:'#DCE8F4',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},eyebrow:{color:'#0A43A3',fontSize:9.5,fontWeight:'900',letterSpacing:.7},title:{color:palette.navy,fontSize:20,fontWeight:'900',marginTop:2},
  info:{flexDirection:'row',gap:11,padding:14,borderRadius:18,backgroundColor:'#F4F8FF',borderWidth:1,borderColor:'#D4E4FA',marginBottom:14},infoTitle:{color:palette.navy,fontSize:13,fontWeight:'900'},infoText:{color:'#5E6E82',fontSize:10.5,lineHeight:16,fontWeight:'600',marginTop:4},
  card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#DDE7F2',borderRadius:18,padding:14},label:{color:palette.navy,fontSize:12,fontWeight:'900'},optional:{color:'#7A8799',fontWeight:'700'},input:{minHeight:130,marginTop:10,borderWidth:1,borderColor:'#D4DFEC',borderRadius:14,padding:12,color:'#172B4D',fontSize:12,fontWeight:'600',backgroundColor:'#FBFCFE'},counter:{textAlign:'right',color:'#98A2B3',fontSize:9,fontWeight:'700',marginTop:5},
  submit:{minHeight:48,borderRadius:14,backgroundColor:'#0A43A3',flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',marginTop:14},submitDisabled:{opacity:.6},submitText:{color:'#FFF',fontSize:12,fontWeight:'900'},footnote:{color:'#7A8799',fontSize:9.5,lineHeight:14,fontWeight:'600',textAlign:'center',paddingHorizontal:12,marginTop:9},
  pending:{flexDirection:'row',gap:10,padding:14,borderRadius:17,backgroundColor:'#FFF7DF',borderWidth:1,borderColor:'#E9D28D'},pendingTitle:{color:'#805700',fontSize:12,fontWeight:'900'},pendingText:{color:'#866A2A',fontSize:10,lineHeight:15,fontWeight:'600',marginTop:2},accepted:{flexDirection:'row',gap:10,padding:14,borderRadius:17,backgroundColor:'#EAF8F1',borderWidth:1,borderColor:'#B9E3CF'},acceptedTitle:{color:'#0A6B4B',fontSize:12,fontWeight:'900'},acceptedText:{color:'#39745E',fontSize:10,lineHeight:15,fontWeight:'600',marginTop:2},
});
