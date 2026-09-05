import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerField } from '@/components/ui/partner-field';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerAssets } from '@/lib/partner-assets';
import {
  clearPartnerPolicyIntakeDraft,
  loadPartnerPolicyIntakeDraft,
  savePartnerPolicyIntakeDraft,
} from '@/lib/policy-intake-draft';
import {
  listPartnerPolicyIntakes,
  submitPartnerPolicyIntake,
  type PartnerPolicyIntakeSource,
  type PartnerPolicyIntakeUploadProgress,
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
  const [draftRestored, setDraftRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<PartnerPolicyIntakeUploadProgress | null>(null);
  const [error, setError] = useState('');
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [result, draft] = await Promise.all([
          listPartnerPolicyIntakes(),
          loadPartnerPolicyIntakeDraft(),
        ]);
        if (cancelled) return;

        setSources(result.sources);

        const draftSourceValid = Boolean(draft?.leadSourceId && result.sources.some((source) => source.id === draft.leadSourceId));
        const nextSourceId = draftSourceValid
          ? draft!.leadSourceId
          : result.sources.length === 1
            ? result.sources[0].id
            : '';

        setSourceId(nextSourceId);

        if (draft?.customerMobile) {
          setMobile(draft.customerMobile.replace(/\D/g, '').slice(0, 10));
          setDraftRestored(true);
        } else if (draftSourceValid) {
          setDraftRestored(true);
        }
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

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (!sourceId && !mobile) return;
      void savePartnerPolicyIntakeDraft({
        leadSourceId: sourceId,
        customerMobile: mobile,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [loading, mobile, sourceId]);

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

  function requestClose() {
    if (submitting) return;
    if (file) {
      setCloseConfirmVisible(true);
      return;
    }
    router.back();
  }

  async function submit() {
    if (!file || !canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setProgress({ stage: 'preparing' });
    setError('');

    try {
      const result = await submitPartnerPolicyIntake({
        leadSourceId: sourceId,
        customerMobile: mobile,
        file,
        onProgress: setProgress,
      });
      await clearPartnerPolicyIntakeDraft();
      router.replace({ pathname: '/policy-intakes/[id]', params: { id: result.id, submitted: '1' } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intake could not be submitted.');
      setProgress(null);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <PartnerScreen
      eyebrow="NEW POLICY INTAKE"
      title="Send policy to Operations"
      subtitle="Review details, attach the policy copy, then submit"
      onBack={requestClose}
      backDisabled={submitting}
    >
      <PartnerConfirmDialog
        visible={closeConfirmVisible}
        title="Leave Policy Intake?"
        message="Your lead source and mobile number are saved as a draft, but the selected policy file will need to be chosen again."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onCancel={() => setCloseConfirmVisible(false)}
        onConfirm={() => {
          setCloseConfirmVisible(false);
          router.back();
        }}
      />

      {loading ? (
        <PartnerStateView state="loading" title="Preparing Policy Intake" />
      ) : (
        <>
          {draftRestored ? (
            <View style={styles.draftBanner}>
              <PartnerBanner
                tone="info"
                icon="bookmark-outline"
                title="Draft restored"
                message="Lead source and mobile restored. Re-select the policy file before submitting."
              />
            </View>
          ) : null}

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
              disabled={submitting}
              onPress={pickFile}
              style={({ pressed }) => [styles.upload, file && styles.uploadSelected, pressed && !submitting && styles.pressed, submitting && styles.disabled]}
            >
              <View style={styles.uploadArtworkWrap}>
                <Image source={file ? PartnerAssets.status.verified : PartnerAssets.status.documentUpload} style={styles.uploadArtwork} resizeMode="contain" />
              </View>
              <View style={styles.uploadBody}>
                <Text numberOfLines={2} style={styles.uploadTitle}>{file ? file.name : 'Choose policy PDF or image'}</Text>
                <Text style={styles.uploadMeta}>{file ? formatBytes(file.size || 0) : 'PDF, JPG, PNG or WebP · up to 15 MB'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A0A8B6" />
            </Pressable>
          </View>

          {progress ? <UploadProgress progress={progress} /> : null}

          {error ? (
            <View style={styles.feedback}>
              <PartnerBanner tone="danger" title="Submission not completed" message={error} />
              {file ? <Text style={styles.retryHint}>Your selected policy copy and entered details are still here. Tap Submit to retry.</Text> : null}
            </View>
          ) : null}

          {file && selectedSource && validMobile ? (
            <View style={styles.reviewCard}>
              <View style={styles.reviewTop}>
                <View style={styles.reviewArtworkWrap}><Image source={PartnerAssets.status.verified} style={styles.reviewArtwork} resizeMode="contain" /></View>
                <Text style={styles.reviewTitle}>Ready to submit</Text>
              </View>
              <ReviewRow label="Lead source" value={selectedSource.display_name} />
              <ReviewRow label="Customer" value={mobile} />
              <ReviewRow label="Policy copy" value={file.name} last />
            </View>
          ) : null}

          <View style={styles.submit}>
            <PartnerButton
              label={submitting ? progressLabel(progress) : error && file ? 'Retry submission' : 'Submit to Operations'}
              icon="send-outline"
              loading={submitting}
              disabled={!canSubmit}
              onPress={submit}
            />
          </View>
        </>
      )}
    </PartnerScreen>
  );
}

function UploadProgress({ progress }: { progress: PartnerPolicyIntakeUploadProgress }) {
  const percent = progress.stage === 'preparing'
    ? 8
    : progress.stage === 'submitting'
      ? 96
      : Math.max(12, Math.min(92, progress.percent ?? 12));

  return (
    <View
      accessibilityLabel={`${progressLabel(progress)}. ${progressMessage(progress)}`}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent), text: `${Math.round(percent)} percent` }}
      style={styles.progressCard}
    >
      <View style={styles.progressTop}>
        <View>
          <Text style={styles.progressTitle}>{progressLabel(progress)}</Text>
          <Text style={styles.progressText}>{progressMessage(progress)}</Text>
        </View>
        <Text style={styles.progressPercent}>{Math.round(percent)}%</Text>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

function progressLabel(progress: PartnerPolicyIntakeUploadProgress | null) {
  if (!progress) return 'Submitting…';
  if (progress.stage === 'preparing') return 'Preparing secure upload';
  if (progress.stage === 'submitting') return 'Creating Policy Intake';
  return 'Uploading policy copy';
}

function progressMessage(progress: PartnerPolicyIntakeUploadProgress) {
  if (progress.stage === 'preparing') return 'Preparing upload.';
  if (progress.stage === 'submitting') return 'Submitting to Operations.';
  return progress.percent != null ? `${progress.percent}% uploaded` : 'Uploading policy copy.';
}

function ReviewRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.reviewRow, last && styles.reviewRowLast]}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function formatBytes(value: number) {
  if (!value) return 'File selected';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  draftBanner: { marginTop: 2 },
  section: { marginTop: partnerTheme.spacing.lg },
  label: { marginBottom: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.label },
  fixedSource: { marginTop: partnerTheme.spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  fixedSourceName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  fixedSourceMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  sourceList: { gap: 0 },
  source: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  sourceActive: { backgroundColor: partnerTheme.colors.brandSoft },
  sourceBody: { flex: 1 },
  sourceName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  sourceNameActive: { color: partnerTheme.colors.brandStrong },
  sourceMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  sourceMetaActive: { color: '#68629A' },
  upload: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 2, backgroundColor: partnerTheme.colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: partnerTheme.colors.line },
  uploadSelected: { backgroundColor: partnerTheme.colors.successSoft, borderColor: '#CBE7D7' },
  uploadArtworkWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  uploadArtwork: { width: 40, height: 40 },
  uploadBody: { flex: 1 },
  uploadTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  uploadMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  disabled: { opacity: 0.55 },
  progressCard: { marginTop: partnerTheme.spacing.md, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D9D5FF', backgroundColor: partnerTheme.colors.brandSoft },
  progressTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  progressTitle: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.bodyStrong },
  progressText: { marginTop: 3, color: '#68629A', ...partnerTheme.typography.caption },
  progressPercent: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption },
  progressTrack: { height: 7, marginTop: 11, overflow: 'hidden', borderRadius: 999, backgroundColor: '#D8D5F5' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: partnerTheme.colors.brandStrong },
  feedback: { marginTop: partnerTheme.spacing.md },
  reviewCard: { marginTop: partnerTheme.spacing.md, backgroundColor: partnerTheme.colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: partnerTheme.colors.line },
  reviewTop: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  reviewArtworkWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  reviewArtwork: { width: 32, height: 32 },
  reviewTitle: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  reviewRow: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewLabel: { width: 88, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  reviewValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.caption },
  retryHint: { marginTop: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  submit: { marginTop: partnerTheme.spacing.lg, paddingTop: partnerTheme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
});