# Google Drive BYO Storage setup

Frameshare connects Google Drive storage separately from Google sign-in. This
protects the photographer from accidental scope expansion on their normal login
connection and keeps storage refresh tokens outside Auth.js' `accounts` table.

## What the implementation does

- Requests only `https://www.googleapis.com/auth/drive.file`.
- Uses a Google Picker folder selection, so the photographer explicitly grants
  Frameshare access to the destination folder.
- Stores the Drive refresh token and short-lived access token in
  `storage_connections.credentials_ciphertext`, encrypted with AES-256-GCM.
- Requires a workspace owner for connect, select-folder, and disconnect
  actions. Refresh tokens never reach the browser; a short-lived access token
  is returned only to the authenticated owner while opening Google Picker.
- Verifies that the selected folder is active and lets Frameshare add files
  before marking the connection active.

An active connection does not change any existing gallery. Gallery media still
uses Frameshare-managed storage until the Drive media adapter supports the
complete upload, processing, delivery, download, and deletion lifecycle.

## Google Cloud configuration

1. Create a separate Google Cloud project or OAuth client for Frameshare
   storage; do not reuse `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` used for
   login.
2. Enable the Google Drive API and Google Picker API.
3. Configure the OAuth consent screen with the non-sensitive
   `drive.file` scope only. Add the production support email and authorized
   test users while the consent screen remains in testing.
4. Create a **Web application** OAuth client. Add each exact callback URL,
   including:

   - `http://localhost:3005/api/storage/google-drive/callback`
   - `https://<production-domain>/api/storage/google-drive/callback`

5. Create a browser API key for Google Picker. Restrict it to the Frameshare
   web origins and to the Google Picker API.
6. Generate a dedicated encryption key with `openssl rand -base64 32`. Keep it
   in the hosting platform's secret store, never in source control.
7. Set the following in local and Vercel environments:

   ```dotenv
   GOOGLE_DRIVE_OAUTH_CLIENT_ID=
   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=
   GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://<production-domain>/api/storage/google-drive/callback
   NEXT_PUBLIC_GOOGLE_DRIVE_PICKER_API_KEY=
   STORAGE_CREDENTIALS_KEY=
   STORAGE_OAUTH_STATE_SECRET=
   ```

`STORAGE_OAUTH_STATE_SECRET` is optional but should be a separate random secret
in production. It signs the ten-minute OAuth state value. `STORAGE_CREDENTIALS_KEY`
encrypts persisted credentials and must be a base64-encoded 32-byte value.

## Key rotation and revocation

- Before rotating `STORAGE_CREDENTIALS_KEY`, deploy code that can decrypt with
  both the old and new key versions, re-encrypt every connected record with the
  new key, then remove old-key support in a later deploy. Do not simply replace
  the environment value: that would make existing connections unreadable.
- Disconnecting a Drive connection immediately removes Frameshare's stored
  credentials and selected folder reference. Users may also revoke the app in
  their Google Account; the next connection check should then require a fresh
  authorization.
- Never write authorization codes, access tokens, refresh tokens, credentials
  ciphertext, or Picker tokens to logs, analytics, client props, or error URLs.

## Before enabling Drive gallery storage

The Drive media adapter must keep every gallery's storage assignment immutable
and implement resumable Drive uploads, Drive-backed originals and derivatives,
private client delivery, source deletion, quota reconciliation, and retryable
jobs. Do not switch `workspaces.storage_provider` to `google_drive` before that
adapter is complete; upload endpoints intentionally reject non-managed gallery
assignments today.
