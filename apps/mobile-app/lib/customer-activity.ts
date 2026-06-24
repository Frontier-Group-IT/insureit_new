import { supabase } from './supabase';
import type { Json } from './types';

export type CustomerActivityEventType =
  | 'claim_submitted'
  | 'claim_document_uploaded'
  | 'claim_document_reuploaded'
  | 'claim_documents_completed'
  | 'support_ticket_created'
  | 'support_ticket_message_sent'
  | 'support_ticket_attachment_uploaded'
  | 'customer_kyc_uploaded'
  | 'customer_kyc_deleted'
  | 'endorsement_requested'
  | 'roadside_call_started'
  | 'notification_unread';

export type CustomerActivityPriority = 'low' | 'medium' | 'high' | 'critical';

export type RecordCustomerActivityInput = {
  customerId: string;
  claimId?: string | null;
  vehicleId?: string | null;
  policyId?: string | null;
  supportTicketId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  eventType: CustomerActivityEventType;
  title: string;
  message?: string | null;
  priority?: CustomerActivityPriority;
  metadata?: Json;
};

export async function recordCustomerActivity(input: RecordCustomerActivityInput) {
  const payload = {
    customer_id: input.customerId,
    claim_id: input.claimId ?? null,
    vehicle_id: input.vehicleId ?? null,
    policy_id: input.policyId ?? null,
    support_ticket_id: input.supportTicketId ?? null,
    source_table: input.sourceTable ?? null,
    source_id: input.sourceId ?? null,
    event_type: input.eventType,
    title: input.title,
    message: input.message ?? null,
    priority: input.priority ?? 'medium',
    status: 'new',
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from('customer_activity_events').insert(payload as never);

  if (error) {
    // Activity logging must never block the customer's main action.
    // The main upload/ticket action should remain successful even if this insert fails.
    console.warn('Unable to record customer activity event', error.message);
    return { success: false, error };
  }

  return { success: true, error: null };
}

export function getDocumentUploadActivityType(wasRejectedBefore?: boolean): CustomerActivityEventType {
  return wasRejectedBefore ? 'claim_document_reuploaded' : 'claim_document_uploaded';
}

export function getDocumentUploadPriority(wasRejectedBefore?: boolean): CustomerActivityPriority {
  return wasRejectedBefore ? 'high' : 'medium';
}
