import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import {
  listPartnerPolicyIntakes,
  submitPartnerPolicyIntake,
  type PartnerPolicyIntakeSource,
} from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function NewPolicyIntakeScreen() {
  const router = useRouter();
  const [sources, setSources] = useState<PartnerPolicyIntakeSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [mobile, setMobile] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await listPartnerPolicyIntakes();
        if (cancelled) return;
        setSources(result.sources);
        if (result.sources.length === 1) setSourceId(result.sources[0].id);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Lead sources could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSource = useMemo(() => sources.find((source) => source.id === sourceId) ?? null, [sourceId, sources]);
  const validMobile = /^[6-9][0-9]{9}$/.test(mobile.replace(/\D/g, '').slice(-10));
  const canSubmit = Boolean(file && sourceId && validMobile && !submitting);

  async function pickFile() {
    setError('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('Policy copy must be 15 MB or smaller.');
      return;
    }
    setFile(asset);
  }

  async function submit() {
    if (!file || !canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await submitPartnerPolicyIntake({
        leadSourceId: sourceId,
        customerMobile: mobile,
        file,
      });
      router.replace({ pathname: '/policy-intakes/[id]', params: { id: result.id, submitted: '1' } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intake could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="NEW POLICY INTAKE"
      title="Send policy to Operations"
      action={
        <Pressable onPress={() => router.back()} style={styles.close}>
          <Ionicons name="close" size={18} color={partnerTheme.colors.ink} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>
      ) : (
        <>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="document-text-outline" size={22} color="#FFFFFF" /></View>
            <View style={styles.heroBody}>
              <Text style={styles.heroTitle}>Three details only</Text>
              <Text style={styles.heroText}>Choose the authorized lead source, enter the customer mobile number, and attach the policy copy. Operations completes the rest.</Text>
            </View>
          </View>

          {sources.length > 1 ? (
            <View style={styles.section}>
              <Text style={styles.label}>Lead source</Text>
              <View style={styles.sourceList}>
                {sources.map((source) => {
                  const active = source.id === sourceId;
                  return (
                    <Pressable key={source.id} onPress={() => setSourceId(source.id)} style={[styles.source, active && styles.sourceActive]}>
                      <View style={styles.sourceBody}>
                        <Text style={[styles.sourceName, active && styles.sourceNameActive]}>{source.display_name}</Text>
                        <Text style={[styles.sourceMeta, active && styles.sourceMetaActive]}>{source.intermediary_type.toUpperCase()}{source.intermediary_code ? ` · ${source.intermediary_code}` : ''}</Text>
                      </View>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? partnerTheme.colors.brandStrong : '#A0A8B6'} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.fixedSource}>
              <Text style={styles.label}>Lead source</Text>
              <Text style={styles.fixedSourceName}>{selectedSource?.display_name || 'Authorized account'}</Text>
              <Text style={styles.fixedSourceMeta}>{selectedSource ? `${selectedSource.intermediary_type.toUpperCase()}${selectedSource.intermediary_code ? ` · ${selectedSource.intermediary_code}` : ''}` : ''}</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Customer mobile</Text>
            <TextInput
              value={mobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="10 digit mobile number"
              placeholderTextColor="#9AA3B2"
              maxLength={10}
              style={styles.input}
            />
            {mobile.length > 0 && !validMobile ? <Text style={styles.hintError}>Enter a valid Indian mobile number.</Text> : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Policy copy</Text>
            <Pressable onPress={pickFile} style={[styles.upload, file && styles.uploadSelected]}>
              <View style={styles.uploadIcon}><Ionicons name={file ? 'checkmark-circle-outline' : 'cloud-upload-outline'} size={24} color={file ? partnerTheme.colors.success : partnerTheme.colors.brand} /></View>
              <View style={styles.uploadBody}>
                <Text style={styles.uploadTitle}>{file ? file.name : 'Choose policy PDF or image'}</Text>
                <Text style={styles.uploadMeta}>{file ? formatBytes(file.size || 0) : 'PDF, JPG, PNG or WebP · up to 15 MB'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={!canSubmit} onPress={submit} style={[styles.submit, !canSubmit && styles.submitDisabled]}>
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send-outline" size={17} color="#FFFFFF" />}
            <Text style={styles.submitText}>{submitting ? 'Submitting…' : 'Submit to Operations'}</Text>
          </Pressable>

          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={16} color={partnerTheme.colors.accent} />
            <Text style={styles.noteText}>The uploaded copy goes to the existing controlled Policy Intake queue. It does not book or alter a policy directly.</Text>
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function formatBytes(value: number) {
  if (!value) return 'File selected';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  close: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', gap: 12, borderRadius: partnerTheme.radius.xl, padding: 16, backgroundColor: partnerTheme.colors.nav },
  heroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B4358' },
  heroBody: { flex: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  heroText: { marginTop: 4, color: '#C5CCDA', fontSize: 9.5, lineHeight: 14 },
  section: { marginTop: 18 },
  label: { marginBottom: 7, color: '#657084', fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.75 },
  fixedSource: { marginTop: 18, borderRadius: partnerTheme.radius.lg, padding: 15, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  fixedSourceName: { color: partnerTheme.colors.ink, fontSize: 12, fontWeight: '800' },
  fixedSourceMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9 },
  sourceList: { gap: 8 },
  source: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  sourceActive: { borderColor: partnerTheme.colors.brand, backgroundColor: partnerTheme.colors.brandSoft },
  sourceBody: { flex: 1 },
  sourceName: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '700' },
  sourceNameActive: { color: partnerTheme.colors.brandStrong },
  sourceMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  sourceMetaActive: { color: '#68629A' },
  input: { height: 50, borderRadius: 14, paddingHorizontal: 14, color: partnerTheme.colors.ink, fontSize: 12, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  hintError: { marginTop: 5, color: partnerTheme.colors.danger, fontSize: 8.5 },
  upload: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 13, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderStyle: 'dashed', borderColor: '#C7D0DE' },
  uploadSelected: { borderStyle: 'solid', borderColor: '#B7DBC8', backgroundColor: '#F7FCF9' },
  uploadIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surfaceMuted },
  uploadBody: { flex: 1 },
  uploadTitle: { color: partnerTheme.colors.ink, fontSize: 10.5, fontWeight: '700' },
  uploadMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 8.5 },
  error: { marginTop: 14, color: partnerTheme.colors.danger, fontSize: 9.5, lineHeight: 14 },
  submit: { minHeight: 50, marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: partnerTheme.colors.brandStrong },
  submitDisabled: { opacity: 0.42 },
  submitText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  note: { marginTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, padding: 12, backgroundColor: partnerTheme.colors.accentSoft },
  noteText: { flex: 1, color: '#56716F', fontSize: 8.5, lineHeight: 13 },
});
