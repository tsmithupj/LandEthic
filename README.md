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
```

The app works with just Clerk + Anthropic keys. Mapbox and Regrid degrade gracefully to placeholders.

> **Note:** The Clerk routing variables in `.env.example` can be left as-is — they point to `/sign-in`, `/sign-up`, `/dashboard`, and `/onboarding` which are already set up in the app.

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
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |

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
  upgrade/page.tsx                  # Subscription tier comparison
  api/
    parcel-lookup/route.ts          # Regrid parcel boundary lookup
    analyze-property/route.ts       # Claude AI property analysis
    generate-plan/route.ts          # Claude AI action plan generation

components/
  PropertyMap.tsx                   # Mapbox GL satellite map with parcel boundary overlay

lib/
  claude.ts                         # All Claude API prompt logic (analyze + plan generation)
  store.tsx                         # React context + localStorage (scoped per Clerk user ID)

middleware.ts                       # Clerk route protection (/onboarding, /dashboard)

types/
  index.ts                          # Shared TypeScript types
```

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
- [ ] Database to persist properties + plans (Postgres via Neon or Supabase)
- [ ] Real Regrid parcel lookup replacing mock boundary
- [ ] Ground-level photo upload + Claude vision analysis (Steward tier)
- [ ] Stripe subscription billing
- [ ] Monthly plan regeneration (Naturalist tier)
- [ ] Weekly checklist + seed/nesting recommendations (Pro tier)

---

> Every acre managed well is a net gain for the planet.
