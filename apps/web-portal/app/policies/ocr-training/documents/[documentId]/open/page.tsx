import { PolicyDocumentOpening } from "@/app/policies/documents/[documentId]/open/policy-document-opening";

export default async function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <PolicyDocumentOpening documentId={documentId} training />;
}
