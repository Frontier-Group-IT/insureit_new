import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import InternalClaimStageLegacy from '@/components/internal-claim-stage-legacy';
import InternalClaimStageOneTracker from '@/components/internal-claim-stage-one-tracker';
import InternalClaimStageParity from '@/components/internal-claim-stage-parity';
import { LoadingState, Screen } from '@/components/ui';
import { initialClaimDocuments, matchesRequiredDocument } from '@/lib/claim-documents';
import { supabase } from '@/lib/supabase';

type ReuploadNotice = {
  title: string;
  metadata: Record<string, unknown> | null;
};

type ClaimDocumentStatus = {
  document_type: string;
  verification_status: string | null;
};

function noticeDocumentType(notice: ReuploadNotice) {
  const metadataType = notice.metadata?.document_type;
  return typeof metadataType === 'string' && metadataType.trim() ? metadataType.trim() : notice.title.trim();
}

function isInitialDocumentType(documentType: string) {
  const normalized = documentType.trim().toLowerCase();
  if (normalized.includes('incident voice note') || normalized.includes('audio') || normalized.includes('spot intimation attachment')) return true;
  return initialClaimDocuments.some((required) => matchesRequiredDocument(documentType, required.type));
}

export default function InternalClaimStageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const stageKey = typeof params.key === 'string' ? params.key : '';
  const [routeResolved, setRouteResolved] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!claimId) {
        if (active) setRouteResolved(true);
        return;
      }

      const [activityResult, documentsResult] = await Promise.all([
        supabase
          .from('customer_activity_events')
          .select('title,metadata')
          .eq('claim_id', claimId)
          .eq('event_type', 'claim_document_reuploaded')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('claim_documents')
          .select('document_type,verification_status')
          .eq('claim_id', claimId)
          .order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      const notices = (activityResult.data ?? []) as ReuploadNotice[];
      const documents = (documentsResult.data ?? []) as ClaimDocumentStatus[];
      let rejectedDocumentType = '';

      for (const notice of notices) {
        const documentType = noticeDocumentType(notice);
        if (!documentType) continue;
        const latestMatchingDocument = documents.find((document) => matchesRequiredDocument(document.document_type, documentType));
        if (latestMatchingDocument?.verification_status === 'rejected') {
          rejectedDocumentType = documentType;
          break;
        }
      }

      if (!rejectedDocumentType) {
        setRouteResolved(true);
        return;
      }

      const exactStageKey = isInitialDocumentType(rejectedDocumentType) ? 'spot_intimation' : 'claim_intimation';
      if (stageKey !== exactStageKey) {
        router.replace({
          pathname: '/customer/internal-claim-stage',
          params: { id: claimId, key: exactStageKey, documentType: rejectedDocumentType },
        });
        return;
      }

      setRouteResolved(true);
    })();

    return () => {
      active = false;
    };
  }, [claimId, router, stageKey]);

  if (!routeResolved) {
    return <Screen title="Claim Stage"><LoadingState label="Opening required document" /></Screen>;
  }

  if (stageKey === 'spot_intimation') {
    return <InternalClaimStageOneTracker />;
  }

  if (stageKey === 'spot_status') {
    return <InternalClaimStageLegacy />;
  }

  return <InternalClaimStageParity />;
}
