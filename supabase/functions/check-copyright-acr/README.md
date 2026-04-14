# check-copyright-acr

Supabase Edge Function that uses ACRCloud to identify uploaded audio. If the file matches a known commercial recording (score ≥ 80), the function deletes it from storage and returns `{ copyrighted: true, reason }` so the client can alert the user.

## Secrets (Supabase)

Set these in the Supabase Dashboard (**Project Settings → Edge Functions → Secrets**) or via CLI:

```bash
supabase secrets set ACR_CLOUD_HOST=identify-xx-x.acrcloud.com
supabase secrets set ACR_CLOUD_ACCESS_KEY=your_access_key
supabase secrets set ACR_CLOUD_ACCESS_SECRET=your_access_secret
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

## Deploy

```bash
supabase functions deploy check-copyright-acr
```

## Request

- **Method:** POST  
- **Headers:** `Authorization: Bearer <user JWT>` (required)  
- **Body:** `{ "bucket": "music-files", "path": "audio-files/user-id/123-file.mp3" }`

## Response

- `{ "copyrighted": false }` – no match; file remains in storage.
- `{ "copyrighted": true, "reason": "...", "deleted": true }` – match found; file removed from storage.
