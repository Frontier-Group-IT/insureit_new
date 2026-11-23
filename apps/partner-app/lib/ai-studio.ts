import { supabase } from '@/lib/supabase';

export type AiStudioBucket = 'review' | 'processing' | 'done';
export type AiStudioRow = {
  id: string;
  intake_number: string;
  lead_source_name: string | null;
  policy_type: string | null;
  status: string;
  updated_at: string;
  ocr_status: string;
  ocr_parser_id: string | null;
  final_policy_id: string | null;
  queue_state: string;
  checks_passed: number;
  exception_codes: string[];
  last_error_code: string | null;
  bucket: AiStudioBucket;
};
export type AiStudioField = { key: string; value: string; evidence: string | null };
export type AiStudioDetail = {
  id: string;
  intake_number: string;
  lead_source_name: string | null;
  policy_type: string | null;
  status: string;
  ocr_status: string;
  parser: string | null;
  parser_version: string | null;
  queue_state: string;
  checks_passed: number;
  exception_codes: string[];
  last_error_code: string | null;
  fields: AiStudioField[];
  final_policy_id: string | null;
  draft_revision: number | null;
  updated_at: string;
};
export type AiStudioPage = {
  counts: Record<AiStudioBucket, number>;
  rows: AiStudioRow[];
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export async function loadAiStudioPage(bucket: AiStudioBucket, offset = 0): Promise<AiStudioPage> {
  // This is an authenticated, employee-only security-definer RPC. Never query
  // raw intake/queue tables with the Partner anon client or store service keys.
  const { data, error } = await supabase.rpc('partner_app_ai_studio_list_v1', {
    p_filter: bucket, p_offset: offset, p_limit: 25,
  });
  if (error) throw new Error(error.code === '42501'
    ? 'This workspace is available only to authorized IT reviewers.'
    : 'AI Studio is unavailable. Check the secure Supabase connection.');
  if (!object(data) || !object(data.counts) || !Array.isArray(data.rows))
    throw new Error('AI Studio returned an unexpected response.');
  const counts = data.counts;
  const rows = data.rows.filter(object).filter(row =>
    typeof row.id === 'string' && typeof row.intake_number === 'string')
    .map(row => ({
      id: String(row.id),
      intake_number: String(row.intake_number),
      lead_source_name: typeof row.lead_source_name === 'string' ? row.lead_source_name : null,
      policy_type: typeof row.policy_type === 'string' ? row.policy_type : null,
      status: typeof row.status === 'string' ? row.status : '',
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
      ocr_status: typeof row.ocr_status === 'string' ? row.ocr_status : '',
      ocr_parser_id: typeof row.ocr_parser_id === 'string' ? row.ocr_parser_id : null,
      final_policy_id: typeof row.final_policy_id === 'string' ? row.final_policy_id : null,
      queue_state: typeof row.queue_state === 'string' ? row.queue_state : '',
      checks_passed: Number(row.checks_passed) || 0,
      exception_codes: Array.isArray(row.exception_codes) ? row.exception_codes.filter((x): x is string => typeof x === 'string') : [],
      last_error_code: typeof row.last_error_code === 'string' ? row.last_error_code : null,
      bucket,
    } satisfies AiStudioRow));
  return { counts: {
    review: Number(counts.review) || 0,
    processing: Number(counts.processing) || 0,
    done: Number(counts.done) || 0,
  }, rows };
}

export async function loadAiStudioDetail(id: string): Promise<AiStudioDetail> {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) throw new Error('Invalid intake reference.');
  const { data, error } = await supabase.rpc('partner_app_ai_studio_detail_v1', { p_intake_id: id });
  if (error) throw new Error(error.code === '42501'
    ? 'You no longer have access to this intake.'
    : 'Could not open the verified intake details.');
  if (!object(data) || typeof data.id !== 'string' || typeof data.intake_number !== 'string'
      || !Array.isArray(data.fields))
    throw new Error('The intake details could not be verified.');
  return {
    id: data.id, intake_number: data.intake_number,
    lead_source_name: typeof data.lead_source_name === 'string' ? data.lead_source_name : null,
    policy_type: typeof data.policy_type === 'string' ? data.policy_type : null,
    status: typeof data.status === 'string' ? data.status : '',
    ocr_status: typeof data.ocr_status === 'string' ? data.ocr_status : '',
    parser: typeof data.parser === 'string' ? data.parser : null,
    parser_version: typeof data.parser_version === 'string' ? data.parser_version : null,
    queue_state: typeof data.queue_state === 'string' ? data.queue_state : '',
    checks_passed: Number(data.checks_passed) || 0,
    exception_codes: Array.isArray(data.exception_codes) ? data.exception_codes.filter((x): x is string => typeof x === 'string') : [],
    last_error_code: typeof data.last_error_code === 'string' ? data.last_error_code : null,
    final_policy_id: typeof data.final_policy_id === 'string' ? data.final_policy_id : null,
    draft_revision: typeof data.draft_revision === 'number' ? data.draft_revision : null,
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : '',
    fields: data.fields.filter(object)
      .filter(field => typeof field.key === 'string' && typeof field.value === 'string')
      .map(field => ({ key: String(field.key), value: String(field.value),
        evidence: typeof field.evidence === 'string' ? field.evidence : null })),
  };
}
