import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, useAudioPlayer } from 'expo-audio';
import { attachPartnerClaimDocument } from '@/lib/claims';
import { supabase } from '@/lib/supabase';

const LIMIT=120000;

export function PartnerIncidentVoiceRecorder({claimId,customerId}:{claimId:string;customerId:string}) {
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state=useAudioRecorderState(recorder,250);
  const [uri,setUri]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const stopping=useRef(false);
  const player=useAudioPlayer(uri?{uri}:null);

  async function stop() {
    if(stopping.current||!state.isRecording)return;
    stopping.current=true;
    try {
      await recorder.stop();
      await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
      setUri(recorder.uri||null);
      if(!recorder.uri)Alert.alert('Recording unavailable','Please try recording again.');
    }catch(e){Alert.alert('Unable to stop recording',e instanceof Error?e.message:'Please try again.');}
    finally{stopping.current=false;}
  }
  useEffect(()=>{
    if(state.isRecording&&state.durationMillis>=LIMIT&&!stopping.current)void stop();
    // Recorder state changes drive the hard two-minute cap.
  },[state.isRecording,state.durationMillis]);
  async function start(){
    if(busy||state.isRecording)return;
    const granted=await requestRecordingPermissionsAsync();
    if(!granted.granted){Alert.alert('Microphone permission needed','Allow microphone access to record your incident voice note.');return;}
    try {
      setUri(null);
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      await recorder.prepareToRecordAsync();
      recorder.record();
    }catch(e){Alert.alert('Unable to record',e instanceof Error?e.message:'Please try again.');}
  }
  async function upload(){
    if(!uri||busy||state.isRecording)return;
    setBusy(true);
    let storagePath:string|null=null;
    try {
      const result=await fetch(uri);
      if(!result.ok)throw new Error('Recorded audio could not be read.');
      const bytes=await result.arrayBuffer();
      if(!bytes.byteLength||bytes.byteLength>50*1024*1024)throw new Error('Voice recording exceeds the upload limit.');
      storagePath=`${customerId}/${claimId}/incident-voice-${Date.now()}.m4a`;
      const uploaded=await supabase.storage.from('claim-documents').upload(storagePath,bytes,{contentType:'audio/mp4',upsert:false});
      if(uploaded.error)throw uploaded.error;
      await attachPartnerClaimDocument({claimId,documentType:'Incident Voice Note',fileName:'Incident Voice Note.m4a',storagePath,mimeType:'audio/mp4',fileSize:bytes.byteLength,milestoneKey:'spot_intimation'});
      setUri(null);
      Alert.alert('Uploaded','Incident voice note uploaded successfully.');
    }catch(e){
      if(storagePath)await supabase.storage.from('claim-documents').remove([storagePath]);
      Alert.alert('Unable to upload',e instanceof Error?e.message:'Please try again.');
    }finally{setBusy(false);}
  }
  const seconds=Math.floor(state.durationMillis/1000);
  const elapsed=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  return <View style={styles.container}>
    {state.isRecording ? <>
      <View style={styles.status}><View style={styles.dot}/><Text style={styles.statusText}>Recording {elapsed}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop Recording" style={styles.stop} onPress={()=>void stop()}><Ionicons name="stop" size={18} color="#FFF"/><Text style={styles.actionText}>Stop Recording</Text></Pressable>
    </> : uri ? <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel="Play recording" onPress={()=>player.play()} style={styles.secondary}><Ionicons name="play" size={16} color="#0A43A3"/><Text style={styles.secondaryText}>Play</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Re-record" onPress={()=>void start()} style={styles.secondary}><Ionicons name="mic" size={16} color="#0A43A3"/><Text style={styles.secondaryText}>Re-record</Text></Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Upload recorded voice note" disabled={busy} style={styles.record} onPress={()=>void upload()}><Ionicons name="cloud-upload" size={18} color="#FFF"/><Text style={styles.actionText}>{busy?'Uploading…':'Upload Voice Note'}</Text></Pressable>
    </> : <Pressable accessibilityRole="button" accessibilityLabel="Record Voice Note" disabled={busy} style={styles.record} onPress={()=>void start()}><Ionicons name="mic" size={19} color="#FFF"/><Text style={styles.actionText}>Record Voice Note</Text></Pressable>}
  </View>;
}
const styles=StyleSheet.create({
  container:{gap:9},record:{minHeight:52,borderRadius:13,backgroundColor:'#145BC3',flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center'},
  stop:{minHeight:52,borderRadius:13,backgroundColor:'#C92B2B',flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center'},
  status:{minHeight:38,borderRadius:12,borderColor:'#F5C7C2',borderWidth:1,backgroundColor:'#FFF4F3',flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},
  dot:{width:9,height:9,borderRadius:5,backgroundColor:'#D12525'},statusText:{color:'#BA2929',fontSize:11,fontWeight:'800'},
  actionText:{color:'#FFF',fontSize:12,fontWeight:'900'},row:{flexDirection:'row',gap:8},
  secondary:{flex:1,minHeight:42,borderWidth:1,borderColor:'#C2D5EF',borderRadius:10,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6},
  secondaryText:{color:'#0A43A3',fontSize:11,fontWeight:'800'},
});
