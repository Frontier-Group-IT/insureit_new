import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PartnerField } from '@/components/ui/partner-field';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import {
  clearPartnerPolicyIntakeDraft,
  loadPartnerPolicyIntakeDraft,
  savePartnerPolicyIntakeDraft,
} from '@/lib/policy-intake-draft';
import {
  listPartnerPolicyIntakeSources,
  submitPartnerPolicyIntake,
  type PartnerPolicyIntakeSource,
  type PartnerPolicyIntakeUploadProgress,
  type PartnerPolicyType,
} from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';
import { usePartnerNetwork } from '@/providers/partner-network-provider';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
type SourceFilter = 'all' | 'partner' | 'posp';

const POLICY_TYPE_OPTIONS: Array<{ value: PartnerPolicyType; label: string; icon: ComponentProps<typeof Ionicons>['name'] }> = [
  { value: 'motor', label: 'Motor', icon: 'car-sport-outline' },
  { value: 'non_motor', label: 'Non-Motor', icon: 'business-outline' },
  { value: 'life', label: 'Life', icon: 'shield-checkmark-outline' },
  { value: 'health', label: 'Health', icon: 'medkit-outline' },
];

export default function NewPolicyIntakeScreen() {
  const router = useRouter();
  const { isOffline } = usePartnerNetwork();
  const [sources, setSources] = useState<PartnerPolicyIntakeSource[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [policyType, setPolicyType] = useState<PartnerPolicyType>('motor');
  const [policyTypeOpen, setPolicyTypeOpen] = useState(false);
  const [mobile, setMobile] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<PartnerPolicyIntakeUploadProgress | null>(null);
  const [error, setError] = useState('');
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourceStepComplete, setSourceStepComplete] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [result, draft] = await Promise.all([
          listPartnerPolicyIntakeSources(),
          loadPartnerPolicyIntakeDraft(),
        ]);
        if (cancelled) return;

        const nextSources = Array.isArray(result) ? result : [];
        setSources(nextSources);

        const draftSourceValid = Boolean(draft?.leadSourceId && nextSources.some((source) => source.id === draft.leadSourceId));
        const nextSourceId = draftSourceValid
          ? draft!.leadSourceId
          : nextSources.length === 1
            ? nextSources[0].id
            : '';

        setSourceId(nextSourceId);
        if (nextSources.length === 1) setSourceStepComplete(true);
        if (draft?.policyType && POLICY_TYPE_OPTIONS.some((option) => option.value === draft.policyType)) {
          setPolicyType(draft.policyType);
        }

        if (draft?.customerMobile) {
          setMobile(draft.customerMobile.replace(/\D/g, '').slice(0, 10));
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
      if (!sourceId && !mobile && policyType === 'motor') return;
      void savePartnerPolicyIntakeDraft({
        leadSourceId: sourceId,
        policyType,
        customerMobile: mobile,
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [loading, mobile, policyType, sourceId]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      if (sourceStepComplete && sources.length > 1) {
        setSourceStepComplete(false);
        return true;
      }
      requestClose();
      return true;
    });
    return () => subscription.remove();
  }, [file, sourceStepComplete, sources.length, submitting]);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === sourceId) ?? null,
    [sourceId, sources],
  );

  const filteredSources = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return sources.filter((source) => {
      const type = source.intermediary_type.toLowerCase();
      if (sourceFilter === 'partner' && !type.includes('partner')) return false;
      if (sourceFilter === 'posp' && !type.includes('posp')) return false;
      if (!normalizedQuery) return true;
      return [source.display_name, source.intermediary_type, source.intermediary_code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [query, sourceFilter, sources]);

  const validMobile = /^[6-9][0-9]{9}$/.test(mobile.replace(/\D/g, '').slice(-10));
  const proposalForm = policyType === 'life' || policyType === 'health';
  const selectedPolicyType = POLICY_TYPE_OPTIONS.find((option) => option.value === policyType) ?? POLICY_TYPE_OPTIONS[0];
  const canSubmit = Boolean(sourceId && validMobile && (proposalForm || file) && !submitting);

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
      setError(`${proposalForm ? 'Proposal form' : 'Policy copy'} must be 15 MB or smaller.`);
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
    if (!canSubmit || submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    setProgress({ stage: 'preparing' });
    setError('');

    try {
      const result = await submitPartnerPolicyIntake({
        leadSourceId: sourceId,
        policyType,
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

  const confirmDialog = (
    <PartnerConfirmDialog
      visible={closeConfirmVisible}
      title="Leave Policy Intake?"
      message="Your lead source, policy type and mobile number are saved as a draft, but the selected document will need to be chosen again."
      confirmLabel="Leave"
      cancelLabel="Stay"
      onCancel={() => setCloseConfirmVisible(false)}
      onConfirm={() => {
        setCloseConfirmVisible(false);
        router.back();
      }}
    />
  );

  if (!sourceStepComplete && sources.length !== 1) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {confirmDialog}
        <ReferenceHeader />

        <View style={styles.searchFloat}>
          <Ionicons name="search-outline" size={20} color="#60708A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search partner, lead source or POSP..."
            placeholderTextColor="#8793A7"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search partner, lead source or POSP"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#A2ABBA" />
            </Pressable>
          ) : null}
          <View style={styles.searchDivider} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter lead sources"
            hitSlop={8}
            onPress={() => setFilterOpen((value) => !value)}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <Ionicons name="options-outline" size={20} color="#2C5D91" />
          </Pressable>
        </View>

        <View style={styles.sourceWorkspace}>
          {filterOpen ? (
            <View style={styles.filterRow}>
              <FilterChip label="All" active={sourceFilter === 'all'} onPress={() => setSourceFilter('all')} />
              <FilterChip label="Partner" active={sourceFilter === 'partner'} onPress={() => setSourceFilter('partner')} />
              <FilterChip label="POSP" active={sourceFilter === 'posp'} onPress={() => setSourceFilter('posp')} />
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionHeaderIcon}>
                <Ionicons name="business-outline" size={17} color="#1786E8" />
              </View>
              <Text style={styles.sectionTitle}>Lead Source</Text>
            </View>
            <Text style={styles.sectionCount}>Total {sources.length}</Text>
          </View>

          {isOffline ? (
            <View style={styles.offlineWrap}>
              <PartnerBanner
                tone="warning"
                title="You're offline"
                message="Available cached information remains visible. Reconnect before submitting."
              />
            </View>
          ) : null}

          {loading ? (
            <View style={styles.stateWrap}>
              <PartnerStateView state="loading" title="Loading lead sources" />
            </View>
          ) : error && sources.length === 0 ? (
            <View style={styles.stateWrap}>
              <PartnerStateView state="error" title="Lead sources unavailable" message={error} />
            </View>
          ) : (
            <FlatList
              data={filteredSources}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.sourceListContent}
              ListEmptyComponent={(
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchTitle}>No lead source found</Text>
                  <Text style={styles.emptySearchText}>Try another name, ID or source type.</Text>
                </View>
              )}
              renderItem={({ item, index }) => (
                <SourceCard
                  source={item}
                  active={item.id === sourceId}
                  index={index}
                  onPress={() => setSourceId(item.id)}
                />
              )}
            />
          )}
        </View>

        <View style={styles.selectionFooter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel Policy Intake"
            disabled={submitting}
            onPress={requestClose}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.footerPressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with selected lead source"
            accessibilityState={{ disabled: !sourceId }}
            disabled={!sourceId}
            onPress={() => setSourceStepComplete(true)}
            style={({ pressed }) => [styles.continueButton, !sourceId && styles.continueDisabled, pressed && sourceId ? styles.primaryPressed : null]}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {confirmDialog}
      <ReferenceHeader />
      <ScrollView
        contentContainerStyle={styles.detailsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isOffline ? (
          <PartnerBanner
            tone="warning"
            title="You're offline"
            message="Reconnect before submitting this Policy Intake."
          />
        ) : null}


        <View style={styles.detailCard}>
          <View style={styles.detailCardHeader}>
            <Text style={styles.detailCardTitle}>Lead Source</Text>
            {sources.length > 1 ? (
              <Pressable accessibilityRole="button" onPress={() => setSourceStepComplete(false)} hitSlop={8}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.selectedSourceRow}>
            <SourceAvatar source={selectedSource} index={0} />
            <View style={styles.sourceBody}>
              <Text style={styles.sourceName}>{selectedSource?.display_name || 'Authorized account'}</Text>
              <Text style={styles.sourceMeta}>{selectedSource ? sourceMeta(selectedSource) : ''}</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#4F28E9" />
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Policy type</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Policy type, ${selectedPolicyType.label}`}
            accessibilityState={{ expanded: policyTypeOpen }}
            disabled={submitting}
            onPress={() => setPolicyTypeOpen((value) => !value)}
            style={({ pressed }) => [styles.policyTypeSelector, pressed && !submitting && styles.pressed, submitting && styles.disabled]}
          >
            <View style={styles.policyTypeIcon}>
              <Ionicons name={selectedPolicyType.icon} size={21} color="#4F28E9" />
            </View>
            <Text style={styles.policyTypeValue}>{selectedPolicyType.label}</Text>
            <Ionicons name={policyTypeOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#748198" />
          </Pressable>
          {policyTypeOpen ? (
            <View style={styles.policyTypeMenu}>
              {POLICY_TYPE_OPTIONS.map((option) => {
                const active = option.value === policyType;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      if (option.value !== policyType) setFile(null);
                      setPolicyType(option.value);
                      setPolicyTypeOpen(false);
                      setError('');
                    }}
                    style={({ pressed }) => [styles.policyTypeOption, active && styles.policyTypeOptionActive, pressed && styles.pressed]}
                  >
                    <View style={[styles.policyTypeOptionIcon, active && styles.policyTypeOptionIconActive]}>
                      <Ionicons name={option.icon} size={18} color={active ? '#4F28E9' : '#65738A'} />
                    </View>
                    <Text style={[styles.policyTypeOptionText, active && styles.policyTypeOptionTextActive]}>{option.label}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={19} color="#4F28E9" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.formSection}>
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

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>{proposalForm ? 'Proposal form (Optional)' : 'Policy copy'}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={file
              ? `Replace selected ${proposalForm ? 'proposal form' : 'policy copy'} ${file.name}`
              : `Choose ${proposalForm ? 'proposal' : 'policy'} PDF or image`}
            disabled={submitting}
            onPress={pickFile}
            style={({ pressed }) => [styles.upload, file && styles.uploadSelected, pressed && !submitting && styles.pressed, submitting && styles.disabled]}
          >
            <View style={styles.uploadIcon}>
              <Ionicons name={file ? 'checkmark-circle-outline' : 'cloud-upload-outline'} size={24} color={file ? partnerTheme.colors.success : partnerTheme.colors.brand} />
            </View>
            <View style={styles.uploadBody}>
              <Text numberOfLines={2} style={styles.uploadTitle}>
                {file ? file.name : `Choose ${proposalForm ? 'proposal' : 'policy'} PDF or image${proposalForm ? ' (optional)' : ''}`}
              </Text>
              <Text style={styles.uploadMeta}>{file ? formatBytes(file.size || 0) : 'PDF, JPG, PNG or WebP · up to 15 MB'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A0A8B6" />
          </Pressable>
        </View>

        {progress ? <UploadProgress progress={progress} /> : null}

        {error ? (
          <View style={styles.feedback}>
            <PartnerBanner tone="danger" title="Submission not completed" message={error} />
            {file ? <Text style={styles.retryHint}>Your selected document and entered details are still here. Tap Submit to retry.</Text> : null}
          </View>
        ) : null}

        {(file || proposalForm) && selectedSource && validMobile ? (
          <View style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewTitle}>Ready to submit</Text>
              <Ionicons name="checkmark-circle-outline" size={18} color={partnerTheme.colors.success} />
            </View>
            <ReviewRow label="Lead source" value={selectedSource.display_name} />
            <ReviewRow label="Policy type" value={selectedPolicyType.label} />
            <ReviewRow label="Customer" value={mobile} />
            <ReviewRow
              label={proposalForm ? 'Proposal form' : 'Policy copy'}
              value={file?.name || 'Not attached (optional)'}
              last
            />
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
      </ScrollView>
    </SafeAreaView>
  );
}

function ReferenceHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerGlowOne} />
      <View style={styles.headerGlowTwo} />
      <Text style={styles.headerTitle}>Policy Intake</Text>
    </View>
  );
}

function SourceCard({
  source,
  active,
  index,
  onPress,
}: {
  source: PartnerPolicyIntakeSource;
  active: boolean;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={`${source.display_name}, ${source.intermediary_type}`}
      onPress={onPress}
      style={({ pressed }) => [styles.sourceCard, active && styles.sourceCardActive, pressed && styles.sourceCardPressed]}
    >
      <SourceAvatar source={source} index={index} />
      <View style={styles.sourceBody}>
        <Text numberOfLines={1} style={styles.sourceName}>{source.display_name}</Text>
        <Text numberOfLines={1} style={styles.sourceMeta}>{sourceMeta(source)}</Text>
      </View>
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={21}
        color={active ? '#4F28E9' : '#A8B0BF'}
      />
    </Pressable>
  );
}

function SourceAvatar({ source, index }: { source: PartnerPolicyIntakeSource | null; index: number }) {
  const palette = sourcePalette(index);
  const isPosp = source?.intermediary_type.toLowerCase().includes('posp');
  return (
    <View style={[styles.sourceAvatar, { backgroundColor: palette.soft }]}>
      <Ionicons name={isPosp ? 'people-outline' : 'business-outline'} size={19} color={palette.strong} />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
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
        <View style={styles.progressCopy}>
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

function sourceMeta(source: PartnerPolicyIntakeSource) {
  return `${source.intermediary_type.toUpperCase()}${source.intermediary_code ? ` · ${source.intermediary_code}` : ''}`;
}

function sourcePalette(index: number) {
  const palettes = [
    { soft: '#E7F4FF', strong: '#1686E8' },
    { soft: '#F0E9FF', strong: '#8957E5' },
    { soft: '#E6FAF6', strong: '#16B89A' },
    { soft: '#FFF2E3', strong: '#F39A24' },
    { soft: '#FFEAF1', strong: '#EE5C8E' },
    { soft: '#E9F8EE', strong: '#24B86A' },
  ];
  return palettes[index % palettes.length];
}

function formatBytes(value: number) {
  if (!value) return 'File selected';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F6F8FC' },
  header: {
    height: 78,
    marginBottom: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#0663C4',
  },
  headerGlowOne: {
    position: 'absolute',
    width: 210,
    height: 105,
    borderRadius: 105,
    right: -36,
    top: -52,
    backgroundColor: 'rgba(0,145,255,0.28)',
    transform: [{ rotate: '-9deg' }],
  },
  headerGlowTwo: {
    position: 'absolute',
    width: 180,
    height: 72,
    borderRadius: 90,
    right: -24,
    bottom: -42,
    backgroundColor: 'rgba(0,97,212,0.38)',
    transform: [{ rotate: '-13deg' }],
  },
  headerTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 21, fontWeight: '700', letterSpacing: -0.12 },
  searchFloat: {
    position: 'absolute',
    zIndex: 8,
    top: 58,
    left: 14,
    right: 14,
    height: 50,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCE2EB',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    shadowColor: '#173A66',
    shadowOpacity: 0.10,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchInput: { flex: 1, paddingVertical: 0, color: '#17243A', fontSize: 12, lineHeight: 16 },
  searchDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: '#E1E6EE' },
  filterButton: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  sourceWorkspace: { flex: 1, paddingHorizontal: 14 },
  filterRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  filterChip: { height: 30, minWidth: 62, paddingHorizontal: 12, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE4ED' },
  filterChipActive: { borderColor: '#B7A9FF', backgroundColor: '#F0EDFF' },
  filterChipText: { color: '#68758A', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#4F28E9' },
  sectionHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionHeaderIcon: { width: 25, height: 25, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F4FF' },
  sectionTitle: { color: '#15233A', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  sectionCount: { color: '#77859B', fontSize: 10.5, lineHeight: 15, fontWeight: '500' },
  offlineWrap: { marginBottom: 8 },
  sourceListContent: { paddingBottom: 10, gap: 5 },
  sourceCard: {
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E5ED',
    backgroundColor: '#FFFFFF',
  },
  sourceCardActive: { borderColor: '#AFCFF2', backgroundColor: '#EAF4FF' },
  sourceCardPressed: { opacity: 0.86 },
  sourceAvatar: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sourceBody: { flex: 1, minWidth: 0 },
  sourceName: { color: '#1B273A', fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  sourceMeta: { marginTop: 2, color: '#758197', fontSize: 9.5, lineHeight: 12, fontWeight: '500' },
  selectionFooter: {
    minHeight: 70,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DFE4EC',
    backgroundColor: '#FFFFFF',
    shadowColor: '#1D3150',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  cancelButton: { flex: 1, height: 42, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EFFF' },
  cancelText: { color: '#4F28E9', fontSize: 12, fontWeight: '700' },
  continueButton: { flex: 1, height: 42, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#4B26E8' },
  continueDisabled: { opacity: 0.42 },
  continueText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  footerPressed: { opacity: 0.72 },
  primaryPressed: { backgroundColor: '#3B1DC5' },
  emptySearch: { paddingVertical: 34, alignItems: 'center' },
  emptySearchTitle: { color: '#263349', fontSize: 13, fontWeight: '700' },
  emptySearchText: { marginTop: 5, color: '#7D899B', fontSize: 11 },
  stateWrap: { flex: 1, justifyContent: 'center' },
  detailsContent: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 34 },
  detailCard: { borderRadius: 12, borderWidth: 1, borderColor: '#E0E5ED', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  detailCardHeader: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6EAF0' },
  detailCardTitle: { color: '#1C2A40', fontSize: 12, fontWeight: '700' },
  changeText: { color: '#4F28E9', fontSize: 11, fontWeight: '700' },
  selectedSourceRow: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  formSection: { marginTop: partnerTheme.spacing.lg },
  formLabel: { marginBottom: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.label },
  policyTypeSelector: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  policyTypeIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0EDFF' },
  policyTypeValue: { flex: 1, color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  policyTypeMenu: { marginTop: 7, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  policyTypeOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  policyTypeOptionActive: { backgroundColor: '#F7F5FF' },
  policyTypeOptionIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F8' },
  policyTypeOptionIconActive: { backgroundColor: '#ECE8FF' },
  policyTypeOptionText: { flex: 1, color: '#526176', ...partnerTheme.typography.bodyStrong },
  policyTypeOptionTextActive: { color: '#3420A8' },
  upload: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  uploadSelected: { backgroundColor: partnerTheme.colors.successSoft, borderColor: '#CBE7D7' },
  uploadIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.surfaceMuted },
  uploadBody: { flex: 1 },
  uploadTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  uploadMeta: { marginTop: 3, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  disabled: { opacity: 0.55 },
  progressCard: { marginTop: partnerTheme.spacing.md, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#D9D5FF', backgroundColor: partnerTheme.colors.brandSoft },
  progressTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  progressCopy: { flex: 1 },
  progressTitle: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.bodyStrong },
  progressText: { marginTop: 3, color: '#68629A', ...partnerTheme.typography.caption },
  progressPercent: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.caption },
  progressTrack: { height: 7, marginTop: 11, overflow: 'hidden', borderRadius: 999, backgroundColor: '#D8D5F5' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: partnerTheme.colors.brandStrong },
  feedback: { marginTop: partnerTheme.spacing.md },
  retryHint: { marginTop: 7, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  reviewCard: { marginTop: partnerTheme.spacing.md, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  reviewTop: { minHeight: 42, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  reviewTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  reviewRow: { minHeight: 40, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewLabel: { width: 88, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.meta },
  reviewValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.caption },
  submit: { marginTop: partnerTheme.spacing.lg, paddingTop: partnerTheme.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  pressed: { opacity: 0.82 },
});
