import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const voicePath = path.join(root, 'apps/mobile-app/components/incident-voice-note.tsx');
const trackerPath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one-tracker.tsx');
const voice = fs.readFileSync(voicePath, 'utf8');
const tracker = fs.readFileSync(trackerPath, 'utf8');

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

requireText(tracker, "const voiceVerified = voiceDocument?.verification_status === 'verified';", 'Voice-note lock must continue to use claim_documents verification_status as the source of truth.');
requireText(tracker, 'saved={voiceVerified}', 'Stage 1 must pass the verified state into IncidentVoiceNote.');
requireText(tracker, 'if (voiceVerified)', 'Verified audio replacement/deletion guards must remain in Stage 1.');

requireText(voice, 'const isLocked = locked || saved;', 'IncidentVoiceNote must derive an explicit locked presentation state.');
requireText(voice, "cardLocked: { backgroundColor: '#EFFAF4', borderColor: '#52B57F' }", 'Verified voice-note card must use the same green verified treatment as document cards.');
requireText(voice, 'name="lock-check-outline"', 'Verified voice-note card must show the lock-check icon.');
requireText(voice, "<Text style={styles.readyText}>Voice note ready</Text>", 'Voice note ready status must remain visible.');
requireText(voice, 'onPress={() => void togglePlayback()}', 'Voice note ready row must control playback.');
requireText(voice, '{!isLocked ? (', 'Verified voice notes must hide destructive/re-record actions.');
requireText(voice, 'if (busy || isLocked || recorderState.isRecording) return;', 'Component-level delete/re-record protection must remain for locked audio.');
forbidText(voice, 'Verified · Locked', 'Verified/locked copy must stay removed from the Incident Voice Note card.');
forbidText(tracker, 'Audio verified by Claims Desk · Locked', 'The separate audio verified footer must stay removed from Stage 1.');
forbidText(tracker, "locked ? 'Verified · Locked'", 'Verified/locked copy must stay removed from Stage 1 document tiles.');
forbidText(voice, "<Text style={styles.secondaryText}>{playerState.playing ? 'Pause' : 'Play'}</Text>", 'Standalone Play/Pause button must not return; playback belongs to Voice note ready.');

console.log('Customer verified voice-note UI regression checks passed.');