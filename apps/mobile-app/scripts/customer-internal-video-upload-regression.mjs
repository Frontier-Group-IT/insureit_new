import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const stagePath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one-tracker.tsx');
const helperPath = path.join(root, 'apps/mobile-app/lib/resumable-storage-upload.ts');
const otaWorkflowPath = path.join(root, '.github/workflows/publish-customer-release-production-ota.yml');

const stage = fs.readFileSync(stagePath, 'utf8');
const helper = fs.readFileSync(helperPath, 'utf8');
const otaWorkflow = fs.readFileSync(otaWorkflowPath, 'utf8');

const checks = [
  ['Accident Video remains multi-select', stage.includes("const multi = key === 'accident_photo' || key === 'accident_video'") && stage.includes('multiple: multi')],
  ['Video batch keeps three concurrent workers', stage.includes('runConcurrent(picked, 3,')],
  ['Verified document locking is preserved', stage.includes('verifiedTypes') && stage.includes("locked={verifiedTypes.has(DOCUMENT_TYPE_BY_KEY.accident_video)}")],
  ['Rejected/re-upload request state is preserved', stage.includes('reuploadRequestedTypes') && stage.includes("requested={reuploadRequestedTypes.has(DOCUMENT_TYPE_BY_KEY.accident_video)}")],
  ['Incident voice note flow is preserved', stage.includes('<IncidentVoiceNote') && stage.includes('voiceVerified')],
  ['Video limit remains 50 MB', stage.includes('MAX_VIDEO_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024')],
  ['Video path uses resumable storage helper', stage.includes('uploadResumableStorageFile({') && stage.includes('accessToken: session.access_token')],
  ['Non-video document path remains standard Supabase upload', stage.includes("supabase.storage.from('claim-documents').upload(storagePath, body")],
  ['Resumable rollout is guarded by an explicit Expo flag', helper.includes("process.env.EXPO_PUBLIC_CLAIM_VIDEO_RESUMABLE_UPLOAD === 'true'") && helper.includes('if (!RESUMABLE_VIDEO_UPLOAD_ENABLED)')],
  ['Disabled rollout retains the prior standard Supabase upload fallback', helper.includes('uploadStandardStorageFile({') && helper.includes('fileBlob.arrayBuffer()') && helper.includes('supabase.storage.from(bucket).upload(objectPath, body')],
  ['Resumable helper uses direct Supabase Storage host', helper.includes('.storage.supabase.co/storage/v1/upload/resumable')],
  ['Resumable helper uses required 6 MB chunks', helper.includes('TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024')],
  ['Resumable helper creates and patches TUS uploads', helper.includes("method: 'POST'") && helper.includes("method: 'PATCH'")],
  ['Resumable helper recovers offsets with HEAD', helper.includes("method: 'HEAD'") && helper.includes("headers.get('Upload-Offset')")],
  ['Resumable helper sends TUS protocol header', helper.includes("'Tus-Resumable': TUS_VERSION")],
  ['Enabled resumable path stays chunked instead of converting the whole video buffer', helper.includes('fileBlob.slice(offset, Math.min(offset + TUS_CHUNK_SIZE_BYTES, fileBlob.size))')],
  ['Failed resumable uploads attempt TUS-session and storage-object cleanup', helper.includes("method: 'DELETE'") && helper.includes('supabase.storage.from(bucket).remove([objectPath])')],
  ['Permanent chunk failures do not run through the retry catch', helper.includes('let response: Response;') && helper.includes('if (!isRetryableStatus(response.status)) throw lastError;')],
  ['Production OTA enables the rollout by default', otaWorkflow.includes("EXPO_PUBLIC_CLAIM_VIDEO_RESUMABLE_UPLOAD: ${{ github.event_name == 'workflow_dispatch' && inputs.enable_resumable_video_upload || 'true' }}")],
  ['Production OTA supports immediate flag rollback without a new binary', otaWorkflow.includes('enable_resumable_video_upload:') && otaWorkflow.includes("- 'false'") && otaWorkflow.includes('Rollback: manually dispatch this workflow with resumable video upload set to false.')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);

if (failed.length) {
  console.error(`\n${failed.length} internal video upload regression check(s) failed.`);
  process.exit(1);
}

console.log('\nCustomer internal-claim video upload regression passed.');
