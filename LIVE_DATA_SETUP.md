# Live Data Setup (Phase B.1)

This project now supports a moderated live updates workflow:

1. Public submit form: `submit-update.html`
2. Admin moderation: `admin-updates.html`
3. Approved feed: `live-updates.html`

## Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `UPDATE_ADMIN_TOKEN` (required for moderation API)
- `SUPABASE_URL` (optional but recommended)
- `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)

If Supabase variables are not set, the API uses an in-memory fallback (non-persistent).

## Supabase Table SQL

Run this SQL in Supabase SQL Editor:

```sql
create table if not exists public.community_updates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('taxi-fee','hotel-price','place','event')),
  city text not null,
  title text not null,
  details text not null,
  price_info text,
  event_start date,
  event_end date,
  source_url text,
  submitter_email text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists idx_community_updates_status_created
  on public.community_updates(status, created_at desc);
```

## API Routes

- `POST /api/update-submissions` -> create pending update
- `GET /api/live-data` -> list approved updates
- `GET /api/admin/updates` -> list pending updates (admin token required)
- `PATCH /api/admin/updates` -> approve/reject update (admin token required)

## Moderation Flow

1. Open `/submit-update.html` and submit an update.
2. Open `/admin-updates.html`, enter `UPDATE_ADMIN_TOKEN`, load queue.
3. Approve/reject each item.
4. Approved items appear on `/live-updates.html`.
