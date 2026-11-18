# Travel updates on Vercel

All update endpoints run as Vercel Functions:
- `GET /api/live-data`: approved community records, public fields only
- `GET /api/trusted-feed`: recent news, resilient to an individual source outage
- `POST /api/update-submissions`: save a pending update in private Vercel Blob storage
- `GET/PATCH/DELETE /api/admin/updates`: authenticated moderation using `UPDATE_ADMIN_TOKEN`

Connect the private Vercel Blob store to the project and redeploy. `BLOB_STORE_ID` and Vercel OIDC authenticate storage access. No Supabase or Netlify runtime is required. Unconfigured storage rejects new submissions rather than pretending to save them.

Community updates start as pending. Use `/admin-updates.html` to approve or reject them. Contributor emails are excluded from public responses. Removal archives the record with `status: deleted`.

For contact messages, use `/admin-contacts.html`. See `OPERATIONS.md` for notifications and deployment checks. Preserve any legacy Supabase or Netlify records until they have been exported and verified.
