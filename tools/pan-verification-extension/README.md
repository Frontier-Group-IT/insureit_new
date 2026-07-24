# IIB POS PAN Checker - N.M. browser extension

This Manifest V3 extension processes InsureIt POSP/MISP PAN verification jobs directly inside Chrome or Microsoft Edge. It removes the need to keep the PySide/Playwright desktop application running.

## What it stores locally

The following values are intentionally stored in `chrome.storage.local` on the authorised office computer:

- InsureIt deployment URL
- `PAN_VERIFICATION_WORKER_KEY`
- IIB POS user ID
- IIB POS password
- device name and batch size

These values are not rendered in the InsureIt website and are not included in PAN result messages. Anyone with administrative access to the Windows browser profile may be able to inspect extension storage, so use this only on the secured internal computer approved for IIB processing.

## Install in Chrome

1. Download or clone this branch.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder:

   `tools/pan-verification-extension`

6. Pin **IIB POS PAN Checker - N.M.** to the browser toolbar.

## Install in Microsoft Edge

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select `tools/pan-verification-extension`.
5. Pin the extension.

## First-time configuration

Open the extension popup and enter:

- **InsureIt URL** — the deployed preview or production URL without a trailing slash
- **Worker key** — exactly the same `PAN_VERIFICATION_WORKER_KEY` configured in Vercel
- **IIB user ID**
- **IIB password**
- **Device name** — for example `N.M. Checker - Accounts PC`
- **Batch size** — default `20`

Click **Save settings**.

## Run the workflow

1. Queue PAN verification from a POSP/MISP application in InsureIt.
2. Click the extension icon.
3. Click **Start checking**.
4. The extension opens or activates `https://pos.iib.gov.in/`.
5. It fills the saved IIB user ID and password.
6. Enter CAPTCHA manually and click the website Submit button.
7. The extension opens POSQuery and checks queued PANs automatically.
8. It waits 2.5 seconds between PAN queries.
9. Results are sent to InsureIt and the application verification card updates automatically.

## Result behaviour

- `No Data Found In POS System` becomes `not_found` and unlocks **Start IIB Processing**.
- `Matching Record Found In DataBase` becomes `matched` and keeps the onboarding application blocked for review.
- Invalid PAN becomes `invalid`.
- Portal timeout, session expiry, network failure or missing controls becomes `failed` and can be retried from InsureIt.

## Floating status panel

A compact panel is injected into the IIB website and displays:

- current masked PAN
- live status
- processed count
- running or paused state
- progress indicator

The panel can be minimised using the `−` button.

## Pause, resume and stop

Use the extension popup:

- **Pause** finishes no new PAN until resumed.
- **Resume** continues the existing claimed queue.
- **Stop** clears the local active queue and stops automation. Already claimed but unfinished jobs remain `checking`; during testing, complete or reset those rows before starting another worker.

## Important test notes

- After first loading or updating the extension, reload any already-open IIB POS tab so the content script is injected.
- The extension never reads or solves CAPTCHA.
- Keep only one active checker device during the first end-to-end test.
- Use the Vercel deployment URL for the same branch that contains the worker endpoints.
- Apply `supabase/migrations/20260724193000_add_pan_verification_queue.sql` before testing.

## Files

- `manifest.json` — extension permissions and entry points
- `background.js` — queue API calls and runtime state
- `content.js` — IIB page automation and floating status panel
- `popup.html`, `popup.css`, `popup.js` — settings and run controls
