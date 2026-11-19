import "server-only";

import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";

/**
 * A new Intake belongs to the automated lane only when its CURRENT PDF has
 * independent native-text evidence of a trained insurer/product layout.
 * Unknown, scanned, encrypted, malformed or unreadable files remain manual.
 * This check never calls Google, n8n or creates/changes policy records.
 */
export async function isTrainedLocalN8nMotorPdf(blob: Blob, mimeType: string): Promise<boolean> {
  if (mimeType !== "application/pdf" || blob.size < 1 || blob.size > 15 * 1024 * 1024) return false;
  try {
    const pages = await extractNativePdfTextPages(new Uint8Array(await blob.arrayBuffer()));
    const beginning = pages.slice(0, 3).map(page => page.text).join("\n");
    // Require the *current document's* issuer and product code near the top.
    // A mention of another insurer in a TP reference/renewal must not route
    // an otherwise unsupported insurer into the automation workflow.
    return /\bICICI\s+LOMBARD\b/i.test(beginning.slice(0, 2400))
      && /\bProduct\s*Code\s*:?\s*3005(?:\/O)?\b/i.test(beginning.slice(0, 6500));
  } catch {
    return false;
  }
}
