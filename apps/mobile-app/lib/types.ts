export type AppRole =
  | 'customer'
  | 'director'
  | 'sales_head'
  | 'zonal_head'
  | 'asm'
  | 'sales_manager'
  | 'agent'
  | 'it_super_user'
  | 'backoffice_executive'
  | 'field_executive'
  | 'claim_processor'
  | 'manager'
  | 'admin'
  | 'super_admin';

export type ClaimStatus =
  | 'Draft'
  | 'Accident Reported'
  | 'Initial Documents Pending'
  | 'Initial Documents Verification Pending'
  | 'Initial Documents Submitted'
  | 'Initial Documents Verified'
  | 'Documents Pending'
  | 'Documents Submitted'
  | 'Claim Intimated'
  | 'Surveyor Appointed'
  | 'Vehicle Inspected'
  | 'Final Documents Awaited'
  | 'Final Documents Verification Pending'
  | 'Final Documents Submitted'
  | 'Final Documents Verified'
  | 'Claim Intimation'
  | 'Final Surveyor Details'
  | 'Survey Status'
  | 'Survey Done'
  | 'Work Approval Status'
  | 'Work Approval Received'
  | 'Under Repair'
  | 'Repair Done'
  | 'RA Intimation'
  | 'RA Intimation Done'
  | 'DO Status'
  | 'Payment Stage'
  | 'Claim Completion In Progress'
  | 'Claim Complete'
  | 'Estimate Submitted'
  | 'Approval Pending'
  | 'Repair Started'
  | 'Repair Completed'
  | 'DO Submitted'
  | 'Final Bill Submitted'
  | 'Settlement Under Process'
  | 'Settled'
  | 'Rejected'
  | 'Closed';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type PartnerType = 'individual_proprietor' | 'dealership' | 'corporate' | 'group';
export type CustomerOnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled';

type RowBase = { id: string; created_at?: string; updated_at?: string };

