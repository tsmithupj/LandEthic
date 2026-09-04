# LandEthic.io

> AI-powered holistic land management for every landowner.

## What this is

A Next.js 14 web app that takes a property address, fetches parcel boundary data, runs it through Claude AI, and generates a personalized land management action plan — covering soil health, wildlife habitat, native plants, and more.

---

## Running locally

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Clerk (authentication)

LandEthic uses [Clerk](https://clerk.com) for sign-in/sign-up. It takes about 5 minutes to configure.

1. Go to [clerk.com](https://clerk.com) and create a free account
2. Click **Create application**
3. Name it `LandEthic` (or anything you like)
4. Enable **Google** and **Email** as sign-in methods → click **Create application**
5. You'll land on the API Keys page — you need two values:
   - **Publishable key** — starts with `pk_test_...`
   - **Secret key** — starts with `sk_test_...`

### 3. Set up environment variables
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in at minimum:
```
# Clerk — from Step 2 above
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Anthropic — from https://console.anthropic.com
ANTHROPIC_API_KEY=sk-ant-...

# Database — from https://neon.tech (free tier)
DATABASE_URL=postgresql://...
```

Mapbox and Regrid degrade gracefully to placeholders if omitted.

> **Note:** The Clerk routing variables in `.env.example` can be left as-is — they point to `/sign-in`, `/sign-up`, `/dashboard`, and `/onboarding` which are already set up in the app.

After setting `DATABASE_URL`, create the tables once with:
```bash
npx drizzle-kit push
```

### 4. Start the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Testing the auth flow:**
- Click **Get started free** on the landing page → creates account
- After sign-up, you'll land on `/onboarding` to enter your property
- After sign-in, you'll land on `/dashboard`
- The **UserButton** (top-right avatar) handles sign-out

---

## Deploying to Vercel (step by step)

### Step 1 — Push to GitHub
1. Go to [github.com/new](https://github.com/new) and create a new **private** repository named `landethic`
2. In this folder, run:
```bash
git init
git add .
git commit -m "Initial scaffold"
git remote add origin https://github.com/YOUR_USERNAME/landethic.git
git push -u origin main
```

### Step 2 — Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign up (free) with your GitHub account
2. Click **Add New → Project**
3. Import the `landethic` repository
4. Vercel auto-detects Next.js — click **Deploy** (it will fail on first deploy without env vars, that's expected)

### Step 3 — Add environment variables in Vercel
In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | [clerk.com](https://clerk.com) dashboard → API Keys |
| `CLERK_SECRET_KEY` | `sk_live_...` | [clerk.com](https://clerk.com) dashboard → API Keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | Copy as-is |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | Copy as-is |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/dashboard` | Copy as-is |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `/onboarding` | Copy as-is |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | [console.anthropic.com](https://console.anthropic.com) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.eyJ1...` | [account.mapbox.com](https://account.mapbox.com) |
| `REGRID_API_KEY` | *(from Regrid)* | [regrid.com/api](https://regrid.com/api) |
| `DATABASE_URL` | `postgresql://...` | [neon.tech](https://neon.tech) — create a project, copy the pooled connection string |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |

Run `npx drizzle-kit push` once against your Neon `DATABASE_URL` to create the `properties`, `plans`, `tasks`, and `subscriptions` tables before the first deploy.

> **Clerk production keys:** For `pk_test_` / `sk_test_` keys, Clerk will work on localhost and Vercel preview URLs. When you're ready to go live, switch to `pk_live_` / `sk_live_` keys from your Clerk dashboard (same app, just toggle the environment at top of the Clerk dashboard).

### Step 4 — Redeploy
In Vercel → **Deployments** → click the three dots on the latest → **Redeploy**.

Your app is now live. Every `git push` to `main` will auto-deploy.

---

## Project structure

```
app/
  page.tsx                          # Landing page (auth-aware nav)
  sign-in/[[...sign-in]]/page.tsx   # Clerk sign-in (branded)
  sign-up/[[...sign-up]]/page.tsx   # Clerk sign-up (branded)
  onboarding/page.tsx               # 4-step onboarding — protected
  dashboard/page.tsx                # Property dashboard + action plan — protected
  dashboard/task/[id]/page.tsx      # Task detail with impact score breakdown
  dashboard/species/page.tsx        # Ground-photo species ID + nearby species browser
  upgrade/page.tsx                  # Subscription tier comparison
  api/
    parcel-lookup/route.ts          # Regrid parcel boundary lookup
    analyze-property/route.ts       # Claude AI property analysis
    generate-plan/route.ts          # Claude AI action plan generation
    replace-task/route.ts           # Claude AI single-task swap
    task-chat/route.ts              # Claude AI chat scoped to one task
    identify-species/route.ts       # iNaturalist computer-vision species ID from a photo
    nearby-species/route.ts         # iNaturalist species observed near a location
    set-tier/route.ts               # Dev-only tier switch (no payment — see Known limitations)

components/
  PropertyMap.tsx                   # Mapbox GL satellite map with parcel boundary overlay
  DashboardMap.tsx                  # Dashboard property map view
  DrawablePropertyMap.tsx           # Manual boundary drawing when Regrid has no match
  ParcelConfirmMap.tsx              # Parcel confirmation step in onboarding
  GeneratingOverlay.tsx             # Animated progress overlay during AI generation

lib/
  claude.ts                         # All Claude API prompt logic (analyze + plan generation)
  satellite.ts                      # Mapbox Static Images fetch for satellite imagery
  store.tsx                         # React context + localStorage (scoped per Clerk user ID)

middleware.ts                       # Clerk route protection (/onboarding, /dashboard)

types/
  index.ts                          # Shared TypeScript types
```

> **Known limitation:** `/api/set-tier` is a developer convenience for testing tier-gated features locally; it is not wired to Stripe and should not be reachable in production.

---

## Key APIs

| Service | Purpose | Free tier? |
|---------|---------|------------|
| [Anthropic Claude](https://docs.anthropic.com) | Property analysis + plan generation | Pay per token (~$0.01/analysis) |
| [Mapbox](https://docs.mapbox.com) | Satellite map tiles | 50k loads/mo free |
| [Regrid](https://regrid.com/api) | Parcel boundary data | Limited free tier |
| [USDA Soil Survey](https://sdmdataaccess.sc.egov.usda.gov) | Soil composition by location | Free |
| [Stripe](https://stripe.com/docs) | Subscription billing | Free to set up |

---

## Next features to build

- [x] User authentication (Clerk — Google + Email)
- [x] Real Regrid parcel lookup + manual boundary drawing fallback
- [x] Ground-level photo ID + nearby species browser (iNaturalist)
- [x] Database to persist properties + plans (Postgres via Neon)
- [x] Auth check on all `/api/*` routes, not just `/onboarding` and `/dashboard` pages
- [ ] Stripe subscription billing (currently `/api/set-tier` sets tier with no payment — dev-only)
- [ ] Monthly plan regeneration (Naturalist tier)
- [ ] Weekly checklist + seed/nesting recommendations (Pro tier)

---

> Every acre managed well is a net gain for the planet.
