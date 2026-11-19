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
    const icici3005 = /\bICICI\s+LOMBARD\b/i.test(beginning.slice(0, 2400))
      && /\bProduct\s*Code\s*:?\s*3005(?:\/O)?\b/i.test(beginning.slice(0, 6500));
    // Explicit opt-in after the existing protected webhook is proven to
    // dispatch to Tata AIG and the site accepts the separate 18-check contract.
    // A generic mention of Tata in a prior insurer/agent section is NOT enough.
    const tataAig = process.env.INSUREIT_TATA_AIG_N8N_ENABLED === "true"
      && /\bTATA\s+AIG\b/i.test(beginning.slice(0, 2400))
      && /Thank you for choosing TATA AIG as your Insurer/i.test(beginning.slice(0, 6000))
      && /(?:Bundled Auto Secure - Private Car Policy|Auto Secure - Standalone Own Damage Private Car Policy|Auto Secure - Private Car Package Policy)/i.test(beginning.slice(0, 800))
      && /\bPolicy No\.\s*\n\s*\d{10}\s+\d{2}\s+\d{2}\b/i.test(beginning.slice(0, 3000));
    return icici3005 || tataAig;
  } catch {
    return false;
  }
}
