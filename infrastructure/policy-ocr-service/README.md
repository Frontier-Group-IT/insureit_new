# INSUREIT Policy OCR service (test)

This service runs PaddleOCR PP-StructureV3 outside the Next.js application and returns reviewable fields for the Policy Onboarding page.

## Run locally

```bash
docker build -t insureit-policy-ocr .
docker run --rm -p 8000:8000 \
  -e POLICY_OCR_SERVICE_SECRET='replace-with-a-long-random-secret' \
  insureit-policy-ocr
```

Health check:

```bash
curl http://localhost:8000/health
```

Test extraction:

```bash
curl -X POST http://localhost:8000/v1/policy/extract \
  -H 'Authorization: Bearer replace-with-a-long-random-secret' \
  -F 'schema=indian_motor_policy_v1' \
  -F 'file=@sample-policy.pdf'
```

## Portal environment variables

Configure these server-only variables in the web portal environment:

```text
POLICY_OCR_SERVICE_URL=https://your-private-or-protected-ocr-host
POLICY_OCR_SERVICE_SECRET=the-same-long-random-secret
```

Never prefix the secret with `NEXT_PUBLIC_`.

## Test scope

The first version extracts a restricted Indian motor-policy schema using PP-StructureV3 text/layout extraction followed by deterministic field patterns. It does not save OCR output directly. The user must review and select values before applying them to the onboarding form.

Before production use:

1. Benchmark with representative policies from every major insurer.
2. Replace generic confidence values with token/field evidence from the model output.
3. Add insurer aliases and policy-specific layouts.
4. Store extraction audit records and reviewer decisions.
5. Add malware scanning, page limits, rate limiting and document retention rules.
6. Deploy behind HTTPS and restrict network access where practical.
