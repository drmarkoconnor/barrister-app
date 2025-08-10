Project Requirements Framework — Barrister Case Management App 1 — Problem
Statement A private, single-user web application for a criminal barrister to:

Track cases, contacts, expenses, income, press mentions, and documents.

Securely upload/download files.

Use audio transcription to turn spoken notes into structured todos.

Generate chambers-style case summaries (“Mark O’Connor secured an acquittal…”).

Access important legal reference links.

Built with Eleventy (static frontend), Bootstrap 5 (UI), Supabase (backend
DB/auth/storage).

Hosted on Netlify with serverless functions for all dynamic logic.

Mobile-first, finger-friendly UI with large action buttons.

2 — Core Features (MVP → v2) MVP Auth: Single-user password login
(email+password), session management, logout.

Cases: CRUD with details (title, client, court, status, dates, fees, linked
docs).

Expenses & Income: Ledger with categories, VAT flag, CSV export.

Contacts: CRUD, tags, roles (client, solicitor, judge, journalist).

Documents: Upload/download, virus scan, linked to cases.

Press Mentions: Manual entry + RSS ingestion with keyword match.

Dashboard: “Action hub” big button layout for mobile.

Search/Filter: Across all entities with facets.

Exports: CSV/JSON; printable case briefs.

Backups: Nightly DB & storage snapshots.

v1.1 Calendar views (hearings, deadlines).

CSV import.

Global search (Ctrl+K).

Printable case brief.

v1.2 Invoicing module.

Advanced reports.

Optional OCR for scanned docs.

Optional 2FA.

3 — Non-Functional Requirements Privacy: GDPR-compliant, client confidentiality,
retention policy.

Security: All DB writes via functions; RLS in Supabase.

Performance: Static pages + lazy data fetch.

Reliability: Scheduled backups + restore tests.

Maintainability: Clean repo, env-based config, typed APIs even if JS.

4 — Proposed Stack Frontend: Eleventy + Nunjucks templates + Bootstrap 5.

Hosting: Netlify.

API layer: Netlify Functions (Node 18/20).

DB/Auth/Storage: Supabase (Postgres, RLS, buckets).

Search: Postgres full-text.

Validation: Zod or Vest in serverless functions.

Logging: Sentry (browser + serverless).

Testing: Vitest + Playwright.

5 — Data Model Entities User — id, email, password_hash (if custom auth).

Case — id, title, client, matter_ref, court, status, stage, hearing_dates[],
outcome, fees, notes.

CaseParty — case_id, contact_id, role.

Document — id, case_id?, contact_id?, file_key, filename, mime, size, checksum,
uploaded_by.

Expense — id, date, description, category, amount_gross, vat_rate, case_id?,
receipt_document_id?.

Income — id, date, description, amount_gross, vat_rate, case_id?, paid,
invoice_ref.

Contact — id, type, name, email, phone, address, tags[].

PressMention — id, source, url, date, title, summary, keywords[], case_id?,
note.

Transcript — id, case_id?, text, provider, confidence, duration_s.

Todo — id, case_id?, title, due_at?, status, source.

ChambersNote — id, case_id, text, status (draft|approved|sent).

6 — Security Architecture Auth: Single user; everything behind HttpOnly, Secure
cookies.

DB Access: Supabase RLS (user_id = auth.uid()).

Uploads: Through serverless functions only, AV scan, signed URLs.

Secrets: Netlify env vars.

Backups: Nightly pg_dump + storage manifest; weekly restore test.

7 — Eleventy Structure bash Copy Edit /src /\_data /\_includes /layouts
/partials /assets /pages /app /functions /scripts /docs 8 — UI Kit & Design
Framework: Bootstrap 5 (mobile-first grid, utility classes).

Icons: Bootstrap Icons.

Charting: Chart.js.

Accessibility: WAI-ARIA, high contrast, keyboard nav.

Mobile UX: Large tappable action buttons; bottom action bar; one-hand use.

9 — Dev Workflow Node LTS + npm.

ESLint + Prettier.

.env.local for dev, Netlify env for prod.

Git: main + feature branches.

Supabase SQL migrations in repo.

Faker.js for seed data.

10 — Integration Points Calendar export (.ics).

Email send for invoices/notes.

OCR later (Tesseract).

Press mentions: RSS fetch + keyword match.

11 — Legal & Privacy ICO registration if required.

Retention per BSB guidance.

Subject Access Request & erasure endpoints.

TLS + storage encryption.

Embed legal reference links (see below).

12 — Backups & DR Nightly DB + storage backups to private bucket.

Weekly restore test.

One-click “export all” zip for user.

13 — Observability Sentry for client + server errors.

Netlify deploy notifications.

Audit log for CRUD on Cases, Docs, Expenses.

14 — Roadmap MVP: 2–3 weeks → Auth, Cases, Contacts, Expenses, Docs, basic
dashboard, RSS ingest, backups.

v1.1: Calendar, CSV import/export, better search, printable briefs.

v1.2: Invoicing, OCR, 2FA.

15 — Streaming Transcription Feature Frontend: Uses Web Audio API +
MediaRecorder to capture mic audio chunks, sends via WebSocket to
/api-transcribe-stream.

Backend: Netlify Edge Function upgrades WS, streams chunks to OpenAI Whisper
Realtime API, returns partial transcripts live.

After stop: Sends transcript to /api-summarise for GPT-based summary →
todos/entities saved in Supabase.

UI: Bootstrap modal with large mic button, live transcript area, “Send to
Summariser” action.

16 — Chambers News Snippet Generator On closed case: button generates short
third-person blurb.

Template: “Mark O’Connor secured an acquittal in R v Smith at Bristol Crown
Court on 5 Aug 2025.”

Optional: copy to clipboard, email to chambers admin.

17 — Legal Reference Links Embedded searchable reference drawer with:

BSB Handbook

Bar Council GDPR/data retention

CPS guidance + Code

Sentencing Council

Criminal Procedure Rules

HMCTS

BAILII databases

18 — Docs Sources JSON docs/docs.sources.json contains machine-readable list of
doc URLs:

Eleventy: https://www.11ty.dev/docs/

Netlify Functions: https://docs.netlify.com/build/functions/overview/

Supabase: https://supabase.com/docs

Bootstrap: https://getbootstrap.com/docs/5.3/

Whisper: https://platform.openai.com/docs/guides/speech-to-text

Plus Chart.js, Sentry, and UK legal refs.
