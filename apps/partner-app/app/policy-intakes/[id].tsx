import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { PartnerAssets } from '@/lib/partner-assets';
import {
  getPartnerPolicyIntake,
  getPartnerPolicyIntakeDocumentUrl,
  partnerPolicyIntakeMatchUrl,
  updatePartnerPolicyIntakeReview,
  submitPartnerPolicyIntakeReplacement,
  type PartnerPolicyIntake,
  type PolicyIntakeReviewAccess,
  type PolicyIntakeDuplicateMatch,
  type PartnerPolicyIntakeUploadProgress,
} from '@/lib/policy-intakes';
import { partnerTheme } from '@/lib/theme';
import { prepareNativePolicyOnboarding } from '@/lib/policy-onboarding';
import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export default function PolicyIntakeDetailScreen() {
  const router = useRouter();
  const { context } = usePartnerSession();
  const { id, submitted } = useLocalSearchParams<{ id: string; submitted?: string }>();
  const [row, setRow] = useState<(PartnerPolicyIntake & { review_access: PolicyIntakeReviewAccess; reviewer_conflict_name: string | null; reviewer_conflict_id: string | null; duplicate_match: PolicyIntakeDuplicateMatch | null }) | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [rejectConfirmationOpen, setRejectConfirmationOpen] = useState(false);
  const [openingDocument, setOpeningDocument] = useState(false);
  const [openingReview, setOpeningReview] = useState(false);
  const [reviewerConflictName, setReviewerConflictName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replacing, setReplacing] = useState(false);
  const [replacementProgress, setReplacementProgress] = useState<PartnerPolicyIntakeUploadProgress | null>(null);
  const [error, setError] = useState('');
  const replacementLockRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const intake = await getPartnerPolicyIntake(id);
      setRow(intake);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Policy Intake could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => new Map((row?.ocr_fields ?? []).map((field) => [field.key, field])), [row?.ocr_fields]);
  const proposalForm = row?.policy_type === 'life' || row?.policy_type === 'health';

  async function replaceDocument() {
    if (!row || replacementLockRef.current) return;
    setError('');
    const result = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    if (file.size && file.size > MAX_FILE_SIZE) {
      setError(`${proposalForm ? 'Proposal form' : 'Policy copy'} must be 15 MB or smaller.`);
      return;
    }

    replacementLockRef.current = true;
    setReplacing(true);
    setReplacementProgress({ stage: 'preparing' });
    try {
      await submitPartnerPolicyIntakeReplacement({
        intakeId: row.id,
        file,
        onProgress: setReplacementProgress,
      });
      setReplacementProgress(null);
      await load();
    } catch (cause) {
      setReplacementProgress(null);
      setError(cause instanceof Error ? cause.message : 'Replacement document could not be submitted.');
    } finally {
      replacementLockRef.current = false;
      setReplacing(false);
    }
  }

  async function submitReviewAction(status: 'needs_attention' | 'rejected') {
    if (!row?.review_access.can_review || reviewBusy) return;
    if (!reviewNote.trim()) { setError('Add an Operations note before continuing.'); return; }
    setReviewBusy(true);
    setError('');
    try {
      await updatePartnerPolicyIntakeReview(row.id, status, reviewNote.trim());
      setReviewNote('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this intake.');
    } finally {
      setReviewBusy(false);
    }
  }

  function confirmReviewAction(status: 'needs_attention' | 'rejected') {
    if (status === 'rejected') {
      if (reviewBusy) return;
      if (!reviewNote.trim()) {
        setError('Add an Operations note before rejecting this intake.');
        return;
      }
      setError('');
      setRejectConfirmationOpen(true);
      return;
    }
    void submitReviewAction(status);
  }

  async function openDuplicateMatch() {
    const match = row?.duplicate_match;
    const targetPath = match?.target_path;
    if (!match || !targetPath) return;

    if (match.kind === 'registered_policy') {
      // The server supplies a canonical, access-checked Policy Register match.
      // Navigate to the same in-app Policy Details screen used by Policies,
      // which independently checks the current user's policy read scope.
      const policyId = /^\/policies\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(targetPath)?.[1];
      if (!policyId) {
        setError('The existing policy link is unavailable. Please refresh the intake.');
        return;
      }
      router.push(`/policy/${policyId}` as never);
      return;
    }

    const url = partnerPolicyIntakeMatchUrl(targetPath);
    if (!url) {
      setError('The earlier intake link is unavailable. Please refresh the intake.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      setError('Could not open the earlier intake in Operations.');
    }
  }

  async function openPolicyCopy() {
    if (!row?.file_name || openingDocument) return;
    setOpeningDocument(true);
    setError('');
    try {
      // Signed URL is issued only after server-side intake read-scope verification.
      const url = await getPartnerPolicyIntakeDocumentUrl(row.id);
      await Linking.openURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the policy copy.');
    } finally {
      setOpeningDocument(false);
    }
  }

  async function openOperationsReview(confirmedConflict = false) {
    if (!row?.review_access.can_finalize || openingReview) return;
    setOpeningReview(true);
    setError('');
    try {
      // Refresh server-authorized assignment before showing the pre-navigation
      // prompt. This GET does not claim or change the reviewer.
      const latest = await getPartnerPolicyIntake(row.id);
      setRow(latest);
      if (!latest.review_access.can_finalize || latest.duplicate_match ||
          !['in_review', 'ready_for_review', 'processing'].includes(latest.status)) {
        setReviewerConflictName(null);
        setError('This intake is no longer available for Policy Onboarding.');
        return;
      }
      if (latest.reviewer_conflict_name && !confirmedConflict) {
        setReviewerConflictName(latest.reviewer_conflict_name);
        return;
      }
      // The app has received the user's only reviewer-change confirmation.
      // The native API checks reviewer assignment and prepares the saved draft.
      await prepareNativePolicyOnboarding(latest.id, confirmedConflict, latest.reviewer_conflict_id);
      setReviewerConflictName(null);
      router.push({ pathname: '/policy-intakes/onboarding', params: { id: latest.id } });
    } catch (cause) {
      setReviewerConflictName(null);
      setError(cause instanceof Error ? cause.message : 'Could not open Operations Policy Intake Review.');
    } finally {
      setOpeningReview(false);
    }
  }

  return (
    <PartnerScreen
      title="Policy Intake"
      navyTopBar
      navyStatusBar
      fullWidth
      bottomNavigation={<PolicyIntakeDetailNavigation router={router} canViewDashboard={canPartnerAccess(context, "view_dashboard")} canViewPolicies={canPartnerAccess(context, "view_policies")} canViewClaims={canPartnerAccess(context, "view_claims")} />}
      artwork={PartnerAssets.actions.quickPolicyIntake}
      onBack={() => router.back()}
    >
      {submitted === '1' && row ? (
        <View style={styles.banner}>
          <PartnerBanner
            tone="success"
            title={`Policy Intake ${row.intake_number} submitted`}
            message="Received by Operations. Track progress here."
          />
        </View>
      ) : null}

      {loading ? (
        <PartnerStateView state="loading" title="Loading Policy Intake" />
      ) : error && !row ? (
        <PartnerStateView
          state="error"
          title="Policy Intake unavailable"
          message={error}
          actionLabel="Try again"
          onAction={() => void load()}
        />
      ) : !row ? (
        <PartnerStateView state="empty" asset={PartnerAssets.emptyStates.policyUpload} title="Policy Intake unavailable" message="This submission is not available in your account." />
      ) : (
        <>
          {error ? (
            <View style={styles.banner}>
              <PartnerBanner tone="danger" title="Action not completed" message={error} />
            </View>
          ) : null}

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <View style={styles.statusLogoWrap}>
                <Image source={PartnerAssets.actions.policyChecklist} style={styles.statusArtwork} resizeMode="contain" accessibilityLabel="Policy document" />
              </View>
              <View style={styles.statusBody}>
                <View style={styles.statusTitleRow}>
                  <View style={styles.statusIdentity}>
                    <Text numberOfLines={2} style={styles.intakeNumber}>{fields.get('policy_number')?.value?.trim() || 'Policy pending'}</Text>
                  <View style={styles.intakeSummaryCompact}>
                    <Text numberOfLines={3} style={styles.summaryLine}>
                      {[row.customer_mobile, fields.get('insured_name')?.value?.trim()
                        || fields.get('customer_name')?.value?.trim()
                        || fields.get('name_of_insured')?.value?.trim()
                        || 'Customer name pending'].filter(Boolean).join(' · ')}
                    </Text>
                    <Text numberOfLines={3} style={styles.summaryLine}>
                      {`${row.lead_source_name || 'Lead source unavailable'} (${row.submitted_by_name?.trim() || 'Submitter unavailable'})`}
                    </Text>
                    {row.status !== 'duplicate' && row.status !== 'ready_for_review' && row.status !== 'in_review' && row.status !== 'rejected' && row.status !== 'needs_attention' && !(row.status === 'processing' && row.ocr_status !== 'failed')
                      ? <Text style={styles.statusHelp}>{statusHelp(row)}</Text> : null}
                  </View>
                  </View>
                  <View style={[styles.statusMeta, row.status === 'duplicate' && styles.statusMetaDuplicate]}>
                    {row.status === 'duplicate' ? (
                      <Text numberOfLines={2} style={styles.submittedByName}>{row.submitted_by_name?.trim() || 'Submitter unavailable'}</Text>
                    ) : (
                      <View style={[styles.statusBadge, statusBadgeStyle(row)]}>
                        <Text style={[styles.statusBadgeText, statusBadgeTextStyle(row)]}>{statusLabel(row)}</Text>
                      </View>
                    )}
                    <Text style={styles.statusDate}>{formatDate(row.updated_at)}</Text>
                  </View>
                </View>
              </View>
            </View>
            {row.status !== 'duplicate' ? <IntakeProgress row={row} /> : null}
          </View>

          {row.final_policy_id ? (
            <View style={styles.finalPolicy}>
              <PartnerButton
                label="Open final policy"
                icon="document-text-outline"
                onPress={() => router.push(`/policy/${row.final_policy_id}` as never)}
              />
            </View>
          ) : null}

          {row.attention_reason?.trim() && row.status !== 'duplicate' ? (
            <View style={styles.attention}>
              <View style={styles.attentionTop}>
                <View style={styles.attentionArtworkWrap}><Image source={PartnerAssets.status.policyAttention} style={styles.attentionArtwork} resizeMode="contain" /></View>
                <Text style={styles.attentionTitle}>{row.status === 'rejected' ? 'Operations rejection note' : 'Upload a replacement policy copy'}</Text>
              </View>
              <Text selectable style={styles.attentionText}>{row.attention_reason}</Text>

              {replacementProgress ? <ReplacementProgress progress={replacementProgress} /> : null}

              <View style={styles.replaceButton}>
                <PartnerButton
                  label={replacing ? replacementLabel(replacementProgress) : `Upload replacement ${proposalForm ? 'proposal form' : 'policy copy'}`}
                  icon="cloud-upload-outline"
                  loading={replacing}
                  disabled={replacing}
                  onPress={() => void replaceDocument()}
                />
              </View>
            </View>
          ) : null}

          {row.status === 'duplicate' ? (
            <View style={styles.policyCopyCard}>
              <View style={styles.policyCopyHeading}>
                <Ionicons name="document-attach-outline" size={17} color="#315B9A" />
                <Text style={reviewStyles.sectionLabel}>{proposalForm ? 'PROPOSAL FORM' : 'POLICY COPY'}</Text>
              </View>
              <Text numberOfLines={2} style={reviewStyles.documentName}>{row.file_name || 'Not attached'}</Text>
              {row.file_name ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={proposalForm ? 'View proposal form' : 'View policy copy'}
                  disabled={openingDocument}
                  onPress={() => void openPolicyCopy()}
                  style={({ pressed }) => [reviewStyles.documentButton, pressed && styles.pressed]}
                >
                  <Ionicons name="document-attach-outline" size={15} color="#17365D" />
                  <Text style={reviewStyles.documentButtonText}>{openingDocument ? 'Opening…' : proposalForm ? 'View proposal form' : 'View policy copy'}</Text>
                  <Ionicons name="open-outline" size={13} color="#315B9A" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {row.status === 'duplicate' && row.duplicate_match ? (
            <View style={styles.duplicatePanel}>
              <View style={styles.duplicateHeader}>
                <Ionicons name="alert-circle-outline" size={19} color="#A91F3B" accessibilityLabel="Duplicate policy intake" />
                <Text style={styles.duplicateTitle}>DUPLICATE POLICY INTAKE</Text>
              </View>
              <Text style={styles.duplicateText}>
                {row.duplicate_match.kind === 'registered_policy'
                  ? `Policy ${row.duplicate_match.policy_number} already exists in the Policy Register.`
                  : `Policy ${row.duplicate_match.policy_number} was already submitted under ${row.duplicate_match.intake_number}.`}
              </Text>
              {row.duplicate_match.target_path ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={row.duplicate_match.kind === 'registered_policy' ? 'View Existing Policy' : 'View Earlier Intake'}
                  accessibilityHint={row.duplicate_match.kind === 'registered_policy' ? 'Opens the matched policy in the Partner App Policy Details screen.' : 'Opens the earlier policy intake in Operations.'}
                  onPress={() => void openDuplicateMatch()}
                  style={({ pressed }) => [styles.duplicateLink, pressed && styles.pressed]}
                >
                  <Text style={styles.duplicateLinkText}>{row.duplicate_match.kind === 'registered_policy' ? 'View Existing Policy' : 'View Earlier Intake'}</Text>
                  <Ionicons name="open-outline" size={14} color="#9F2436" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={reviewStyles.sheet}>
            <Text style={reviewStyles.sheetTitle}>Policy Intake Review</Text>
            {!proposalForm ? (
              <>
                {row.status === 'duplicate' ? (
                  <>
                    <ReviewBlock title="Vehicle details">
                      {vehicleReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim())) ? (
                        vehicleReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map(([key, label]) => (
                          <ReviewPair key={key} label={label} value={fields.get(key)?.value} confidence={fields.get(key)?.confidence} singleLine={key === 'vehicle_make'} />
                        ))
                      ) : (
                        <Text style={reviewStyles.emptyVehicle}>No vehicle details were fetched from the saved policy copy.</Text>
                      )}
                    </ReviewBlock>
                    <ReviewBlock title="Policy & premium">
                      {duplicatePolicyReviewKeys.map(([key, label]) => (
                        <ReviewPair key={key} label={label} value={fields.get(key)?.value} confidence={fields.get(key)?.confidence} />
                      ))}
                    </ReviewBlock>
                  </>
                ) : (
                  <>
                <ReviewBlock title="Vehicle details">
                  {vehicleReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim())) ? (
                    vehicleReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map(([key, label]) => (
                      <ReviewPair key={key} label={label} value={fields.get(key)?.value} confidence={fields.get(key)?.confidence} singleLine={key === 'vehicle_make'} />
                    ))
                  ) : (
                    <Text style={reviewStyles.emptyVehicle}>{row.ocr_status === 'processing' ? 'Fetching vehicle details from the policy copy…' : 'No vehicle details were fetched from the saved policy copy.'}</Text>
                  )}
                </ReviewBlock>
                <ReviewBlock title="Policy & premium">
                  {policyReviewKeys.some(([key]) => Boolean(fields.get(key)?.value?.trim())) ? (
                    policyReviewKeys.filter(([key]) => Boolean(fields.get(key)?.value?.trim())).map(([key, label]) => (
                      <ReviewPair key={key} label={label} value={key === 'insurer_name' ? shortInsurerName(fields.get(key)?.value) : fields.get(key)?.value} confidence={fields.get(key)?.confidence} />
                    ))
                  ) : (
                    <Text style={reviewStyles.emptyVehicle}>{row.ocr_status === 'processing' ? 'Fetching policy and premium details…' : 'No policy or premium details were fetched from the saved policy copy.'}</Text>
                  )}
                </ReviewBlock>
                  </>
                )}
              </>
            ) : (
              <Text style={reviewStyles.caption}>Life / Health proposal forms are reviewed manually. No motor OCR fields are expected.</Text>
            )}

            {row.status !== 'duplicate' ? (
            <View style={reviewStyles.documentBox}>
              <Text style={reviewStyles.sectionLabel}>{proposalForm ? 'Proposal form' : 'Policy copy'}</Text>
              <Text style={reviewStyles.documentName} numberOfLines={2}>{row.file_name || 'Not attached'}</Text>
              {row.file_name ? (
                <Pressable accessibilityRole="button" accessibilityLabel={proposalForm ? 'View proposal form' : 'View policy copy'}
                  disabled={openingDocument} onPress={() => void openPolicyCopy()} style={reviewStyles.documentButton}>
                  <Ionicons name="document-attach-outline" size={15} color="#17365D" />
                  <Text style={reviewStyles.documentButtonText}>{openingDocument ? 'Opening…' : proposalForm ? 'View proposal form' : 'View policy copy'}</Text>
                  <Ionicons name="open-outline" size={13} color="#315B9A" />
                </Pressable>
              ) : null}
            </View>

            ) : null}

            {row.status !== 'duplicate' ? <View style={reviewStyles.reviewStatus}>
              <Text style={reviewStyles.sectionLabel}>Review status</Text>
              <ReviewPair label="Detail fetch" value={row.ocr_status === 'completed' ? 'Details fetched' : row.ocr_status === 'failed' ? 'Manual review' : humanize(row.ocr_status)} />
              <ReviewPair label="Reviewer" value={row.status === 'completed' ? 'Completed by Operations' : ['in_review','needs_attention'].includes(row.status) ? 'Operations team' : 'Not assigned'} />
            </View> : null}

            {row.review_access.can_review && !['completed', 'rejected', 'duplicate'].includes(row.status) ? (
              <View style={reviewStyles.reviewActions}>
                {row.review_access.can_finalize && (['ready_for_review', 'in_review'].includes(row.status) || (row.status === 'processing' && row.ocr_status === 'failed')) ? (
                  <PartnerButton label={openingReview ? 'Checking reviewer…' : row.status === 'in_review' ? 'Resume Policy Onboarding' : 'Review & Finalize'} icon="arrow-forward-outline" disabled={openingReview} onPress={() => void openOperationsReview()} />
                ) : null}
                <View style={reviewStyles.operationsNoteCard}>
                  <Text style={reviewStyles.operationsNoteHeading}>Operations Note</Text>
                  <TextInput
                    value={reviewNote}
                    onChangeText={setReviewNote}
                    multiline
                    maxLength={2000}
                    editable={!reviewBusy}
                    accessibilityLabel="Operations note for requesting information or rejecting intake"
                    placeholder="Explain what Sales should correct, or why this is rejected"
                    placeholderTextColor="#94A3B8"
                    style={reviewStyles.noteInput}
                  />
                  <View style={reviewStyles.actionRow}>
                    <Pressable
                      disabled={reviewBusy}
                      onPress={() => confirmReviewAction('needs_attention')}
                      accessibilityRole="button"
                      accessibilityLabel="Request information from submitter"
                      style={[reviewStyles.actionButton, reviewStyles.requestInfoButton, reviewBusy && reviewStyles.actionDisabled]}
                    >
                      <Ionicons name="warning-outline" size={15} color="#A65C18" />
                      <Text style={reviewStyles.requestInfoText}>Request info</Text>
                    </Pressable>
                    <Pressable
                      disabled={reviewBusy}
                      onPress={() => confirmReviewAction('rejected')}
                      accessibilityRole="button"
                      accessibilityLabel="Reject policy intake"
                      style={[reviewStyles.actionButton, reviewStyles.rejectButton, reviewBusy && reviewStyles.actionDisabled]}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#B42318" />
                      <Text style={reviewStyles.rejectText}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Always last, after every available section and Operations action,
                including duplicate, pending and read-only intake statuses. */}
            {row.ocr_warnings?.length ? (
              <View style={reviewStyles.warningBox}>
                <Text style={reviewStyles.warningHeading}>Review notes</Text>
                {row.ocr_warnings.map((warning, index) => (
                  <Text key={index} style={reviewStyles.warningText}>{warning}</Text>
                ))}
              </View>
            ) : null}
          </View>
        </>
      )}
      <Modal
        visible={rejectConfirmationOpen}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!reviewBusy) setRejectConfirmationOpen(false); }}
      >
        <View style={styles.rejectModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cancel policy intake rejection"
            disabled={reviewBusy}
            onPress={() => setRejectConfirmationOpen(false)}
          />
          <View style={styles.rejectModalCard} accessibilityViewIsModal>
            <View style={styles.rejectModalIcon}>
              <Ionicons name="alert-circle-outline" size={22} color="#B42318" />
            </View>
            <Text style={styles.rejectModalTitle}>Reject Policy Intake?</Text>
            <Text style={styles.rejectModalMessage}>
              This will reject the intake and notify the submitter with your Operations note.
            </Text>
            <Text numberOfLines={3} style={styles.rejectModalNote}>{reviewNote.trim()}</Text>
            <View style={styles.rejectModalActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel rejection"
                disabled={reviewBusy}
                onPress={() => setRejectConfirmationOpen(false)}
                style={[styles.rejectModalButton, styles.rejectModalCancel]}
              >
                <Text style={styles.rejectModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm reject policy intake"
                disabled={reviewBusy}
                onPress={() => { setRejectConfirmationOpen(false); void submitReviewAction('rejected'); }}
                style={[styles.rejectModalButton, styles.rejectModalConfirm, reviewBusy && styles.rejectModalDisabled]}
              >
                <Text style={styles.rejectModalConfirmText}>Reject Intake</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal transparent visible={Boolean(reviewerConflictName)} animationType="fade" onRequestClose={() => setReviewerConflictName(null)}>
        <View style={reviewerStyles.backdrop}>
          <View style={reviewerStyles.dialog} accessibilityRole="alert">
            <View style={reviewerStyles.header}>
              <View style={reviewerStyles.warningIcon}><Ionicons name="warning-outline" size={20} color="#B66B0B" /></View>
              <View style={reviewerStyles.headerText}>
                <Text style={reviewerStyles.title}>Change reviewer?</Text>
                <Text style={reviewerStyles.message}>This intake is currently being reviewed by <Text style={reviewerStyles.bold}>{reviewerConflictName}</Text>. If you continue, the reviewer will be changed to you and you can proceed with Policy Onboarding.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close reviewer change dialog" onPress={() => setReviewerConflictName(null)} style={reviewerStyles.close}><Ionicons name="close" size={19} color="#7A8798" /></Pressable>
            </View>
            <View style={reviewerStyles.actions}>
              <Pressable accessibilityRole="button" disabled={openingReview} onPress={() => setReviewerConflictName(null)} style={[reviewerStyles.action, reviewerStyles.cancel]}>
                <Text style={reviewerStyles.cancelText}>Keep current reviewer</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={openingReview} onPress={() => void openOperationsReview(true)} style={[reviewerStyles.action, reviewerStyles.continue]}>
                <Text style={reviewerStyles.continueText}>{openingReview ? 'Opening…' : 'Change reviewer & continue'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </PartnerScreen>
  );
}

function PolicyIntakeDetailNavigation({
  router, canViewDashboard, canViewPolicies, canViewClaims,
}: {
  router: ReturnType<typeof useRouter>;
  canViewDashboard: boolean;
  canViewPolicies: boolean;
  canViewClaims: boolean;
}) {
  const items: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; path: string; available: boolean; active?: boolean }> = [
    { label: 'Home', icon: 'home-outline', path: '/(tabs)', available: canViewDashboard },
    { label: 'Business', icon: 'briefcase-outline', path: '/(tabs)/business', available: canViewDashboard },
    { label: 'Policies', icon: 'document-text', path: '/(tabs)/policies', available: canViewPolicies, active: true },
    { label: 'Claims', icon: 'shield-checkmark-outline', path: '/(tabs)/claims', available: canViewClaims },
    { label: 'More', icon: 'grid-outline', path: '/(tabs)/more', available: true },
  ];
  return <View style={styles.bottomNav}>
    {items.map((item) => (
      <Pressable
        key={item.label}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ disabled: !item.available, selected: Boolean(item.active) }}
        disabled={!item.available}
        onPress={() => router.push(item.path as never)}
        style={({ pressed }) => [styles.navItem, !item.available && styles.navDisabled, pressed && styles.pressed]}
      >
        <View style={[styles.navIconWrap, item.active && styles.navIconWrapActive]}>
          <Ionicons name={item.icon} size={19} color={item.active ? '#633DF1' : '#60738F'} />
        </View>
        <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>{item.label}</Text>
      </Pressable>
    ))}
  </View>;
}

const vehicleReviewKeys: Array<[string, string]> = [
  ['vehicle_registration_status','Registration status'],
  ['vehicle_registration_number','Registration number'],
  ['vehicle_make','Vehicle make'],
  ['vehicle_model','Vehicle model'],
  ['vehicle_fuel_type','Fuel type'],
  ['vehicle_manufacturing_year','Manufacturing year'],
  ['vehicle_capacity','Vehicle capacity'],
  ['vehicle_chassis_number','Chassis number'],
  ['vehicle_engine_number','Engine number'],
  ['vehicle_rto_name','RTO name'],
  ['vehicle_rto_state','RTO state'],
  ['vehicle_class','Vehicle class'],
];
const duplicatePolicyReviewKeys: Array<[string, string]> = [
  ['policy_number','Policy number'],
  ['cpa_premium','CPA amount'],
  ['cpa_opted','CPA opted'],
];
const policyReviewKeys: Array<[string, string]> = [
  ['policy_product','Policy product'],
  ['policy_number','Policy number'],
  ['insurer_name','Insurance company'],
  ['idv','IDV / Sum insured'],
  ['od_premium','OD premium'],
  ['tp_premium','TP premium'],
  ['cpa_premium','CPA amount'],
  ['cpa_opted','CPA opted'],
  ['policy_start_date','Valid from'],
  ['policy_end_date','Valid upto'],
  ['total_premium','Printed net premium'],
  ['tax_amount','Printed GST'],
  ['gross_premium','Printed gross premium'],
];
function ReviewBlock({title,children,description}:{title:string;children:ReactNode;description?:string}) {
  return <View style={reviewStyles.block}>
    <View style={reviewStyles.blockHeader}>
      <Ionicons name={title === "Vehicle details" ? "car-sport-outline" : "shield-checkmark-outline"} size={18} color="#315B9A" />
      <View style={reviewStyles.blockHeading}>
        <Text style={reviewStyles.blockTitle}>{title}</Text>
        {description ? <Text style={reviewStyles.blockDescription}>{description}</Text> : null}
      </View>
    </View>
    <View style={reviewStyles.rows}>{children}</View>
  </View>;
}
function shortInsurerName(fullName?: string | null): string {
  const name = fullName?.trim() ?? '';
  if (!name) return '';
  // Presentation-only aliases: preserve the exact insurer name in OCR, review and backend.
  const aliases: Array<[RegExp, string]> = [
    [/\bicici\s*lombard\b/i, 'ICICI Lombard'],
    [/\bhdfc\s*ergo\b/i, 'HDFC ERGO'],
    [/\bbajaj\s*allianz\b/i, 'Bajaj Allianz'],
    [/\btata\s*aig\b/i, 'Tata AIG'],
    [/\bsbi\s*general\b/i, 'SBI General'],
    [/\biffco\s*tokio\b/i, 'IFFCO Tokio'],
    [/\breliance\s*general\b/i, 'Reliance General'],
    [/\broyal\s*sundaram\b/i, 'Royal Sundaram'],
    [/\bnew\s*india\s*assurance\b/i, 'New India Assurance'],
    [/\bunited\s*india\s*insurance\b/i, 'United India'],
    [/\boriental\s*insurance\b/i, 'Oriental Insurance'],
    [/\bnational\s*insurance\b/i, 'National Insurance'],
    [/\bshriram\s*general\b/i, 'Shriram General'],
    [/\bchola(?:mandalam)?\s*ms\b/i, 'Chola MS'],
    [/\buniversal\s*sompo\b/i, 'Universal Sompo'],
    [/\bgo\s*digit\b/i, 'Digit'],
    [/\backo\b/i, 'ACKO'],
    [/\bliberty\s*general\b/i, 'Liberty General'],
    [/\bkotak\s*mahindra\b/i, 'Kotak Mahindra'],
    [/\bfuture\s*generali\b/i, 'Future Generali'],
    [/\bmagma\s*hdi\b/i, 'Magma HDI'],
    [/\bzuno\b/i, 'Zuno'],
  ];
  return aliases.find(([pattern]) => pattern.test(name))?.[1]
    ?? name.replace(/\s+(?:General\s+)?Insurance\s+(?:Company\s+)?(?:Limited|Ltd\.?|Co\.?\s*Ltd\.?)$/i, '').trim();
}

function ReviewPair({label,value,confidence,singleLine=false}:{label:string;value?:string|null;confidence?:number|null;singleLine?:boolean}) {
  const caution=typeof confidence === 'number' && confidence < .9;
  return <View style={reviewStyles.pair}>
    <View style={reviewStyles.pairLabelRow}><Text style={reviewStyles.pairLabel}>{label}</Text></View>
    <Text selectable numberOfLines={singleLine ? 1 : undefined} ellipsizeMode="tail" style={[reviewStyles.pairValue,caution && reviewStyles.lowConfidence]}>{value?.trim() || '—'}</Text>
  </View>;
}
const reviewStyles=StyleSheet.create({
  sheet:{marginHorizontal:8,marginTop:7,marginBottom:8,borderWidth:1,borderColor:'#DCE5EF',borderRadius:10,backgroundColor:'#FFFFFF',padding:9,gap:7},
  sheetTitle:{fontSize:13,fontWeight:'500',color:'#17365D'},
  sheetCaption:{fontSize:10,color:'#65768D'},
  emptyVehicle:{fontSize:10,color:'#68758A',paddingVertical:10},
  block:{borderRadius:10,borderWidth:1,borderColor:'#E2E9F3',overflow:'hidden'},
  blockHeader:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:9,paddingVertical:7,backgroundColor:'#EDF3FC'},
  blockTitle:{fontSize:11,color:'#17365D',fontWeight:'500'},
  blockHeading:{flex:1,gap:2},
  blockDescription:{fontSize:9,lineHeight:13,color:'#71829A'},
  rows:{paddingHorizontal:9,paddingVertical:2},
  pair:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingVertical:5,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5EAF2'},
  pairLabelRow:{flex:1,flexDirection:'row',flexWrap:'wrap',gap:4,alignItems:'center'},
  pairLabel:{fontSize:10,color:'#62758E',lineHeight:15},
  pairValue:{flex:1.4,textAlign:'right',fontSize:10.5,lineHeight:15,color:'#193659',fontWeight:'400'},
  lowConfidence:{color:'#A46B14'},
  warningBox:{padding:9,backgroundColor:'#FFF8EA',borderRadius:8,gap:3},
  warningHeading:{fontSize:10,fontWeight:'500',color:'#995E20'},
  warningText:{fontSize:10,lineHeight:16,color:'#946320'},
  documentBox:{padding:10,borderRadius:10,backgroundColor:'#F4F7FC',gap:6},
  documentName:{fontSize:10,fontWeight:'400',color:'#344B69'},
  documentButton:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D6E1EF',borderRadius:9},
  documentButtonText:{fontSize:10.5,fontWeight:'500',color:'#17365D'},
  sectionLabel:{fontSize:10,fontWeight:'500',color:'#526680'},
  reviewStatus:{padding:9,borderRadius:10,backgroundColor:'#F8FAFD'},
  reviewActions:{gap:12},
  operationsNoteCard:{padding:12,borderWidth:1,borderColor:'#DFE7F2',borderRadius:14,backgroundColor:'#FFFFFF',gap:10},
  operationsNoteHeading:{fontSize:10,fontWeight:'500',color:'#5C7190',textTransform:'uppercase',letterSpacing:.7},
  noteInput:{minHeight:66,maxHeight:120,paddingHorizontal:12,paddingVertical:10,textAlignVertical:'top',borderWidth:1,borderColor:'#D4C9FF',borderRadius:11,color:'#17365D',fontSize:12},
  actionRow:{flexDirection:'row',gap:8},
  actionButton:{flex:1,minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,borderRadius:12},
  requestInfoButton:{backgroundColor:'#FFF9EC'},
  requestInfoText:{color:'#A65C18',fontSize:10.5,fontWeight:'500'},
  rejectButton:{backgroundColor:'#FFF0F0'},
  rejectText:{color:'#B42318',fontSize:10.5,fontWeight:'500'},
  actionDisabled:{opacity:.6},
  caption:{fontSize:10,color:'#65768D',lineHeight:15,textAlign:'center'},
});

