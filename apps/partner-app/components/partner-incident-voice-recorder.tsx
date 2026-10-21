import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus,
} from 'expo-audio';
import { uploadPartnerClaimDocument } from '@/lib/claims';

const MAX_RECORDING_MS = 120_000;

export function PartnerIncidentVoiceRecorder({ claimId, onUploaded }: { claimId: string; onUploaded?: () => void }) {
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const status=useAudioRecorderState(recorder,250);
  const [uri,setUri]=useState<string|null>(null);
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState('');
  const stopping=useRef(false);
  const player=useAudioPlayer(uri?{uri}:null);
  const playerStatus=useAudioPlayerStatus(player);

  const stop=useCallback(async()=>{
    if(!status.isRecording||stopping.current)return;
    stopping.current=true;
    try {
      await recorder.stop();
      await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});
      const result=recorder.uri;
      if(!result)throw new Error('The recording was not saved.');
      setUri(result);
      setMessage('Voice note ready to upload to this claim.');
    }catch(e){setMessage(e instanceof Error?e.message:'Unable to stop recording.');}
    finally{stopping.current=false;}
  },[recorder,status.isRecording]);

  useEffect(()=>{
    if(status.isRecording&&status.durationMillis>=MAX_RECORDING_MS)void stop();
  },[status.isRecording,status.durationMillis,stop]);

  const start=async()=>{
    if(uploading||status.isRecording)return;
    setMessage('');
    if(playerStatus.playing)player.pause();
    try {
      const permission=await requestRecordingPermissionsAsync();
      if(!permission.granted){setMessage('Please allow microphone access to record an incident voice note.');return;}
      await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});
      await recorder.prepareToRecordAsync();
      recorder.record();
      setUri(null);
    }catch{setMessage('Recording could not start. Please retry.');}
  };
  const upload=async()=>{
    if(!uri||uploading)return;
    setUploading(true);
    try {
      const response=await fetch(uri);
      if(!response.ok)throw new Error('The recording could not be read.');
      const size=(await response.arrayBuffer()).byteLength;
      if(!size)throw new Error('Recorded voice note is empty.');
      await uploadPartnerClaimDocument(claimId,'voice_note',{
        uri,name:`incident-voice-${Date.now()}.m4a`,mimeType:'audio/mp4',size,
      },'spot_intimation');
      setMessage('Voice note uploaded successfully.');
      setUri(null);
      onUploaded?.();
      Alert.alert('Voice note uploaded','Incident voice note is attached to this claim.');
    } catch(e){Alert.alert('Upload failed',e instanceof Error?e.message:'Please try again.');}
    finally{setUploading(false);}
  };
  const duration=Math.floor(status.durationMillis/1000);
  const time=`${String(Math.floor(duration/60)).padStart(2,'0')}:${String(duration%60).padStart(2,'0')}`;
  return <View style={styles.card}>
    <View style={styles.heading}><View style={styles.icon}><Ionicons name="mic-outline" size={25} color="#0C4DAB"/></View>
      <View style={{flex:1}}><Text style={styles.title}>Incident Voice Note</Text><Text style={styles.subtitle}>Describe what happened. Maximum recording time: 2 minutes.</Text></View></View>
    {status.isRecording ? <>
      <Text style={styles.recording}>● Recording {time}</Text>
      <Pressable onPress={()=>void stop()} accessibilityRole="button" disabled={uploading} style={[styles.button,{backgroundColor:'#C62D38'}]}>
        <Ionicons name="stop-circle-outline" size={20} color="#FFF"/><Text style={styles.buttonText}>Stop Recording</Text>
      </Pressable>
    </> : uri ? <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={()=>{if(playerStatus.playing)player.pause();else player.play();}} style={styles.subButton}>
          <Ionicons name={playerStatus.playing?'pause-circle':'play-circle'} size={19} color="#0B4E9D"/><Text style={styles.subText}>{playerStatus.playing?'Pause':'Play'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>{player.pause();setUri(null);setMessage('');}} style={styles.subButton}>
          <Ionicons name="trash-outline" size={19} color="#B42318"/><Text style={[styles.subText,{color:'#B42318'}]}>Delete</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={()=>void start()} style={styles.subButton}>
          <Ionicons name="mic-outline" size={19} color="#0B4E9D"/><Text style={styles.subText}>Re-record</Text>
        </Pressable>
      </View>
      <Pressable onPress={()=>void upload()} disabled={uploading} accessibilityRole="button" style={[styles.button,uploading&&{opacity:.6}]}>
        <Ionicons name="cloud-upload-outline" size={19} color="#FFF"/><Text style={styles.buttonText}>{uploading?'Uploading…':'Upload Voice Note'}</Text>
      </Pressable>
    </> : <Pressable accessibilityRole="button" onPress={()=>void start()} disabled={uploading} style={styles.button}>
      <Ionicons name="mic" color="#FFF" size={19}/><Text style={styles.buttonText}>Record Voice Note</Text>
    </Pressable>}
    {message?<Text style={styles.message}>{message}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({
  card:{borderRadius:18,backgroundColor:'#F3F7FF',borderWidth:1,borderColor:'#CADBEF',padding:14,gap:12},
  heading:{flexDirection:'row',gap:11,alignItems:'center'},
  icon:{width:48,height:48,borderRadius:12,backgroundColor:'#E6EFFD',justifyContent:'center',alignItems:'center'},
  title:{fontSize:13,fontWeight:'900',color:'#183050'},
  subtitle:{fontSize:10,color:'#78889D',marginTop:3},
  button:{minHeight:49,backgroundColor:'#0B4FA7',borderRadius:13,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},
  buttonText:{fontSize:12,fontWeight:'900',color:'#FFF'},
  recording:{fontSize:12,fontWeight:'800',color:'#BC2737',textAlign:'center'},
  row:{flexDirection:'row',gap:10},
  subButton:{flex:1,minHeight:42,borderRadius:10,backgroundColor:'#FFF',borderColor:'#C7D8EA',borderWidth:1,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},
  subText:{fontSize:11,fontWeight:'800',color:'#0B4E9D'},
  message:{fontSize:10,color:'#687B96',textAlign:'center'},
});
