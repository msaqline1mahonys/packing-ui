# CLAUDE.md — packing-ui (frontend)

Guidance for agents working in this repo. Broader architecture is in the parent
`../CLAUDE.md`; this file is the **deployment / staging guardrails** — things that,
if changed carelessly, break the live staging UI. Read this before touching
`next.config.mjs`, `app/layout.jsx`, env handling, or anything that affects the
production build.

## How this gets deployed

- A **staging** UI runs on an EC2 box under **pm2** (`next start`, port 3010, behind
  Apache → ALB/HTTPS). It runs the **`staging`** branch and is **built on the server**.
- **Deploy is manual** (GitHub Actions workflows exist but are disabled): on the box,
  `git fetch && git reset --hard origin/staging` → `npm ci` → `npm run build` →
  `pm2 restart packing-ui`. Full steps: `../DEPLOYMENT.md`.
- Deploy is `reset --hard origin/staging`, so **don't rely on hand-edits on the
  server** and **keep `staging` building** — a build failure takes the UI down on the
  next pull (pm2 crash-loops if there's no successful build).

## Do NOT break these (each one has broken staging before)

1. **`next.config.mjs` → `images.remotePatterns`.** It must include the S3 bucket
   host **`packing-bucket.s3.ap-southeast-2.amazonaws.com`**. Removing it makes every
   uploaded image (e.g. site/print logos) return **400 from `/_next/image`**. If the
   bucket/region ever changes, update this entry — don't delete it.
2. **`app/layout.jsx` → `export const dynamic = "force-dynamic"`.** This is required:
   `useSearchParams` (used widely via `lib/hooks/use-auto-open-add-modal.js`) bails out
   of static prerender and **fails the production build app-wide** without it. Don't
   remove it.
3. **`NEXT_PUBLIC_API_URL`.** It is baked into the client bundle **at build time** from
   `.env` on the server (points at the API subdomain, not localhost). Don't hardcode a
   URL or assume the dev fallback in production builds.
4. **The build must pass.** Turbopack stops at the **first** error, so fix-and-rebuild
   iteratively and verify `npm run build` succeeds locally before pushing to `staging`.
   There is no test runner — a green build is the only gate.
5. **Don't introduce new state/form libraries** (Redux/Zustand/TanStack Query,
   react-hook-form, zod) or reach into `components/clutch-table/` internals — see the
   parent `../CLAUDE.md`. These aren't deploy-breakers but are project conventions.

## Branch model

- `master` = stable integration branch (work branches off it).
- `staging` = what the box deploys. Bring changes in via `master` → merge to
  `staging`. `staging` carries deploy-only commits on top of `master`.