type Tables = {
  profiles: {
    Row: RowBase & { role: AppRole; full_name: string; email: string | null; phone: string | null; is_active: boolean; employee_code: string | null; reporting_manager_id: string | null; department: string | null; designation: string | null; created_by: string | null; updated_by: string | null };
    Insert: { id: string; role?: AppRole; full_name: string; email?: string | null; phone?: string | null; is_active?: boolean; employee_code?: string | null; reporting_manager_id?: string | null; department?: string | null; designation?: string | null; created_by?: string | null; updated_by?: string | null };
    Update: Partial<Tables['profiles']['Insert']>;
  };
  customers: {
    Row: RowBase & { profile_id: string | null; customer_code: string; company_name: string | null; contact_name: string; phone: string; email: string | null; address: string | null; city: string | null; state: string | null; postal_code: string | null; onboarding_status: string; assigned_agent_id: string | null; created_by: string | null; updated_by: string | null };
    Insert: { profile_id?: string | null; customer_code: string; company_name?: string | null; contact_name: string; phone: string; email?: string | null; address?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; onboarding_status?: string; assigned_agent_id?: string | null; created_by?: string | null; updated_by?: string | null };
    Update: Partial<Tables['customers']['Insert']>;
  };
  customer_onboarding_applications: {
    Row: RowBase & {
      profile_id: string | null;
      initiated_by: string | null;
      source: 'customer_app' | 'manager_portal';
      partner_type: PartnerType | null;
      status: CustomerOnboardingStatus;
      current_step: number;
      applicant_phone: string | null;
      applicant_email: string | null;
      draft_data: Json;
      customer_id: string | null;
      submitted_at: string | null;
      reviewed_by: string | null;
      reviewed_at: string | null;
      completed_at: string | null;
    };
    Insert: {
      profile_id?: string | null;
      initiated_by?: string | null;
      source: 'customer_app' | 'manager_portal';
      partner_type?: PartnerType | null;
      status?: CustomerOnboardingStatus;
      current_step?: number;
      applicant_phone?: string | null;
      applicant_email?: string | null;
      draft_data?: Json;
      customer_id?: string | null;
      submitted_at?: string | null;
      reviewed_by?: string | null;
      reviewed_at?: string | null;
      completed_at?: string | null;
    };
    Update: Partial<Tables['customer_onboarding_applications']['Insert']>;
  };
  customer_onboarding_documents: {
    Row: RowBase & {
      application_id: string;
      document_type: 'pan_copy' | 'aadhaar_front' | 'aadhaar_back' | 'gst_copy';
      file_name: string;
      storage_bucket: string;
      storage_path: string;
      mime_type: string | null;
      file_size: number | null;
      verification_status: 'pending' | 'verified' | 'rejected';
      rejection_reason: string | null;
      uploaded_by: string | null;
      verified_by: string | null;
      verified_at: string | null;
    };
    Insert: {
      application_id: string;
      document_type: 'pan_copy' | 'aadhaar_front' | 'aadhaar_back' | 'gst_copy';
      file_name: string;
      storage_bucket?: string;
      storage_path: string;
      mime_type?: string | null;
      file_size?: number | null;
      verification_status?: 'pending' | 'verified' | 'rejected';
      rejection_reason?: string | null;
      uploaded_by?: string | null;
      verified_by?: string | null;
      verified_at?: string | null;
    };
    Update: Partial<Tables['customer_onboarding_documents']['Insert']>;
  };
  vehicles: {
    Row: RowBase & { customer_id: string; vehicle_no: string; vehicle_type: string; make: string | null; model: string | null; year: number | null; chassis_no: string | null; engine_no: string | null; permit_no: string | null };
    Insert: { customer_id: string; vehicle_no: string; vehicle_type: string; make?: string | null; model?: string | null; year?: number | null; chassis_no?: string | null; engine_no?: string | null; permit_no?: string | null };
    Update: Partial<Tables['vehicles']['Insert']>;
  };
  policies: {
    Row: RowBase & { customer_id: string; vehicle_id: string; insurance_company_id: string; policy_no: string; policy_type: string; start_date: string; end_date: string; premium_amount: number | null; insured_declared_value: number | null };
    Insert: { customer_id: string; vehicle_id: string; insurance_company_id: string; policy_no: string; policy_type: string; start_date: string; end_date: string; premium_amount?: number | null; insured_declared_value?: number | null };
    Update: Partial<Tables['policies']['Insert']>;
  };
  insurance_companies: {
    Row: RowBase & { name: string; branch_name: string | null; contact_email: string | null; contact_phone: string | null; claims_portal_url: string | null };
    Insert: { name: string; branch_name?: string | null; contact_email?: string | null; contact_phone?: string | null; claims_portal_url?: string | null };
    Update: Partial<Tables['insurance_companies']['Insert']>;
  };
  claims: {
    Row: RowBase & { claim_no: string; insurer_claim_no: string | null; customer_id: string; vehicle_id: string; policy_id: string; insurance_company_id: string | null; garage_id: string | null; surveyor_id: string | null; current_status: ClaimStatus; accident_at: string | null; accident_location: string | null; accident_description: string | null; estimated_loss: number | null; approved_amount: number | null; settlement_amount: number | null; assigned_to: string | null; created_by: string | null };
    Insert: { claim_no: string; insurer_claim_no?: string | null; customer_id: string; vehicle_id: string; policy_id: string; insurance_company_id?: string | null; current_status?: ClaimStatus; accident_at?: string | null; accident_location?: string | null; accident_description?: string | null; estimated_loss?: number | null; created_by?: string | null; assigned_to?: string | null };
    Update: Partial<Tables['claims']['Insert']> & { approved_amount?: number | null; settlement_amount?: number | null; insurer_claim_no?: string | null };
  };
  claim_documents: {
    Row: RowBase & { claim_id: string; customer_id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null; file_size: number | null; verification_status: 'pending' | 'verified' | 'rejected'; verified_by: string | null; verified_at: string | null; rejection_reason: string | null; uploaded_by: string | null };
    Insert: { claim_id: string; customer_id: string; document_type: string; file_name: string; storage_bucket?: string; storage_path: string; mime_type?: string | null; file_size?: number | null; uploaded_by?: string | null };
    Update: Partial<Tables['claim_documents']['Insert']> & { verification_status?: 'pending' | 'verified' | 'rejected'; verified_by?: string | null; verified_at?: string | null; rejection_reason?: string | null };
  };
  customer_documents: {
    Row: RowBase & { customer_id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null; file_size: number | null; uploaded_by: string | null };
    Insert: { customer_id: string; document_type?: string; file_name: string; storage_bucket?: string; storage_path: string; mime_type?: string | null; file_size?: number | null; uploaded_by?: string | null };
    Update: Partial<Tables['customer_documents']['Insert']>;
  };
  claim_stage_details: {
    Row: RowBase & { claim_id: string; stage: ClaimStatus; details: Json; created_by: string | null };
    Insert: { claim_id: string; stage: ClaimStatus; details?: Json; created_by?: string | null };
    Update: Partial<Tables['claim_stage_details']['Insert']>;
  };
  claim_status_history: {
    Row: RowBase & { claim_id: string; from_status: ClaimStatus | null; to_status: ClaimStatus; notes: string | null; changed_by: string | null };
    Insert: { claim_id: string; from_status?: ClaimStatus | null; to_status: ClaimStatus; notes?: string | null; changed_by?: string | null };
    Update: Partial<Tables['claim_status_history']['Insert']>;
  };
  claim_tasks: {
    Row: RowBase & { claim_id: string; assigned_to: string | null; title: string; description: string | null; due_date: string | null; status: 'open' | 'in_progress' | 'completed' | 'cancelled'; completed_at: string | null; created_by: string | null };
    Insert: { claim_id: string; assigned_to?: string | null; title: string; description?: string | null; due_date?: string | null; status?: 'open' | 'in_progress' | 'completed' | 'cancelled'; created_by?: string | null; completed_at?: string | null };
    Update: Partial<Tables['claim_tasks']['Insert']>;
  };
  support_tickets: {
    Row: RowBase & { ticket_no: string; customer_id: string; claim_id: string | null; assigned_to: string | null; category: 'claim' | 'policy' | 'documents' | 'roadside' | 'other'; priority: 'low' | 'medium' | 'high'; subject: string; description: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; created_by: string };
    Insert: { customer_id: string; claim_id?: string | null; assigned_to?: string | null; category: 'claim' | 'policy' | 'documents' | 'roadside' | 'other'; priority?: 'low' | 'medium' | 'high'; subject: string; description: string; created_by: string; ticket_no?: string };
    Update: Partial<Tables['support_tickets']['Insert']> & { status?: 'open' | 'in_progress' | 'resolved' | 'closed' };
  };
  support_ticket_messages: {
    Row: RowBase & { ticket_id: string; sender_id: string; message: string };
    Insert: { ticket_id: string; sender_id: string; message: string };
    Update: Partial<Tables['support_ticket_messages']['Insert']>;
  };
  support_ticket_attachments: {
    Row: RowBase & { ticket_id: string; file_name: string; storage_bucket: string; storage_path: string; mime_type: string | null; file_size: number | null; uploaded_by: string };
    Insert: { ticket_id: string; file_name: string; storage_bucket?: string; storage_path: string; mime_type?: string | null; file_size?: number | null; uploaded_by: string };
    Update: Partial<Tables['support_ticket_attachments']['Insert']>;
  };
  notifications: {
    Row: RowBase & { profile_id: string | null; customer_id: string | null; claim_id: string | null; title: string; message: string; status: 'unread' | 'read' };
    Insert: { profile_id?: string | null; customer_id?: string | null; claim_id?: string | null; title: string; message: string; status?: 'unread' | 'read' };
    Update: Partial<Tables['notifications']['Insert']>;
  };
  india_locations: {
    Row: RowBase & { pincode: string; city_name: string; district: string; state_name: string; search_text: string | null };
    Insert: { pincode: string; city_name: string; district: string; state_name: string };
    Update: Partial<Tables['india_locations']['Insert']>;
  };
};

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      ensure_customer_signup_profile: {
        Args: {
          p_full_name: string;
          p_phone: string;
          p_email?: string | null;
        };
        Returns: Tables['profiles']['Row'];
      };
      submit_individual_onboarding_application: {
        Args: {
          p_application_id: string;
          p_contact_name: string;
          p_email: string;
          p_pan_number: string;
          p_aadhaar_number: string;
          p_address_street: string;
          p_address_locality?: string | null;
          p_india_location_id: string;
          p_city: string;
          p_state: string;
          p_postal_code: string;
          p_legal_trade_name?: string | null;
          p_is_gst_registered: boolean;
          p_gst_number?: string | null;
          p_fleet_size_band: 'less_than_5' | '5_to_20' | '20_to_50' | 'more_than_50';
        };
        Returns: Tables['customer_onboarding_applications']['Row'];
      };
    };
    Enums: {
      app_role: AppRole;
      claim_status: ClaimStatus;
      document_status: 'pending' | 'verified' | 'rejected';
      notification_status: 'unread' | 'read';
      task_status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Tables['profiles']['Row'];
export type Customer = Tables['customers']['Row'];
export type CustomerOnboardingApplication = Tables['customer_onboarding_applications']['Row'];
export type CustomerOnboardingDocument = Tables['customer_onboarding_documents']['Row'];
export type Vehicle = Tables['vehicles']['Row'];
export type Policy = Tables['policies']['Row'];
export type Claim = Tables['claims']['Row'];
export type ClaimDocument = Tables['claim_documents']['Row'];
export type CustomerDocument = Tables['customer_documents']['Row'];
export type ClaimStageDetail = Tables['claim_stage_details']['Row'];
export type ClaimHistory = Tables['claim_status_history']['Row'];
export type ClaimTask = Tables['claim_tasks']['Row'];
export type SupportTicket = Tables['support_tickets']['Row'];
export type SupportTicketMessage = Tables['support_ticket_messages']['Row'];
export type SupportTicketAttachment = Tables['support_ticket_attachments']['Row'];
export type Notification = Tables['notifications']['Row'];
export type InsuranceCompany = Tables['insurance_companies']['Row'];
export type IndiaLocation = Tables['india_locations']['Row'];





