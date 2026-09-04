import fs from 'node:fs';

const file = 'apps/mobile-app/app/customer/self-managed-claim.tsx';
let text = fs.readFileSync(file, 'utf8');

function replaceOnce(oldValue, newValue, label) {
  const count = text.split(oldValue).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  text = text.replace(oldValue, newValue);
}

replaceOnce(
  "import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';\n",
  "import { ExternalClaimErrorPopup } from '@/components/external-claim-error-popup';\nimport { IncidentVoiceNote, type IncidentVoiceNoteFile } from '@/components/incident-voice-note';\n",
  'voice import',
);

replaceOnce(
  "const BULK_DOCUMENT_TYPE = 'Spot Intimation Attachment';\n",
  "const BULK_DOCUMENT_TYPE = 'Spot Intimation Attachment';\nconst VOICE_NOTE_DOCUMENT_TYPE = 'Incident Voice Note';\n",
  'voice document type',
);

replaceOnce(
  "  const [videoProcessingStatus, setVideoProcessingStatus] = useState('');\n",
  "  const [videoProcessingStatus, setVideoProcessingStatus] = useState('');\n  const [voiceNote, setVoiceNote] = useState<IncidentVoiceNoteFile | null>(null);\n  const [voiceRecording, setVoiceRecording] = useState(false);\n",
  'voice state',
);

replaceOnce(
  "    if (!policy || !vehicle || saving || uploadingDocuments) return;\n",
  "    if (!policy || !vehicle || saving || uploadingDocuments || voiceRecording) return;\n",
  'submit guard',
);

replaceOnce(
  "      ...documents.bulk.map((file) => ({ type: BULK_DOCUMENT_TYPE, file })),\n",
  "      ...documents.bulk.map((file) => ({ type: BULK_DOCUMENT_TYPE, file })),\n      ...(voiceNote ? [{ type: VOICE_NOTE_DOCUMENT_TYPE, file: voiceNote }] : []),\n",
  'queued voice note',
);

replaceOnce(
`      const extension = pickedFile.name.includes('.') ? pickedFile.name.split('.').pop() : 'bin';
      const storagePath = \`${'${customerId}/${targetClaimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}'}\`;
      let uploadUri = pickedFile.uri;
      if (isAccidentVideo) {
        setVideoProcessingStatus(pickedFile.size && pickedFile.size > 10 * 1024 * 1024 ? 'Preparing video for compression…' : 'Preparing video…');
        const prepared = await prepareVideoForUpload(pickedFile.uri, pickedFile.size, (progress) => {
          setVideoProcessingStatus(\`Compressing video… ${'${Math.round(progress * 100)}'}%\`);
        });
        uploadUri = prepared.uri;
        setVideoProcessingStatus(prepared.compressed ? 'Uploading compressed video…' : 'Uploading video…');
      }
      const response = await fetch(uploadUri);
`,
`      let uploadUri = pickedFile.uri;
      let uploadName = pickedFile.name;
      let uploadMimeType = pickedFile.mimeType ?? 'application/octet-stream';
      if (isAccidentVideo) {
        setVideoProcessingStatus(pickedFile.size && pickedFile.size > 10 * 1024 * 1024 ? 'Preparing video for compression…' : 'Preparing video…');
        const prepared = await prepareVideoForUpload(pickedFile.uri, pickedFile.size, (progress) => {
          setVideoProcessingStatus(\`Compressing video… ${'${Math.round(progress * 100)}'}%\`);
        });
        uploadUri = prepared.uri;
        if (prepared.compressed) {
          const stem = pickedFile.name.replace(/\\.[^.]+$/, '') || 'accident-video';
          uploadName = \`${'${stem}'}.mp4\`;
          uploadMimeType = 'video/mp4';
        }
        setVideoProcessingStatus(prepared.compressed ? 'Uploading compressed video…' : 'Uploading video…');
      }
      const extension = uploadName.includes('.') ? uploadName.split('.').pop() : 'bin';
      const storagePath = \`${'${customerId}/${targetClaimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}'}\`;
      const response = await fetch(uploadUri);
`,
  'video upload hardening',
);

replaceOnce("        contentType: pickedFile.mimeType ?? 'application/octet-stream',\n", "        contentType: uploadMimeType,\n", 'upload mime');
replaceOnce("        file_name: pickedFile.name,\n", "        file_name: uploadName,\n", 'upload name');
replaceOnce("        mime_type: pickedFile.mimeType ?? null,\n", "        mime_type: uploadMimeType,\n", 'record mime');

replaceOnce(
`      <View style={styles.voicePlaceholder}>
        <View style={styles.voiceHeadingRow}>
          <View style={styles.voiceIcon}><MaterialCommunityIcons name="microphone-outline" size={25} color="#0A43A3" /></View>
          <View style={styles.voiceCopy}>
            <Text style={styles.voiceTitle}>Incident Voice Note</Text>
            <Text style={styles.voiceText}>Describe what happened in your own words so the incident is easier to understand later.</Text>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Record Voice Note, feature coming soon" accessibilityState={{ disabled: true }} disabled style={styles.voiceButton}>
          <MaterialCommunityIcons name="microphone" size={18} color="#FFFFFF" />
          <Text style={styles.voiceButtonText}>Record Voice Note</Text>
        </Pressable>
        <View style={styles.voiceComingSoon}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#60738B" />
          <Text style={styles.voiceComingSoonText}>This feature will be added soon.</Text>
        </View>
      </View>
`,
`      <IncidentVoiceNote
        value={voiceNote}
        saved={savedDocuments.some((item) => item.document_type === VOICE_NOTE_DOCUMENT_TYPE)}
        busy={saving || uploadingDocuments}
        onChange={setVoiceNote}
        onRecordingChange={setVoiceRecording}
        onRemoveSaved={async () => {
          const removed = await removeSavedDocuments(VOICE_NOTE_DOCUMENT_TYPE);
          if (!removed) return;
          setSavedDocuments((current) => current.filter((item) => item.document_type !== VOICE_NOTE_DOCUMENT_TYPE));
          setSavedDocumentTypes((current) => current.filter((item) => item !== VOICE_NOTE_DOCUMENT_TYPE));
          setSuccessMessage('Voice note deleted successfully');
        }}
      />
`,
  'voice UI',
);

replaceOnce(
  "        primaryDisabled={saving || uploadingDocuments || !policy}\n",
  "        primaryDisabled={saving || uploadingDocuments || voiceRecording || !policy}\n",
  'action disabled',
);
replaceOnce(
  "        primaryLabel={saving || uploadingDocuments ? 'Saving...' : editing ? 'Save & Continue' : 'Start Claim & Continue'}\n",
  "        primaryLabel={voiceRecording ? 'Stop recording first' : saving || uploadingDocuments ? 'Saving...' : editing ? 'Save & Continue' : 'Start Claim & Continue'}\n",
  'action label',
);

fs.writeFileSync(file, text);
