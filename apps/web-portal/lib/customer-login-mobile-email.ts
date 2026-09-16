import "server-only";
import { sendResendEmail } from "@/lib/resend-email";

type CustomerLoginMobileEmailInput = {
  to: string;
  editorName: string;
  customerName: string;
  customerCode: string;
  previousMobile: string;
  newMobile: string;
  changedAt: Date;
  idempotencyKey: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

export function maskMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const lastFour = digits.slice(-4).padStart(4, "•");
  return `******${lastFour}`;
}

function formatIst(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function sendCustomerLoginMobileChangedEmail(input: CustomerLoginMobileEmailInput) {
  const previousMobile = maskMobile(input.previousMobile);
  const newMobile = maskMobile(input.newMobile);
  const changedAt = formatIst(input.changedAt);
  const subject = "Customer Login Mobile Updated | INSUREIT";
  const text = [
    "INSUREIT",
    "",
    "Customer Login Mobile Updated",
    "",
    "The customer login mobile number has been successfully updated.",
    "",
    `Customer: ${input.customerName}`,
    `Customer Code: ${input.customerCode}`,
    `Previous Login Mobile: ${previousMobile}`,
    `New Login Mobile: ${newMobile}`,
    `Updated By: ${input.editorName}`,
    `Date & Time: ${changedAt}`,
    "",
    "This is a confirmation of the change performed from the INSUREIT portal.",
    "No OTP, SMS or customer-facing email was sent as part of this admin update.",
    "",
    "INSUREIT",
    "Your Safety, Our Promise",
  ].join("\n");

  const rows = [
    ["Customer", input.customerName],
    ["Customer Code", input.customerCode],
    ["Previous Login Mobile", previousMobile],
    ["New Login Mobile", newMobile],
    ["Updated By", input.editorName],
    ["Date & Time", changedAt],
  ].map(([label, value]) => `<tr><td style="padding:10px 12px;color:#64748b;font-size:13px;border-bottom:1px solid #e2e8f0;width:42%">${escapeHtml(label)}</td><td style="padding:10px 12px;color:#0f172a;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`).join("");

  const html = `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dbe4ef;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,.08)"><tr><td style="background:#071d49;padding:24px 28px"><div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-.5px">INSUREIT</div><div style="margin-top:4px;font-size:11px;color:#bfdbfe;letter-spacing:.08em;text-transform:uppercase">Your Safety, Our Promise</div></td></tr><tr><td style="padding:28px"><h1 style="margin:0;font-size:22px;line-height:1.3;color:#0f2d5c">Customer Login Mobile Updated</h1><p style="margin:10px 0 22px;font-size:14px;line-height:1.6;color:#475569">The customer login mobile number has been successfully updated.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">${rows}</table><div style="margin-top:20px;padding:14px 16px;border-radius:10px;background:#f8fafc;color:#475569;font-size:12px;line-height:1.6">This is a confirmation of the change performed from the INSUREIT portal. No OTP, SMS or customer-facing email was sent as part of this admin update.</div></td></tr><tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">INSUREIT · Transactional security notification</td></tr></table></td></tr></table></body></html>`;

  return sendResendEmail({
    to: input.to,
    subject,
    text,
    html,
    idempotencyKey: input.idempotencyKey,
  });
}
