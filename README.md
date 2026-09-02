# Kalinga

Kalinga is an offline-first teacher assistant prototype for multigrade classrooms. It combines class and learner management, date-specific attendance, ILAW lesson planning, shared resources, and Gabay—a page-aware Taglish teaching guide.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The interface and local Gabay guidance work even before the backend values are added.

## Supabase setup

Create a Supabase project, then copy its Project URL and publishable key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never place the Supabase service-role key in the browser environment or commit it to Git.

Link this repository to the project and apply the schema:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

The migration creates teacher-owned profiles, classes, learners, lesson plans, attendance, resources, a private resource bucket, and row-level security policies. Each authenticated teacher can access only their own classroom records; only explicitly shared resource metadata is readable by other teachers.

## Groq-powered Gabay

Gabay calls Groq only through a Supabase Edge Function, so the Groq key is never shipped to the browser. Add the secret and the allowed web origins:

```bash
npx supabase secrets set GROQ_API_KEY=YOUR_GROQ_KEY
npx supabase secrets set GROQ_MODEL=openai/gpt-oss-20b
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-domain.vercel.app
npx supabase functions deploy gabay-chat
```

Connected Gabay requires a valid Supabase user session. Prototype mode does not call the AI service or expose the secret.

The AI receives only the recent chat and minimal classroom context: current screen, grade levels, subject, lesson topic, and connection state. Saved learner names, reference numbers, attendance statuses, and notes are deliberately excluded.

## Vercel

Add these two values to the Vercel project’s Environment Variables and redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Keep `GROQ_API_KEY` in Supabase Edge Function secrets, not Vercel’s public environment and never in source control.

## Verification

```bash
npm run lint
npm run build
```
