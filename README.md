# Sukoon

A session companion for licensed psychologists and clinics. Clinicians sign in with an access key, pick a track (Kids, Teens, Adults, Seniors), and run an interactive check-in or scenario activity with a client on a laptop, tablet or phone. They then get a provisional summary to guide their own questions.

Sukoon does not diagnose. All content is **draft** until a licensed psychologist reviews it, and all score bands are **provisional**.

## Quick start

```bash
npm install
node scripts/keygen.mjs          # prints a clinician key; copy it into .env
cp .env.example .env             # then set CLINICIAN_KEYS=<key>
npm run dev                      # http://localhost:3000
```

Without `CLINICIAN_KEYS`, development mode uses a built-in dev key (shown in the server log). Production refuses to start without real keys.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Server with reload |
| `npm run check` | Typecheck, lint, tests, content validation |
| `npm run validate:content` | Validate every pack and reference |
| `npm run build && npm start` | Production build and run |
| `npm run keygen` | Generate a clinician access key |

## Deploy to Railway

1. Push this folder to a GitHub repository.
2. In Railway: New Project, Deploy from GitHub repo. Railway uses the `Dockerfile` and `railway.json`.
3. Set variables: `NODE_ENV=production` and either `OPEN_ACCESS=true` or `CLINICIAN_KEYS=<key1>,<key2>` (16+ characters each).
4. Generate a domain under Settings, Networking. Open it and sign in with a key.

Sessions live in memory and are erased after `SESSION_TTL_HOURS` (default 24) or on restart. This is deliberate: no patient data sits in a database. See `docs/ARCHITECTURE.md` before changing it.

## Deploy to Vercel

Cautions: Vercel is serverless, so memory sessions do not work. Use `STORE_DRIVER=redis`. Answers are then stored in Upstash Redis until their TTL ends (default 24 h), so check consent and data terms with your clients first. Rate limiting is per instance on Vercel, so it is weaker than on Railway.

1. Push this folder to GitHub and import it in Vercel (Framework Preset: Other). `vercel.json` sets the build and routes.
2. Add Upstash Redis from Vercel, Storage (Marketplace). It injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Set environment variables: `NODE_ENV=production`, `STORE_DRIVER=redis`, `OPEN_ACCESS=true` (or `CLINICIAN_KEYS=<key1>,<key2>`), `SESSION_TTL_HOURS=24`.
4. Deploy, open the URL and sign in. `GET /ready` should return `ready`.

## Access: no key, or keys

By default Sukoon needs an access key. For an open, welcome-and-start experience set `OPEN_ACCESS=true` and no key is asked. Anyone with the link can then run sessions, and sessions still erase themselves after the retention period. Keep the link private, or leave `OPEN_ACCESS` off and use `CLINICIAN_KEYS`.

## Documentation

- `docs/ARCHITECTURE.md` pillars, request flow, privacy and security, extension points
- `docs/CONTENT_GUIDE.md` how to write and review packs
- `docs/AI_PILLAR.md` how to add RAG, LangChain.js and RAGAS later

## Before using with patients

1. Have a licensed psychologist review every pack and set `"status": "reviewed"` only after sign-off.
2. Verify references marked `verified: false` in `content/references.json`.
3. Agree a clinical protocol for the safety item (it raises a flag; it does not assess risk).
4. Decide data retention and consent wording with your clients and legal adviser.

## SaaS mode (institutes and accounts)

Set `SAAS_MODE=true`, `AUTH_SECRET` (32+ chars) and `ADMIN_KEY` (16+ chars), keep `STORE_DRIVER=redis`, and set `OPEN_ACCESS=false`.

- Open `/#/admin`, enter the admin key, and create an institute. You get an invite code to share with that institute.
- Psychologists open the site, choose "I have an invite code", and create their own account (email and password).
- Each institute has a plan (free pilot or paid), a monthly session cap, an optional end date, and can be paused. These are enforced when a session starts.
- Sessions belong to the psychologist who started them. Other psychologists and other institutes cannot open them.
- Accounts are stored in the same Redis database (no expiry). For long-term growth, plan a move to Postgres behind the `KvStore` port.
