# Website operations

## Public files

`npm run build` creates `dist/` from the explicit page list in `scripts/build.mjs` and only referenced CSS, JavaScript and image assets. Netlify and Vercel publish that directory. PDF receipts, screenshots, source API modules, tests and credentials are excluded. Personal local files are not deleted by the build.

Run `npm test`, `npm run build`, and `npm run check:site` before deployment. GitHub Actions runs these on main and performs read-only production smoke checks every six hours. Review failed workflow runs; notification delivery depends on the owner's GitHub notification preferences. Scheduled checks do not submit contact messages or call the AI model.

## Hosting transition

Netlify is the backend for `/api/*`. `netlify.toml` maps routes to bundled functions. Vercel rewrites those requests to the Netlify site while it continues serving the custom domain. Its deployment excludes local API functions to prevent conflicting runtimes.

On 17 November 2026 the Netlify dashboard reported incomplete DNS propagation and an expired certificate for the custom domain. Do not remove the working Vercel domain until registrar DNS is verified and Netlify has issued a valid certificate. Complete the registrar migration using the exact records/nameservers shown in Netlify Domain management; verify HTTPS on apex and www before removing the transitional Vercel deployment.

## Data and secrets

- Itinerary: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, configured for Netlify Functions.
- Contact: Netlify Forms `contact`; notification recipient must confirm the email from Netlify. The old email function is retained for compatibility but the public form does not depend on it.
- Community updates: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `UPDATE_ADMIN_TOKEN`. Until persistent storage is configured, public reads are empty and new submissions are rejected with a contact-page alternative. No sample update is advertised as current.
- Trusted feed: optional `LIVE_FEED_SOURCES`. A source outage must not clear other successfully loaded content. Only recent items are listed; news is not an official advisory.

## Source handling

New destination guides and entry guidance carry editorial dates and source links. Suggested stay lengths and transport times are estimates; attraction tariffs should be checked at the official provider rather than copied indefinitely. Review seasonal and entry information before each content refresh.

Excluding personal documents from future deployments does not erase copies in historical Git commits or old deployment snapshots. Handle any historical cleanup separately, preserving a private backup and coordinating Git history changes with collaborators.
