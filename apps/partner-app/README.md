# INSUREIT Partner

Separate Expo application for Partner/POSP/MISP and authorized commercial employee users.

## Environment

Set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

The app never uses a service-role key.

## Current foundation

- separate Android/iOS package identity: `com.insureit.partner`
- persistent Supabase session
- secure native session storage through Expo SecureStore
- authenticated Partner identity bootstrap
- first-login intermediary activation contract
- server-authorized commercial scope bootstrap
- fail-closed access-denied state

No EAS project ID, update channel, store signing configuration or production release channel is committed yet. Those are created only when the Partner app foundation is approved for preview builds.
