// One-off script to create the Stripe Products/Prices this app needs.
// Run with: npm run stripe:setup
//
// Idempotent — safe to re-run. Looks up existing prices by lookup_key before
// creating anything, so it won't create duplicates in your Stripe account.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';

// tsx doesn't auto-load .env.local the way Next.js does, so parse it by hand.
const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY is not set in .env.local');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-08-26.dahlia' });

const TIERS: { lookupKey: string; envVar: string; name: string; amountCents: number }[] = [
  { lookupKey: 'landethic_steward_monthly', envVar: 'STRIPE_PRICE_STEWARD', name: 'LandEthic Steward', amountCents: 999 },
  { lookupKey: 'landethic_naturalist_monthly', envVar: 'STRIPE_PRICE_NATURALIST', name: 'LandEthic Naturalist', amountCents: 1999 },
  { lookupKey: 'landethic_conservationist_monthly', envVar: 'STRIPE_PRICE_CONSERVATIONIST', name: 'LandEthic Conservationist', amountCents: 3999 },
];

async function main() {
  console.log('Setting up Stripe products/prices...\n');
  const results: string[] = [];

  for (const tier of TIERS) {
    const existing = await stripe.prices.list({ lookup_keys: [tier.lookupKey], limit: 1 });
    let price = existing.data[0];

    if (!price) {
      const product = await stripe.products.create({ name: tier.name });
      price = await stripe.prices.create({
        product: product.id,
        currency: 'usd',
        unit_amount: tier.amountCents,
        recurring: { interval: 'month' },
        lookup_key: tier.lookupKey,
      });
      console.log(`Created ${tier.name}: ${price.id}`);
    } else {
      console.log(`Found existing ${tier.name}: ${price.id}`);
    }

    results.push(`${tier.envVar}=${price.id}`);
  }

  console.log('\nAdd these to .env.local (and to your Vercel project env vars for production):\n');
  console.log(results.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
