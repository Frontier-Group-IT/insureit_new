from pathlib import Path

path = Path('apps/mobile-app/app/customer/self-managed-milestone.tsx')
text = path.read_text(encoding='utf-8')

if 'FINAL_BILL_DOCUMENT_TYPE' in text or 'function FinalBillUpload' in text:
    raise SystemExit('Final Bill Upload already exists; refusing duplicate insertion.')

old_type = "type ApprovalDocumentRecord = { id: string; document_type: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };"
new_type = old_type + "\ntype BillDocumentRecord = { id: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };"
if text.count(old_type) != 1:
    raise SystemExit('Approval document type anchor mismatch.')
text = text.replace(old_type, new_type, 1)

old_constants = "const MAX_APPROVAL_PDF_SIZE_BYTES = 5 * 1024 * 1024;"
new_constants = old_constants + "\nconst FINAL_BILL_DOCUMENT_TYPE = 'Final Workshop Bill';\nconst MAX_FINAL_BILL_SIZE_BYTES = 10 * 1024 * 1024;"
if text.count(old_constants) != 1:
    raise SystemExit('Approval size constant anchor mismatch.')
text = text.replace(old_constants, new_constants, 1)

old_billing = """  if (key === 'billing') return <ClaimFormSection title=\"Stage Details\" subtitle=\"Record the final workshop bill\" icon=\"receipt-text-outline\">\n    <DateField label=\"Bill Date *\" value={values.bill_date ?? ''} onChange={(v) => set('bill_date', v)} />\n    <Gap /><MoneyField label=\"Bill Amount *\" value={values.bill_amount ?? ''} onChange={(v) => set('bill_amount', v)} />\n  </ClaimFormSection>;"""
new_billing = """  if (key === 'billing') return <ClaimFormSection title=\"Stage Details\" subtitle=\"Record the final workshop bill\" icon=\"receipt-text-outline\">\n    <DateField label=\"Bill Date *\" value={values.bill_date ?? ''} onChange={(v) => set('bill_date', v)} />\n    <Gap /><MoneyField label=\"Bill Amount *\" value={values.bill_amount ?? ''} onChange={(v) => set('bill_amount', v)} />\n    {claimId && customerId ? <><Gap /><FinalBillUpload claimId={claimId} customerId={customerId} /></> : null}\n  </ClaimFormSection>;"""
if text.count(old_billing) != 1:
    raise SystemExit('Billing stage anchor mismatch.')
text = text.replace(old_billing, new_billing, 1)

