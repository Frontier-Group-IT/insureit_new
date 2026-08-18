import { PolicyDocumentOpening } from "./policy-document-opening";

export default async function Page({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <PolicyDocumentOpening documentId={documentId} />;
}
