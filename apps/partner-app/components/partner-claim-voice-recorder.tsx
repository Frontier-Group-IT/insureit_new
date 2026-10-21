import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { uploadSelectedPartnerClaimFile } from '@/lib/claim-uploads';

const MAX_DURATION_MS=120000;
export default function PartnerClaimVoiceRecorder({claimId}:{claimId:string}) {
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState=useAudioRecorderState(recorder,250);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const start=async()=>{
    if(saving||recorderState.isRecording)return;
    const permission=await requestRecordingPermissionsAsync();
    if(!permission.granted){Alert.alert('Microphone permission','Allow microphone access to record an incident voice note.');return;}
    try{
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMessage('Recording… maximum 2 minutes.');
    }catch(e){Alert.alert('Recording unavailable',e instanceof Error?e.message:'Please try again.');}
  };
  const stop=async()=>{
    if(!recorderState.isRecording||saving)return;
    setSaving(true);
    try{
      await recorder.stop();
      const uri=recorder.uri;
      await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
      if(!uri)throw new Error('No recording was captured.');
      const id=await uploadSelectedPartnerClaimFile(claimId,'Incident Voice Note',{
        uri,name:`incident-voice-${Date.now()}.m4a`,mimeType:'audio/mp4',
      });
      if(!id)throw new Error('Voice note could not be saved');
      setMessage('Voice note uploaded securely for claim review.');
    }catch(e){Alert.alert('Voice note not saved',e instanceof Error?e.message:'Please try again.');}
    finally{setSaving(false);}
  };
  useEffect(()=>{
    if(recorderState.isRecording && recorderState.durationMillis>=MAX_DURATION_MS)void stop();
  },[recorderState.isRecording,recorderState.durationMillis]);
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel={recorderState.isRecording?'Stop and save voice note':'Record voice note'} onPress={()=>void (recorderState.isRecording?stop():start())} disabled={saving} style={[styles.button,saving&&styles.disabled]}>
      <Ionicons name={recorderState.isRecording?'stop-circle-outline':'mic-outline'} size={18} color="#FFF"/>
      <Text style={styles.title}>{saving?'Uploading…':recorderState.isRecording?'Stop & Save Voice Note':'Record Voice Note'}</Text>
    </Pressable>
    {message?<Text style={styles.message}>{message}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
 root:{gap:7},button:{minHeight:48,borderRadius:12,backgroundColor:'#164BA2',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
 title:{color:'#FFF',fontSize:12,fontWeight:'800'},message:{fontSize:10,color:'#507095'},disabled:{opacity:.5}
});
