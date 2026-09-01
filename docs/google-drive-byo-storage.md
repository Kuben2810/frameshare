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
  actions. Refresh tokens never reach the browser. A short-lived access token
  is returned to the authenticated owner for Google Picker and, only after a
  gallery-access check plus quota reservation, to an authenticated uploader to
  complete that gallery's Drive resumable session directly from the browser.
- Verifies that the selected folder is active and lets Frameshare add files
  before marking the connection active.

An active connection does not change any existing gallery. A workspace owner
can make the verified connection the default for **future** galleries; their
originals and generated variants then stay in the selected Drive folder. The
existing private Frameshare asset and download routes authorize each request
before reading the corresponding Drive file.

Original uploads start a Google Drive resumable session and go directly from
the photographer's browser to Google. This avoids Vercel Functions' 4.5 MB
request-body limit while retaining the product's 100 MB photo limit. Generated
previews, watermarked files, edits, downloads, and deletion use the same
gallery's immutable storage connection. Frameshare refuses to disconnect Drive
while a gallery is assigned to it, preventing an orphaned gallery. If a direct
upload or processing step fails, the browser asks Frameshare to release its
still-pending quota reservation immediately.

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
6. Copy the Google Cloud **project number** into
   `NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID`. This is a public Picker app identifier,
   not an OAuth secret, and is required for `drive.file` folder selection.
7. Generate a dedicated encryption key with `openssl rand -base64 32`. Keep it
   in the hosting platform's secret store, never in source control.
8. Set the following in local and Vercel environments:

   ```dotenv
   GOOGLE_DRIVE_OAUTH_CLIENT_ID=
   GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=
   GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://<production-domain>/api/storage/google-drive/callback
   NEXT_PUBLIC_GOOGLE_DRIVE_PICKER_API_KEY=
   NEXT_PUBLIC_GOOGLE_DRIVE_APP_ID=<google-cloud-project-number>
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

## Operational limitation

Photo processing still runs from the upload request, as it does for
Frameshare-managed storage. Before production Drive rollout, move processing,
ZIP generation, cleanup, and retry handling to the durable job system described
in `handoff.md`. A failed or abandoned Drive resumable session must be retried
or cancelled by the photographer; Google expires unused session URLs after a
week.
