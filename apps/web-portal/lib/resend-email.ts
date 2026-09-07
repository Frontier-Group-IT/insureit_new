import "server-only";

type ResendEmailInput = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
};

type ResendEmailResult = {
  id: string;
};

export async function sendResendEmail(input: ResendEmailInput): Promise<ResendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    throw new Error("resend_configuration_missing");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as { id?: unknown } | null;
  if (!response.ok || typeof body?.id !== "string" || !body.id) {
    throw new Error(`resend_request_failed:${response.status}`);
  }
  return { id: body.id };
}
