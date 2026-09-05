import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/lib/theme';

export type IncidentVoiceNoteFile = {
  name: string;
  uri: string;
  mimeType: string;
  size?: number | null;
};

type Props = {
  value: IncidentVoiceNoteFile | null;
  saved?: boolean;
  busy?: boolean;
  onChange: (file: IncidentVoiceNoteFile | null) => void;
  onRemoveSaved?: () => Promise<void> | void;
  onRecordingChange?: (recording: boolean) => void;
};

const MAX_RECORDING_MS = 2 * 60 * 1000;

export function IncidentVoiceNote({ value, saved = false, busy = false, onChange, onRemoveSaved, onRecordingChange }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useAudioPlayer(value?.uri ? { uri: value.uri } : null);
  const playerState = useAudioPlayerStatus(player);
  const [message, setMessage] = useState('');
  const stoppingRef = useRef(false);

  const stopRecording = useCallback(async () => {
    if (!recorderState.isRecording) return;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!uri) {
        setMessage('The voice note could not be saved. Please record it again.');
        return;
      }
      onChange({
        name: `incident-voice-${Date.now()}.m4a`,
        uri,
        mimeType: 'audio/mp4',
        size: null,
      });
      setMessage('Voice note ready. It will be uploaded with this claim stage.');
    } catch {
      setMessage('Voice recording could not be stopped safely. Please try again.');
    }
  }, [onChange, recorder, recorderState.isRecording]);

  useEffect(() => {
    onRecordingChange?.(recorderState.isRecording);
  }, [onRecordingChange, recorderState.isRecording]);

  useEffect(() => {
    if (!recorderState.isRecording || recorderState.durationMillis < MAX_RECORDING_MS || stoppingRef.current) return;
    stoppingRef.current = true;
    void stopRecording().finally(() => { stoppingRef.current = false; });
  }, [recorderState.durationMillis, recorderState.isRecording, stopRecording]);

  async function startRecording() {
    if (busy || recorderState.isRecording) return;
    setMessage('');
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setMessage('Microphone permission is needed to record a voice note.');
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      setMessage('Voice recording could not be started. Please try again.');
    }
  }

  async function togglePlayback() {
    if (!value?.uri || busy) return;
    try {
      if (playerState.playing) {
        player.pause();
        return;
      }
      if (playerState.duration > 0 && playerState.currentTime >= playerState.duration - 0.2) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setMessage('The voice note could not be played.');
    }
  }

  async function removeVoiceNote() {
    if (busy || recorderState.isRecording) return;
    try {
      if (playerState.playing) player.pause();
      if (saved && !value && onRemoveSaved) {
        await onRemoveSaved();
      } else {
        onChange(null);
      }
      setMessage('');
    } catch {
      setMessage('The voice note could not be removed. Please try again.');
    }
  }

  const durationSeconds = Math.floor(recorderState.durationMillis / 1000);
  const durationLabel = `${String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:${String(durationSeconds % 60).padStart(2, '0')}`;
  const hasVoiceNote = Boolean(value?.uri || saved);

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.icon}><MaterialCommunityIcons name="microphone-outline" size={25} color="#0A43A3" /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>Incident Voice Note</Text>
          <Text style={styles.text}>Describe what happened in your own words. Maximum recording time is 2 minutes.</Text>
        </View>
      </View>

      {recorderState.isRecording ? (
        <View style={styles.recordingPanel}>
          <View style={styles.recordingStatus}><View style={styles.recordingDot} /><Text style={styles.recordingText}>Recording {durationLabel}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop voice recording" disabled={busy} onPress={() => void stopRecording()} style={styles.stopButton}>
            <MaterialCommunityIcons name="stop" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Stop Recording</Text>
          </Pressable>
        </View>
      ) : hasVoiceNote ? (
        <View style={styles.readyPanel}>
          <View style={styles.readyRow}>
            <MaterialCommunityIcons name="check-circle-outline" size={19} color="#18864B" />
            <Text style={styles.readyText}>{saved && !value ? 'Voice note saved' : 'Voice note ready'}</Text>
          </View>
          <View style={styles.actions}>
            {value?.uri ? (
              <Pressable accessibilityRole="button" accessibilityLabel={playerState.playing ? 'Pause voice note' : 'Play voice note'} disabled={busy} onPress={() => void togglePlayback()} style={styles.secondaryButton}>
                <MaterialCommunityIcons name={playerState.playing ? 'pause' : 'play'} size={17} color="#0A43A3" />
                <Text style={styles.secondaryText}>{playerState.playing ? 'Pause' : 'Play'}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Delete voice note" disabled={busy} onPress={() => void removeVoiceNote()} style={styles.deleteButton}>
              <MaterialCommunityIcons name="trash-can-outline" size={17} color="#B42318" />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
            {!saved ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Record voice note again" disabled={busy} onPress={() => void startRecording()} style={styles.secondaryButton}>
                <MaterialCommunityIcons name="microphone" size={17} color="#0A43A3" />
                <Text style={styles.secondaryText}>Re-record</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Record Voice Note" disabled={busy} onPress={() => void startRecording()} style={[styles.recordButton, busy && styles.disabled]}>
          <MaterialCommunityIcons name="microphone" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Record Voice Note</Text>
        </Pressable>
      )}

      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, borderColor: '#CADAF0', backgroundColor: '#F5F9FF', padding: 13, marginBottom: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#E6F0FF', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  text: { color: '#68778D', fontSize: 9.5, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  recordButton: { width: '100%', minHeight: 48, marginTop: 12, borderRadius: 14, backgroundColor: '#0A43A3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  recordingPanel: { marginTop: 12, gap: 9 },
  recordingStatus: { minHeight: 38, borderRadius: 12, backgroundColor: '#FFF4F3', borderWidth: 1, borderColor: '#F5C7C2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D92D20' },
  recordingText: { color: '#B42318', fontSize: 11, fontWeight: '900' },
  stopButton: { minHeight: 46, borderRadius: 13, backgroundColor: '#C43232', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  readyPanel: { marginTop: 12, gap: 9 },
  readyRow: { minHeight: 36, borderRadius: 11, backgroundColor: '#EFFAF4', borderWidth: 1, borderColor: '#B7E4CC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  readyText: { color: '#166A45', fontSize: 10.5, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  secondaryButton: { flexGrow: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFD4EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  secondaryText: { color: '#0A43A3', fontSize: 10, fontWeight: '900' },
  deleteButton: { flexGrow: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10 },
  deleteText: { color: '#B42318', fontSize: 10, fontWeight: '900' },
  message: { marginTop: 9, color: '#60738B', fontSize: 9.5, lineHeight: 13, fontWeight: '700', textAlign: 'center' },
});
