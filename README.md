# Transworld Client Engagement

Internal tool for Transworld Investment & Securities Limited. One application,
two modules on a shared client directory:

1. **Contacts** — the shared directory (live)
2. **Greetings** — designed birthday/holiday emails (v1.1, next build)
3. **Documents** — upload, send for signing, client signature + TISL officer
   countersignature with an audit trail (v1.2)

Stack: Next.js 14 (App Router, JS) · Supabase (Postgres) · Resend · Vercel.

---

## Deploy (automated)

This zip is a complete, self-contained snapshot. The included `deploy.sh` does
everything except the two things that must be done by hand once: the database
schema (run in Supabase) and the Vercel environment variables (set in the
dashboard, since secrets should not live in a script).

### One-time, first deploy only

1. **Database** — in the Supabase SQL editor, run the schema from the chat (or
   `db/schema.sql`), then seed your admin user with the hash printed by
   `node scripts/hash-password.js "YourPassword"`.
2. **Vercel env vars** — Project ▸ Settings ▸ Environment Variables, all
   environments: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`,
   `RESEND_API_KEY`, `MAIL_FROM`, `NEXT_PUBLIC_APP_URL`.

### Every deploy

```
cp deploy.config.example deploy.config   # then fill in the blanks
chmod +x deploy.sh && ./deploy.sh
```

`deploy.sh` writes `.env.local`, installs, runs a production build to catch
errors early, then pushes a clean commit to GitHub — which triggers Vercel.
`deploy.config` and `.env.local` are gitignored and never pushed.

---

## CSV import format

Header row required. Recognized columns (case-insensitive):
`first_name, last_name, email, phone, date_of_birth, title, tags`.
Dates: `YYYY-MM-DD` or `DD/MM/YYYY`. Existing contacts are matched by email and
updated. Starter file: `sample-contacts.csv`.

## Permissions

View: anyone signed in. Add / edit / import: manager+. Delete: admin.

## Roadmap

- **v1.1 Greetings** — templates, automatic birthday sends (Vercel Cron), broadcasts
- **v1.2 Documents** — signing links, client + officer countersignature, certificate, audit trail
- **Later** — WhatsApp greetings after the WhatsApp Business Platform migration