function IntakeProgress({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === 'processing' && row.ocr_status === 'failed';
  const activeStep = row.status === 'completed'
    ? 4
    : row.status === 'in_review'
      ? 3
      : row.status === 'ready_for_review' || row.status === 'needs_attention' || manual
        ? 2
        : 1;

  const rejected = row.status === 'rejected' || row.status === 'duplicate';

  return (
    <View
      accessibilityLabel={rejected
        ? `Policy Intake status: ${statusLabel(row)}`
        : `Policy Intake progress: step ${activeStep} of 4, ${statusLabel(row)}`}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 1,
        max: 4,
        now: activeStep,
        text: rejected ? `Closed: ${statusLabel(row)}` : `Step ${activeStep} of 4: ${statusLabel(row)}`,
      }}
      style={styles.progressWrap}
    >
      {['Uploaded', 'Read', 'Review', 'Done'].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        const current = !rejected && step === activeStep;
        return (
          <View key={label} style={styles.progressStep}>
            <View style={styles.progressLineWrap}>
              <View style={[styles.progressDot, complete && styles.progressDotComplete, current && styles.progressDotCurrent, rejected && step === activeStep && styles.progressDotRejected]} />
              {index < 3 ? <View style={[styles.progressLine, step < activeStep && !rejected && styles.progressLineComplete]} /> : null}
            </View>
            <Text style={[styles.progressLabel, complete && styles.progressLabelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ReplacementProgress({ progress }: { progress: PartnerPolicyIntakeUploadProgress }) {
  const percent = progress.stage === 'preparing'
    ? 8
    : progress.stage === 'submitting'
      ? 96
      : Math.max(12, Math.min(92, progress.percent ?? 12));

  return (
    <View
      accessibilityLabel={`${replacementLabel(progress)}, ${Math.round(percent)} percent`}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent), text: `${Math.round(percent)} percent` }}
      style={styles.replacementProgress}
    >
      <View style={styles.replacementProgressTop}>
        <View style={styles.replacementArtworkWrap}><Image source={PartnerAssets.status.documentUpload} style={styles.replacementArtwork} resizeMode="contain" /></View>
        <Text style={styles.replacementProgressText}>{replacementLabel(progress)}</Text>
        <Text style={styles.replacementProgressText}>{Math.round(percent)}%</Text>
      </View>
      <View style={styles.replacementTrack}><View style={[styles.replacementFill, { width: `${percent}%` }]} /></View>
    </View>
  );
}

function DetailDisclosure({
  title,
  summary,
  leading,
  expanded,
  onPress,
  children,
}: {
  title: string;
  summary: string;
  leading?: ReactNode;
  expanded: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.disclosureWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${title}`}
        onPress={onPress}
        style={({ pressed }) => [styles.disclosure, pressed && styles.pressed]}
      >
        {leading}
        <View style={styles.disclosureBody}>
          <Text style={styles.disclosureTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.disclosureSummary}>{summary}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={partnerTheme.colors.brand} />
      </Pressable>
      {expanded ? <View style={styles.disclosureContent}>{children}</View> : null}
    </View>
  );
}

function Detail({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function statusBadgeStyle(row: PartnerPolicyIntake) {
  if (row.status === 'rejected' || row.status === 'duplicate') return styles.statusBadgeRejected;
  if (row.status === 'completed') return styles.statusBadgeCompleted;
  return styles.statusBadgeProcessing;
}

function statusBadgeTextStyle(row: PartnerPolicyIntake) {
  if (row.status === 'rejected' || row.status === 'duplicate') return styles.statusBadgeTextRejected;
  if (row.status === 'completed') return styles.statusBadgeTextCompleted;
  return styles.statusBadgeTextProcessing;
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Manual review required';
  return ({
    processing: 'Fetching policy details',
    ready_for_review: 'Ready for Review',
    in_review: 'In Operations review',
    needs_attention: 'Your response is needed',
    completed: 'Policy onboarding completed',
    rejected: 'Intake rejected',
    duplicate: 'Duplicate',
  } as Record<string, string>)[row.status] || humanize(row.status);
}

function statusHelp(row: PartnerPolicyIntake) {
  if (row.status === 'processing' && row.ocr_status === 'failed') return 'Automatic extraction was unavailable. Operations can continue from the saved policy copy.';
  if (row.status === 'ready_for_review') return 'The extracted details are ready for an Operations reviewer.';
  if (row.status === 'completed') return 'The final policy was linked and this intake is closed.';
  if (row.status === 'duplicate') return 'The policy was found in an existing record. Review and onboarding are disabled.';
  return 'Track this submission here.';
}

function pendingLabel(row: PartnerPolicyIntake) {
  return row.ocr_status === 'failed' ? 'Manual review' : row.ocr_status === 'completed' ? 'Not found' : 'Fetching…';
}

function replacementLabel(progress: PartnerPolicyIntakeUploadProgress | null) {
  if (!progress) return 'Uploading replacement…';
  if (progress.stage === 'preparing') return 'Preparing secure upload';
  if (progress.stage === 'submitting') return 'Sending to Operations';
  return progress.percent != null ? `Uploading · ${progress.percent}%` : 'Uploading replacement';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
const reviewerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', paddingHorizontal: 18 },
  dialog: { borderRadius: 18, padding: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5EF' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningIcon: { height: 36, width: 36, borderRadius: 18, backgroundColor: '#FFF7E8', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '500', color: '#17365D' },
  message: { fontSize: 11, lineHeight: 18, marginTop: 7, color: '#64748B' },
  bold: { fontWeight: '500', color: '#334155' },
  close: { padding: 4 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  action: { flex: 1, minHeight: 44, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  cancel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8E0EA' },
  continue: { backgroundColor: '#17365D' },
  cancelText: { color: '#475569', fontSize: 10, fontWeight: '500', textAlign: 'center' },
  continueText: { color: '#FFFFFF', fontSize: 10, fontWeight: '500', textAlign: 'center' },
});


const styles = StyleSheet.create({
  rejectModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(10,25,50,0.50)' },
  rejectModalCard: { width: '100%', maxWidth: 330, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 18, alignItems: 'center', gap: 9, elevation: 8 },
  rejectModalIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF0EE', alignItems: 'center', justifyContent: 'center' },
  rejectModalTitle: { fontSize: 14, fontWeight: '500', color: '#17365D', textAlign: 'center' },
  rejectModalMessage: { fontSize: 12, lineHeight: 18, color: '#64748B', textAlign: 'center' },
  rejectModalNote: { alignSelf: 'stretch', borderRadius: 8, backgroundColor: '#F5F7FB', paddingHorizontal: 10, paddingVertical: 8, fontSize: 11, color: '#344B69', lineHeight: 16 },
  rejectModalActions: { flexDirection: 'row', alignSelf: 'stretch', gap: 8, marginTop: 6 },
  rejectModalButton: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rejectModalCancel: { borderWidth: 1, borderColor: '#D5E0EF', backgroundColor: '#FFFFFF' },
  rejectModalCancelText: { fontSize: 11, fontWeight: '500', color: '#344B69' },
  rejectModalConfirm: { backgroundColor: '#B42318' },
  rejectModalConfirmText: { fontSize: 11, fontWeight: '500', color: '#FFFFFF' },
  rejectModalDisabled: { opacity: 0.5 },
  policyCopyCard: { marginHorizontal: 8, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE5EF', gap: 7 },
  policyCopyHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  submittedByName: { fontSize: 10, fontWeight: '500', color: '#17365D', textAlign: 'right', lineHeight: 15 },
  duplicatePanel: { marginHorizontal: 8, marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECACA', gap: 7 },
  duplicateHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  duplicateTitle: { color: '#A91F3B', fontSize: 11, fontWeight: '500', letterSpacing: 0.3 },
  duplicateText: { color: '#9F2436', fontSize: 11, lineHeight: 17 },
  duplicateLink: { alignSelf: 'flex-start', minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFFFFF' },
  duplicateLinkText: { color: '#9F2436', fontSize: 10.5, fontWeight: '500' },
  banner: { marginBottom: 10 },
  statusCard: { marginHorizontal: 0, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line, backgroundColor: partnerTheme.colors.surface },
  statusTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  statusLogoWrap: { width: 34, height: 37, alignItems: 'center', justifyContent: 'center' },
  statusArtwork: { width: 34, height: 36 },
  statusLogo: { width: 38, height: 38 },
  statusBody: { flex: 1, minWidth: 0, paddingTop: 1 },
  statusTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  statusIdentity: { flex: 1, minWidth: 0, gap: 1 },
  intakeNumber: { color: partnerTheme.colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '500' },
  intakeSummaryCompact: { marginTop: 0, marginBottom: 0 },
  summaryLine: { marginTop: 0, color: '#64748B', fontSize: 10.5, lineHeight: 15 },
  statusHelp: { marginTop: 4, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  statusMeta: { flexShrink: 0, maxWidth: '47%', alignItems: 'flex-end', gap: 3 },
  statusMetaDuplicate: { paddingTop: 0 },
  statusBadge: { maxWidth: '100%', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeCompleted: { backgroundColor: '#E8F7EE' },
  statusBadgeRejected: { backgroundColor: '#FDECEC' },
  statusBadgeProcessing: { backgroundColor: '#FFF3DF' },
  statusBadgeText: { textAlign: 'right', fontSize: 9, lineHeight: 12, fontWeight: '500' },
  statusBadgeTextCompleted: { color: '#19713C' },
  statusBadgeTextRejected: { color: '#B42318' },
  statusBadgeTextProcessing: { color: '#9A5B13' },
  statusDate: { color: partnerTheme.colors.inkSubtle, textAlign: 'right', fontSize: 9, lineHeight: 12, fontWeight: '400' },
  progressWrap: { marginTop: 7, paddingTop: 7, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: partnerTheme.colors.line },
  progressStep: { flex: 1, alignItems: 'center' },
  progressLineWrap: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  progressDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: partnerTheme.colors.lineStrong },
  progressDotComplete: { backgroundColor: partnerTheme.colors.brand },
  progressDotCurrent: { borderWidth: 2, borderColor: partnerTheme.colors.brandStrong },
  progressDotRejected: { backgroundColor: '#EF8C83' },
  progressLine: { position: 'absolute', left: '58%', width: '84%', height: 1, backgroundColor: partnerTheme.colors.line },
  progressLineComplete: { backgroundColor: partnerTheme.colors.brand },
  progressLabel: { marginTop: 4, color: partnerTheme.colors.inkSubtle, fontSize: 9, lineHeight: 12, fontWeight: '400' },
  progressLabelActive: { color: partnerTheme.colors.ink },
  finalPolicy: { marginTop: 10 },
  attention: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#F0D7AE', backgroundColor: '#FFF7E8' },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionArtworkWrap: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  attentionArtwork: { width: 36, height: 36 },
  attentionTitle: { flex: 1, color: '#80511A', fontSize: 11.5, lineHeight: 17, fontWeight: '500' },
  attentionText: { marginTop: 7, color: '#80511A', fontSize: 12, lineHeight: 19, flexShrink: 1 },
  replacementProgress: { marginTop: 9 },
  replacementProgressTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replacementArtworkWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  replacementArtwork: { width: 28, height: 28 },
  replacementProgressText: { flexShrink: 1, color: '#80511A', ...partnerTheme.typography.meta },
  replacementTrack: { height: 7, marginTop: 6, overflow: 'hidden', borderRadius: 999, backgroundColor: '#F0D7AE' },
  replacementFill: { height: '100%', borderRadius: 999, backgroundColor: '#A36A22' },
  replaceButton: { marginTop: 9 },
  proposalNote: { marginBottom: 7, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: partnerTheme.radius.lg, borderWidth: 1, borderColor: '#DCD6FF', backgroundColor: '#F7F5FF' },
  proposalNoteText: { flex: 1, color: '#5B5681', ...partnerTheme.typography.caption },
  disclosureWrap: { marginBottom: 7 },
  disclosure: { minHeight: partnerTheme.control.minTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: partnerTheme.radius.lg, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  disclosureLogoWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FB', borderWidth: 1, borderColor: partnerTheme.colors.line },
  disclosureLogo: { width: 28, height: 28 },
  disclosureBody: { flex: 1, minWidth: 0 },
  disclosureTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  disclosureSummary: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  disclosureContent: { marginTop: 7 },
  details: { overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  detailRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  detailRowLast: { borderBottomWidth: 0 },
  detailLabel: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  detailValue: { flex: 1, color: partnerTheme.colors.ink, textAlign: 'right', ...partnerTheme.typography.caption },
  bottomNav: { height: 58, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#DDE3EC', backgroundColor: '#FFFFFF' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navDisabled: { opacity: 0.35 },
  navIconWrap: { minWidth: 36, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navIconWrapActive: { backgroundColor: '#EEE9FF' },
  navLabel: { marginTop: 1, color: '#60738F', fontSize: 7.5, lineHeight: 10, fontWeight: '400' },
  navLabelActive: { color: '#633DF1', fontWeight: '500' },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
});