component = r'''
function FinalBillUpload({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [document, setDocument] = useState<BillDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error: loadError } = await (supabase as any)
        .from('claim_documents')
        .select('id,file_name,storage_bucket,storage_path')
        .eq('claim_id', claimId)
        .eq('document_type', FINAL_BILL_DOCUMENT_TYPE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (loadError) setError('We could not load the saved bill. Please try again.');
      else setDocument((data ?? null) as BillDocumentRecord | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 2800);
    return () => clearTimeout(timer);
  }, [success]);

  async function viewBill() {
    if (!document?.storage_bucket || !document.storage_path || uploading || removing) return;
    setError('');
    try {
      const { data, error: signedUrlError } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 600);
      if (signedUrlError || !data?.signedUrl) return setError('We could not open the bill. Please try again.');
      const supported = await Linking.canOpenURL(data.signedUrl);
      if (!supported) return setError('This bill could not be opened on this device.');
      await Linking.openURL(data.signedUrl);
    } catch {
      setError('We could not open the bill. Please try again.');
    }
  }

  async function chooseAndUpload() {
    if (uploading || removing) return;
    setError('');
    setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const file = result.assets[0];
    const lowerName = file.name.toLowerCase();
    const extension = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
    const allowedExtension = ['pdf', 'jpg', 'jpeg', 'png'].includes(extension);
    const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimeType ?? '');
    if (!allowedExtension && !allowedMime) return setError('Please select a PDF, JPG or PNG file.');
    if (file.size !== null && file.size !== undefined && file.size > MAX_FINAL_BILL_SIZE_BYTES) return setError('Selected bill file is too large. Please choose a smaller file.');

    const normalizedExtension = extension === 'jpeg' ? 'jpg' : extension || (file.mimeType === 'application/pdf' ? 'pdf' : file.mimeType === 'image/png' ? 'png' : 'jpg');
    const contentType = normalizedExtension === 'pdf' ? 'application/pdf' : normalizedExtension === 'png' ? 'image/png' : 'image/jpeg';
    const session = await getCurrentSession();
    if (!session?.user) return setError('Please sign in again before uploading the bill.');

    setUploading(true);
    let newStoragePath = '';
    try {
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_FINAL_BILL_SIZE_BYTES) return setError('Selected bill file is too large. Please choose a smaller file.');

      newStoragePath = `${customerId}/${claimId}/billing/${Date.now()}-${Math.random().toString(36).slice(2)}.${normalizedExtension}`;
      const uploadResult = await supabase.storage.from('claim-documents').upload(newStoragePath, body, { contentType, upsert: false });
      if (uploadResult.error) return setError('The bill could not be uploaded. Please try again.');

      const { data: inserted, error: insertError } = await supabase.from('claim_documents').insert({
        claim_id: claimId,
        customer_id: customerId,
        document_type: FINAL_BILL_DOCUMENT_TYPE,
        file_name: file.name,
        storage_bucket: 'claim-documents',
        storage_path: newStoragePath,
        mime_type: contentType,
        file_size: file.size ?? body.byteLength,
        uploaded_by: session.user.id,
      }).select('id,file_name,storage_bucket,storage_path').single();

      if (insertError || !inserted) {
        await supabase.storage.from('claim-documents').remove([newStoragePath]);
        return setError('The bill uploaded, but its claim document record could not be saved.');
      }

      const previous = document;
      setDocument(inserted as BillDocumentRecord);
      setSuccess(previous ? 'Bill replaced successfully.' : 'Bill uploaded successfully.');
      if (previous) {
        const removeOldRecord = await (supabase as any).from('claim_documents').delete().eq('id', previous.id).eq('claim_id', claimId);
        if (!removeOldRecord.error && previous.storage_bucket && previous.storage_path) {
          await supabase.storage.from(previous.storage_bucket).remove([previous.storage_path]);
        } else if (removeOldRecord.error) {
          setError('The new bill is saved, but the previous document record could not be cleaned up.');
        }
      }
    } catch {
      if (newStoragePath) await supabase.storage.from('claim-documents').remove([newStoragePath]);
      setError('The bill could not be uploaded. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function removeBill() {
    if (!document || uploading || removing) return;
    setConfirmRemove(false);
    setError('');
    setSuccess('');
    setRemoving(true);
    const current = document;
    try {
      const removeRecord = await (supabase as any).from('claim_documents').delete().eq('id', current.id).eq('claim_id', claimId);
      if (removeRecord.error) return setError('We could not remove the bill. Please try again.');
      if (current.storage_bucket && current.storage_path) {
        const storageResult = await supabase.storage.from(current.storage_bucket).remove([current.storage_path]);
        if (storageResult.error) setError('The bill was removed from the claim, but storage cleanup could not be completed.');
      }
      setDocument(null);
      setSuccess('Bill deleted successfully.');
    } finally {
      setRemoving(false);
    }
  }

  return <View>
    <Text style={styles.billUploadLabel}>Bill Upload</Text>
    <View style={[styles.billUploadBox, document && styles.billUploadBoxSaved]}>
      <View style={[styles.billUploadIcon, document && styles.billUploadIconSaved]}>
        <MaterialCommunityIcons name={document ? 'file-document-check-outline' : 'cloud-upload-outline'} size={22} color={document ? '#168161' : '#0A43A3'} />
      </View>
      <View style={styles.billUploadCopy}>
        <Text style={styles.billUploadTitle}>{document ? document.file_name : 'Upload final workshop bill'}</Text>
        <Text style={styles.billUploadFormats}>{document ? 'Uploaded' : 'PDF, JPG, PNG'}</Text>
      </View>
      {!loading && !document ? <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.billUploadChooseButton}>
        <Text style={styles.billUploadChooseText}>{uploading ? 'Uploading...' : 'Choose File'}</Text>
      </Pressable> : null}
      {loading ? <Text style={styles.billUploadLoading}>Checking...</Text> : null}
    </View>

    {document ? <View style={styles.billUploadActions}>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void viewBill()} style={styles.billUploadSecondaryButton}><MaterialCommunityIcons name="eye-outline" size={16} color="#0A43A3" /><Text style={styles.billUploadSecondaryText}>View</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => void chooseAndUpload()} style={styles.billUploadSecondaryButton}><MaterialCommunityIcons name="refresh" size={16} color="#0A43A3" /><Text style={styles.billUploadSecondaryText}>{uploading ? 'Uploading...' : 'Replace'}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={uploading || removing} onPress={() => setConfirmRemove(true)} style={styles.billUploadRemoveButton}><MaterialCommunityIcons name="trash-can-outline" size={15} color="#C43232" /><Text style={styles.billUploadRemoveText}>{removing ? 'Removing...' : 'Remove'}</Text></Pressable>
    </View> : null}

    {success ? <View style={styles.approvalFeedbackSuccess}><MaterialCommunityIcons name="check-circle-outline" size={14} color="#168161" /><Text style={styles.approvalFeedbackSuccessText}>{success}</Text></View> : null}
    {error ? <View style={styles.approvalFeedbackError}><MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B42318" /><Text style={styles.approvalFeedbackErrorText}>{error}</Text></View> : null}

    <Modal visible={confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(false)}>
      <View style={styles.approvalModalBackdrop}>
        <View accessibilityRole="alert" style={styles.approvalModalCard}>
          <View style={styles.approvalModalIcon}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#C43232" /></View>
          <Text style={styles.approvalModalTitle}>Delete bill?</Text>
          <Text style={styles.approvalModalBody}>Are you sure you want to remove {document?.file_name ?? 'this bill'} from the claim?</Text>
          <View style={styles.approvalModalActions}>
            <Pressable accessibilityRole="button" onPress={() => setConfirmRemove(false)} style={styles.approvalModalCancel}><Text style={styles.approvalModalCancelText}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={removing} onPress={() => void removeBill()} style={styles.approvalModalDelete}><Text style={styles.approvalModalDeleteText}>{removing ? 'Deleting...' : 'Delete'}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
'''

