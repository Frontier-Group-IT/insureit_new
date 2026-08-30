import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerField } from '@/components/ui/partner-field';
import { PartnerIconButton } from '@/components/ui/partner-icon-button';
import { PartnerStateView } from '@/components/ui/partner-state-view';
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
      action={<PartnerIconButton icon="close" label="Close Policy Intake" onPress={() => router.back()} />}
    >
      {loading ? (
        <PartnerStateView state="loading" title="Preparing Policy Intake" />
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
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={`${source.display_name}, ${source.intermediary_type}`}
                      key={source.id}
                      onPress={() => setSourceId(source.id)}
                      style={({ pressed }) => [styles.source, active && styles.sourceActive, pressed && styles.pressed]}
                    >
                      <View style={styles.sourceBody}>
                        <Text style={[styles.sourceName, active && styles.sourceNameActive]}>{source.display_name}</Text>
                        <Text style={[styles.sourceMeta, active && styles.sourceMetaActive]}>
                          {source.intermediary_type.toUpperCase()}{source.intermediary_code ? ` · ${source.intermediary_code}` : ''}
                        </Text>
                      </View>
                      <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? partnerTheme.colors.brandStrong : '#A0A8B6'} />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.fixedSource}>
              <Text style={styles.label}>Lead source</Text>
              <Text style={styles.fixedSourceName}>{selectedSource?.display_name || 'Authorized account'}</Text>
              <Text style={styles.fixedSourceMeta}>
                {selectedSource ? `${selectedSource.intermediary_type.toUpperCase()}${selectedSource.intermediary_code ? ` · ${selectedSource.intermediary_code}` : ''}` : ''}
              </Text>
            </View>
          )}

          <View style={styles.section}>
            <PartnerField
              label="Customer mobile"
              value={mobile}
              onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="10 digit mobile number"
              maxLength={10}
              error={mobile.length > 0 && !validMobile ? 'Enter a valid Indian mobile number.' : undefined}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Policy copy</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={file ? `Replace selected policy copy ${file.name}` : 'Choose policy PDF or image'}
              onPress={pickFile}
              style={({ pressed }) => [styles.upload, file && styles.uploadSelected, pressed && styles.pressed]}
            >
              <View style={styles.uploadIcon}>
                <Ionicons name={file ? 'checkmark-circle-outline' : 'cloud-upload-outline'} size={24} color={file ? partnerTheme.colors.success : partnerTheme.colors.brand} />
              </View>
              <View style={styles.uploadBody}>
                <Text numberOfLines={2} style={styles.uploadTitle}>{file ? file.name : 'Choose policy PDF or image'}</Text>
                <Text style={styles.uploadMeta}>{file ? formatBytes(file.size || 0) : 'PDF, JPG, PNG or WebP · up to 15 MB'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A0A8B6" />
            </Pressable>
          </View>

          {error ? <View style={styles.feedback}><PartnerBanner tone="danger" message={error} /></View> : null}

          <View style={styles.submit}>
            <PartnerButton
              label={submitting ? 'Submitting…' : 'Submit to Operations'}
              icon="send-outline"
              loading={submitting}
              disabled={!canSubmit}
              onPress={submit}
            />
          </View>

          <View style={styles.note}>
            <PartnerBanner
              tone="info"
              icon="shield-checkmark-outline"
              message="The uploaded copy goes to the existing controlled Policy Intake queue. It does not book or alter a policy directly."
            />
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
  hero: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: partnerTheme.radius.xl,
    padding: partnerTheme.spacing.lg,
    backgroundColor: partnerTheme.colors.nav,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B4358' },
  heroBody: { flex: 1 },
  heroTitle: { color: '#FFFFFF', ...partnerTheme.typography.cardTitle },
  heroText: { marginTop: 4, color: '#C5CCDA', ...partnerTheme.typography.caption },
  section: { marginTop: partnerTheme.spacing.xl },
  label: { marginBottom: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.label },
  fixedSource: {
    marginTop: partnerTheme.spacing.xl,
    borderRadius: partnerTheme.radius.lg,
    padding: partnerTheme.spacing.lg,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  fixedSourceName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  fixedSourceMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  sourceList: { gap: 8 },
  source: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: partnerTheme.radius.md,
    paddingHorizontal: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  sourceActive: { borderColor: partnerTheme.colors.brand, backgroundColor: partnerTheme.colors.brandSoft },
  sourceBody: { flex: 1 },
  sourceName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  sourceNameActive: { color: partnerTheme.colors.brandStrong },
  sourceMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  sourceMetaActive: { color: '#68629A' },
  upload: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: partnerTheme.radius.lg,
    padding: 13,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C7D0DE',
  },
  uploadSelected: { borderStyle: 'solid', borderColor: '#B7DBC8', backgroundColor: '#F7FCF9' },
  uploadIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surfaceMuted },
  uploadBody: { flex: 1 },
  uploadTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  uploadMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  feedback: { marginTop: partnerTheme.spacing.lg },
  submit: { marginTop: partnerTheme.spacing.xl },
  note: { marginTop: partnerTheme.spacing.md },
  pressed: { opacity: 0.82 },
});
