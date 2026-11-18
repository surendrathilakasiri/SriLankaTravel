# Website operations

## Hosting

The Vercel project `surendra-koththigodas-projects/sri-lanka-travel` serves the website and every `/api/*` endpoint. The custom domain stays on Vercel. No proxy, form action, or runtime call depends on Netlify.

`npm run build` creates `dist/` from the explicit page list and referenced assets only. Vercel publishes that directory and separately bundles the functions in `api/`. Shared server code lives in `lib/`, outside public output and the API routing directory. Personal receipts, screenshots, tests and server source are excluded from static output.

`netlify.toml` only prevents future Git-triggered builds on the retired host. The three historical Netlify Forms messages were copied into the private Vercel contacts collection on 17 November 2026 with their original timestamps. The original records and old deployments are retained as rollback/archive copies; do not delete them casually. Old deployment snapshots and Git history may still contain previously published files.

## Services and settings

- Planner: `OPENAI_API_KEY` and optional `OPENAI_MODEL` in Vercel.
- Private messages and community records: Vercel Blob **private** store, connected to the project. `BLOB_STORE_ID` is configured automatically. The SDK uses Vercel's short-lived OIDC authentication; no new long-lived storage key is needed. `BLOB_READ_WRITE_TOKEN` is supported for local development only if supplied securely.
- Administration: existing `UPDATE_ADMIN_TOKEN`, sent only as the `x-admin-token` header. Visit `/admin-contacts.html` for messages or `/admin-updates.html` for moderation. The token is never saved in browser storage. Private APIs return `Cache-Control: private, no-store`.
- Optional contact notifications: `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` on a verified Resend domain, and `CONTACT_TO_EMAIL` (defaults to the owner's existing Gmail address). Save these in Vercel Production and redeploy to activate changed environment variables. Notifications are sent only after the message has been stored. A failed email does not lose the message; check the private inbox.
- News: optional `LIVE_FEED_SOURCES`. A source outage must not clear other successfully loaded content. News is not an official advisory.
- Legacy Supabase settings are no longer used for new data. Keep them until any historical records have been exported and checked; do not delete an old database as part of deployment.

## Contact and data handling

The form posts to `/api/contact` on the current origin, including without JavaScript. The server validates inputs and confirms success only after a durable private save. JavaScript retries use the same submission reference to avoid duplicate records and notifications. The no-JavaScript path redirects to `/contact.html?sent=1`. Messages are stored as individual private JSON records under `contacts/`. The inbox lists 20 at a time, newest first.

The built-in per-instance contact throttle is a best-effort safeguard, not a distributed rate limiter. For high traffic or active spam, add a Vercel Firewall rate rule for POST `/api/contact` and `/api/update-submissions` and monitor usage. Blob is suitable for this small inbox and moderation queue; large-scale filtering should move to an indexed database. Community records are private under `updates/`; only approved, allowlisted fields appear publicly. Removal is a soft delete. Editing uses ETags to avoid overwriting concurrent moderation changes.

## Verification

Run `npm test`, `npm run build`, and `npm run check:site` before deployment. `npm run monitor` checks the live public pages, feeds, validation and admin authorization without sending emails or invoking the AI model. GitHub Actions runs the build checks on main and read-only production checks every six hours. Failure notifications depend on GitHub notification preferences.

The Blob SDK's CLI configuration dependency pins an affected Zod version; a compatible v4 override selects the patched release. Keep this override until the upstream dependency is updated.

## Source handling

Destination guides and entry guidance carry editorial dates and source links. Suggested stay lengths and transport times are estimates; verify attraction tariffs with the official provider. Excluding personal documents from current deployments does not erase historical Git or deployment copies. Handle historical cleanup separately, preserving a private backup.
