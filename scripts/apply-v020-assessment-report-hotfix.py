from pathlib import Path

p = Path('apps/mobile-app/app/customer/self-managed-milestone.tsx')
s = p.read_text()

s = s.replace(
    "type ApprovalDocumentRecord = { id: string; document_type: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };",
    "type ApprovalDocumentRecord = { id: string; document_type: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };\ntype DeliveryOrderDocumentRecord = { id: string; document_type: string; file_name: string; storage_bucket?: string | null; storage_path?: string | null };",
)
s = s.replace(
    "const MAX_APPROVAL_PDF_SIZE_BYTES = 5 * 1024 * 1024;",
    "const MAX_APPROVAL_PDF_SIZE_BYTES = 5 * 1024 * 1024;\nconst ASSESSMENT_REPORT_DOCUMENT_TYPE = 'Assessment Report';\nconst MAX_DELIVERY_ORDER_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;",
)

old = '''    return <ClaimFormSection title="Stage Details" subtitle="Record assessment and delivery order details" icon="clipboard-plus-outline">\n      <ClaimChoice label="Assessment Received? *" value={values.assessment_received} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => set('assessment_received', v)} />\n      <Gap /><DateField label="DO Date *" value={values.do_date ?? ''} onChange={(v) => set('do_date', v)} />\n      <Gap /><MoneyField label="DO Amount *" value={values.do_amount ?? ''} onChange={(v) => set('do_amount', v)} />\n      <ClaimFinancialSummary rows={[\n        ...(bill !== null ? [{ label: 'Bill Amount', value: currency(bill) }] : []),\n        ...(currentDo !== null ? [{ label: 'DO Amount', value: currency(currentDo) }] : []),\n        ...(contribution !== null ? [{ label: 'Customer Contribution', value: currency(contribution), emphasis: true }] : []),\n      ]} />\n    </ClaimFormSection>;'''
new = '''    return <ClaimFormSection title="Stage Details" subtitle="Record assessment and delivery order details" icon="clipboard-plus-outline">\n      <ClaimChoice label="Assessment Received? *" value={values.assessment_received} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => set('assessment_received', v)} />\n      <Gap /><DateField label="DO Date *" value={values.do_date ?? ''} onChange={(v) => set('do_date', v)} />\n      <Gap /><MoneyField label="DO Amount *" value={values.do_amount ?? ''} onChange={(v) => set('do_amount', v)} />\n      <ClaimFinancialSummary rows={[\n        ...(bill !== null ? [{ label: 'Bill Amount', value: currency(bill) }] : []),\n        ...(currentDo !== null ? [{ label: 'DO Amount', value: currency(currentDo) }] : []),\n        ...(contribution !== null ? [{ label: 'Customer Contribution', value: currency(contribution), emphasis: true }] : []),\n      ]} />\n      {claimId && customerId ? <><Gap /><DeliveryOrderAssessmentReport claimId={claimId} customerId={customerId} /></> : null}\n    </ClaimFormSection>;'''
if old not in s:
    raise SystemExit('Delivery Order block not found')
s = s.replace(old, new, 1)