validate_marker = '\nfunction validate(key: ClaimMilestoneKey, v: Values, milestones: ClaimMilestone[]) {'
if text.count(validate_marker) != 1:
    raise SystemExit('Validate insertion anchor mismatch.')
text = text.replace(validate_marker, '\n' + component + validate_marker, 1)

style_anchor = "  approvalUploadLoading: { color: '#718198', fontSize: 9.5, fontWeight: '700', marginTop: 10 },"
bill_styles = """  billUploadLabel: { color: palette.navy, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  billUploadBox: { minHeight: 58, borderRadius: 13, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#7EA8E8', backgroundColor: '#F9FBFF', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 9 },
  billUploadBoxSaved: { borderStyle: 'solid', borderColor: '#52B57F', backgroundColor: '#EFFAF4' },
  billUploadIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' },
  billUploadIconSaved: { backgroundColor: '#DDF4E7' },
  billUploadCopy: { flex: 1, minWidth: 0 },
  billUploadTitle: { color: palette.navy, fontSize: 10.5, lineHeight: 14, fontWeight: '900' },
  billUploadFormats: { color: '#718198', fontSize: 8.5, lineHeight: 12, fontWeight: '600', marginTop: 2 },
  billUploadChooseButton: { minHeight: 36, borderRadius: 9, backgroundColor: '#0A43A3', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  billUploadChooseText: { color: '#FFFFFF', fontSize: 9.5, fontWeight: '900' },
  billUploadLoading: { color: '#718198', fontSize: 8.5, fontWeight: '800' },
  billUploadActions: { flexDirection: 'row', gap: 7, marginTop: 7 },
  billUploadSecondaryButton: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#AFC8E8', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  billUploadSecondaryText: { color: '#0A43A3', fontSize: 9, fontWeight: '900' },
  billUploadRemoveButton: { flex: 1, minHeight: 36, borderRadius: 10, borderWidth: 1, borderColor: '#F1B5B5', backgroundColor: '#FFF5F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  billUploadRemoveText: { color: '#C43232', fontSize: 9, fontWeight: '900' },
"""
if text.count(style_anchor) != 1:
    raise SystemExit('Style insertion anchor mismatch.')
text = text.replace(style_anchor, bill_styles + style_anchor, 1)

for phrase in ['Max size: 10 MB', '(Max: 10 MB)', 'Max: 10 MB']:
    if phrase in text:
        raise SystemExit(f'Forbidden visible size copy remains: {phrase}')

path.write_text(text, encoding='utf-8')
