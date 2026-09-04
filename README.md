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

### 4. Set up Stripe (subscription billing)

1. Fill in `STRIPE_SECRET_KEY` in `.env.local` (test-mode key from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys))
2. Run `npm run stripe:setup` — creates the Steward/Naturalist/Conservationist Products+Prices in your Stripe account (idempotent, safe to re-run) and prints 3 price IDs to paste into `.env.local` as `STRIPE_PRICE_STEWARD`, `STRIPE_PRICE_NATURALIST`, `STRIPE_PRICE_CONSERVATIONIST`
3. To receive webhook events locally, install the [Stripe CLI](https://docs.stripe.com/stripe-cli), run `stripe login`, then in a separate terminal:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Paste the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` in `.env.local` and restart `npm run dev`.

Without this, `/upgrade` will still render, but clicking a paid plan will fail at checkout creation.

### 5. Start the dev server
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
| `STRIPE_SECRET_KEY` | `sk_live_...` | [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Same page |
| `STRIPE_PRICE_STEWARD` / `STRIPE_PRICE_NATURALIST` / `STRIPE_PRICE_CONSERVATIONIST` | `price_...` | Run `npm run stripe:setup` against your live key (or reuse the test-mode IDs if still testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | See below — created per-environment, not reused from local dev |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |

Run `npx drizzle-kit push` once against your Neon `DATABASE_URL` to create the `properties`, `plans`, `tasks`, and `subscriptions` tables before the first deploy.

**Production Stripe webhook:** in the Stripe Dashboard → **Developers → Webhooks → Add endpoint**, use `https://your-app.vercel.app/api/stripe/webhook` and subscribe to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` in Vercel — it's different from the one the Stripe CLI gives you for local dev.

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
    set-tier/route.ts               # Dev-only tier switch (blocked in production — see Known limitations)
    stripe/
      checkout/route.ts             # Creates a Stripe Checkout session for a first paid subscription
      subscription/route.ts         # GET billing status; PATCH switch tier; DELETE schedule downgrade; PUT resume
      portal/route.ts                # Creates a Stripe Billing Portal session
      webhook/route.ts               # Stripe webhook — syncs subscriptions table + Clerk tier metadata

components/
  PropertyMap.tsx                   # Mapbox GL satellite map with parcel boundary overlay
  DashboardMap.tsx                  # Dashboard property map view
  DrawablePropertyMap.tsx           # Manual boundary drawing when Regrid has no match
  ParcelConfirmMap.tsx              # Parcel confirmation step in onboarding
  GeneratingOverlay.tsx             # Animated progress overlay during AI generation

lib/
  claude.ts                         # All Claude API prompt logic (analyze + plan generation)
  satellite.ts                      # Mapbox Static Images fetch for satellite imagery
  store.tsx                         # React context; property/plan data fetched from the DB, tier from Clerk
  stripe.ts                         # Lazy Stripe client + tier <-> price id lookups
  db/
    client.ts                       # Lazy Drizzle/Neon client
    schema.ts                       # properties, plans, tasks, subscriptions tables
    ownership.ts                    # Per-user property/task ownership checks
    subscriptions.ts                # Per-user subscription row lookups/upserts

scripts/
  stripe-setup.ts                   # One-off: creates Stripe Products/Prices (npm run stripe:setup)

middleware.ts                       # Clerk route protection — all pages + /api/* except /api/stripe/webhook

types/
  index.ts                          # Shared TypeScript types
```

> **Known limitations:**
> - `/api/set-tier` is a developer convenience for testing tier-gated features locally without going through Stripe Checkout; it returns 403 when `NODE_ENV=production`.
> - Tier-based limits (property count, AI plan depth, feature locks) are enforced client-side and at AI-prompt time, not re-verified server-side against the caller's actual `subscriptions` row on every request. Billing itself is real — a user's `tier` accurately reflects what they paid for — but a motivated user hitting the API directly could currently claim a higher tier than they have. Hardening this is a follow-up, not yet done.

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
- [x] Stripe subscription billing (Checkout, plan switching, scheduled downgrade to Free, Billing Portal, webhook sync)
- [ ] Monthly plan regeneration (Naturalist tier)
- [ ] Weekly checklist + seed/nesting recommendations (Pro tier)

---

> Every acre managed well is a net gain for the planet.
