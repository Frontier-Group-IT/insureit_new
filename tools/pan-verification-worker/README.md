# N.M. PAN verification worker integration

This folder defines the website protocol used by `IIB_POS_PAN_Checker - (N_M)` in InsureIt Connected Mode.

## Website environment

Set a long random secret in the web portal environment:

```env
PAN_VERIFICATION_WORKER_KEY=replace-with-a-long-random-secret
```

Store the same value in Windows Credential Manager for the N.M. desktop application. Do not hardcode it in the website frontend or distribute it in Excel files.

## Workflow

1. An authorised onboarding reviewer queues PAN verification from the POSP/MISP application.
2. The desktop checker calls `POST /api/internal/pan-verification/claim`.
3. The API atomically marks jobs as `checking` and returns PAN numbers.
4. The checker opens the authorised IIB POS browser session and performs the query.
5. The checker reports the result to `POST /api/internal/pan-verification/complete`.
6. The application card displays the result and allows IIB processing only when the result is `not_found`.

## Claim request

```json
{
  "limit": 20,
  "device": "N.M. Checker - Accounts PC"
}
```

Required header:

```text
x-pan-worker-key: <secret>
```

## Completion statuses

- `matched` — Matching Record Found In DataBase
- `not_found` — No Data Found In POS System
- `invalid` — PAN format is invalid
- `failed` — browser, portal, session, or network failure

## Desktop integration

`insureit_client.py` provides a small typed Python client. Add `requests` to the desktop software dependencies and configure:

- InsureIt deployment URL
- worker key from Windows Credential Manager
- a readable device name

The desktop application should retain its existing CAPTCHA and browser controls. Connected Mode replaces Excel upload with claimed InsureIt jobs; Excel Mode can remain available separately.