component = r'''function DeliveryOrderAssessmentReport({ claimId, customerId }: { claimId: string; customerId: string }) {
  const [document, setDocument] = useState<DeliveryOrderDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: loadError } = await (supabase as any).from('claim_documents').select('id,document_type,file_name,storage_bucket,storage_path').eq('claim_id', claimId).eq('document_type', ASSESSMENT_REPORT_DOCUMENT_TYPE).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!active) return;
      if (loadError) setError('We could not load the saved Assessment Report. Please try again.');
      else setDocument((data ?? null) as DeliveryOrderDocumentRecord | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [claimId]);

  async function chooseAndUpload() {
    if (uploading || removing) return;
    setError(''); setSuccess('');
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    if (file.size != null && file.size > MAX_DELIVERY_ORDER_DOCUMENT_SIZE_BYTES) return setError(`${file.name} is larger than 10 MB. Please choose a smaller file.`);
    const session = await getCurrentSession();
    if (!session?.user) return setError('Please sign in again before uploading the Assessment Report.');
    setUploading(true);
    let storagePath = '';
    try {
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      if (body.byteLength > MAX_DELIVERY_ORDER_DOCUMENT_SIZE_BYTES) return setError(`${file.name} is larger than 10 MB. Please choose a smaller file.`);
      const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
      storagePath = `${customerId}/${claimId}/delivery-order/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
      if (uploadResult.error) return setError('The Assessment Report could not be uploaded. Please try again.');
      const { data, error: insertError } = await supabase.from('claim_documents').insert({ claim_id: claimId, customer_id: customerId, document_type: ASSESSMENT_REPORT_DOCUMENT_TYPE, file_name: file.name, storage_bucket: 'claim-documents', storage_path: storagePath, mime_type: file.mimeType ?? null, file_size: body.byteLength, uploaded_by: session.user.id }).select('id,document_type,file_name,storage_bucket,storage_path').single();
      if (insertError || !data) { await supabase.storage.from('claim-documents').remove([storagePath]); return setError('The Assessment Report uploaded, but its record could not be saved.'); }
      const previous = document;
      setDocument(data as DeliveryOrderDocumentRecord);
      setSuccess(previous ? 'Assessment Report replaced successfully.' : 'Assessment Report uploaded successfully.');
      if (previous) {
        const deleted = await (supabase as any).from('claim_documents').delete().eq('id', previous.id).eq('claim_id', claimId);
        if (!deleted.error && previous.storage_bucket && previous.storage_path) await supabase.storage.from(previous.storage_bucket).remove([previous.storage_path]);
      }
    } catch {
      if (storagePath) await supabase.storage.from('claim-documents').remove([storagePath]);
      setError('The Assessment Report could not be uploaded. Please try again.');
    } finally { setUploading(false); }
  }

  async function removeDocument() {
    if (!document || removing || uploading) return;
    setConfirmRemove(false); setRemoving(true); setError(''); setSuccess('');
    const current = document;
    try {
      const removed = await (supabase as any).from('claim_documents').delete().eq('id', current.id).eq('claim_id', claimId);
      if (removed.error) return setError('We could not remove the Assessment Report. Please try again.');
      if (current.storage_bucket && current.storage_path) await supabase.storage.from(current.storage_bucket).remove([current.storage_path]);
      setDocument(null); setSuccess('Assessment Report deleted successfully.');
    } finally { setRemoving(false); }
  }

  return <>
    <View style={[styles.deliveryReportRow, document && styles.deliveryReportRowSaved]}>
      <View style={styles.deliveryReportLeading}><View style={styles.deliveryReportIcon}><MaterialCommunityIcons name="file-document-outline" size={17} color="#0A43A3" /></View><View style={styles.deliveryReportCopy}><Text style={styles.deliveryReportLabel}>Assessment Report <Text style={styles.deliveryReportOptional}>(Optional)</Text></Text>{document ? <Text style={styles.deliveryReportFile} numberOfLines={1}>{document.file_name}</Text> : null}</View></View>
      <Pressable accessibilityRole="button" disabled={loading || uploading || removing} onPress={() => void chooseAndUpload()} style={styles.deliveryReportUploadButton}><MaterialCommunityIcons name={document ? 'refresh' : 'upload-outline'} size={13} color="#FFFFFF" /><Text style={styles.deliveryReportUploadText}>{loading ? 'Checking' : uploading ? 'Uploading' : document ? 'Replace' : 'Upload'}</Text></Pressable>
      {document ? <Pressable accessibilityRole="button" accessibilityLabel="Remove Assessment Report" onPress={() => setConfirmRemove(true)} style={styles.deliveryReportRemove}><MaterialCommunityIcons name="close" size={12} color="#C43232" /></Pressable> : null}
    </View>
    {success ? <View style={styles.approvalFeedbackSuccess}><MaterialCommunityIcons name="check-circle-outline" size={14} color="#168161" /><Text style={styles.approvalFeedbackSuccessText}>{success}</Text></View> : null}
    {error ? <View style={styles.approvalFeedbackError}><MaterialCommunityIcons name="alert-circle-outline" size={14} color="#B42318" /><Text style={styles.approvalFeedbackErrorText}>{error}</Text></View> : null}
    <Modal visible={confirmRemove} transparent animationType="fade" onRequestClose={() => setConfirmRemove(false)}><View style={styles.approvalModalBackdrop}><View accessibilityRole="alert" style={styles.approvalModalCard}><View style={styles.approvalModalIcon}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#C43232" /></View><Text style={styles.approvalModalTitle}>Delete document?</Text><Text style={styles.approvalModalBody}>Are you sure you want to remove the Assessment Report from the claim?</Text><View style={styles.approvalModalActions}><Pressable onPress={() => setConfirmRemove(false)} style={styles.approvalModalCancel}><Text style={styles.approvalModalCancelText}>Cancel</Text></Pressable><Pressable disabled={removing} onPress={() => void removeDocument()} style={styles.approvalModalDelete}><Text style={styles.approvalModalDeleteText}>{removing ? 'Deleting...' : 'Delete'}</Text></Pressable></View></View></View></Modal>
  </>;
}

'''
marker = 'function WorkApprovalPdfUpload'
idx = s.index(marker)
s = s[:idx] + component + s[idx:]

styles = r'''  deliveryReportRow: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: '#DDE5EF', backgroundColor: '#FFFFFF', paddingLeft: 8, paddingRight: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  deliveryReportRowSaved: { borderColor: '#B9DCC9', backgroundColor: '#FBFFFD' },
  deliveryReportLeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  deliveryReportIcon: { width: 25, height: 25, borderRadius: 7, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  deliveryReportCopy: { flex: 1, minWidth: 0 },
  deliveryReportLabel: { color: palette.navy, fontSize: 9.5, lineHeight: 12, fontWeight: '800' },
  deliveryReportOptional: { color: '#718198', fontWeight: '600' },
  deliveryReportFile: { color: '#65758A', fontSize: 7.8, lineHeight: 10, fontWeight: '600', marginTop: 1 },
  deliveryReportUploadButton: { minHeight: 28, borderRadius: 7, backgroundColor: '#073C91', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  deliveryReportUploadText: { color: '#FFFFFF', fontSize: 8.3, fontWeight: '900' },
  deliveryReportRemove: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F1B5B5', alignItems: 'center', justifyContent: 'center' },
'''
pos = s.rfind('});')
if pos < 0:
    raise SystemExit('Styles closing marker not found')
s = s[:pos] + styles + s[pos:]
p.write_text(s)
