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

// Prices from claude/LandEthic-Pricing-Analysis.md (Nov 2026). Lookup keys end in _2026
// so they don't collide with the original $9.99/$19.99/$39.99 monthly prices.
const TIERS: { name: string; envVar: string; key: string; monthlyCents: number; yearlyCents: number }[] = [
  { name: 'LandEthic Steward',        envVar: 'STRIPE_PRICE_STEWARD',        key: 'steward',        monthlyCents: 399,  yearlyCents: 2999 },
  { name: 'LandEthic Naturalist',     envVar: 'STRIPE_PRICE_NATURALIST',     key: 'naturalist',     monthlyCents: 699,  yearlyCents: 5999 },
  { name: 'LandEthic Conservationist', envVar: 'STRIPE_PRICE_CONSERVATIONIST', key: 'conservationist', monthlyCents: 1599, yearlyCents: 11999 },
];

async function findOrCreateProduct(name: string) {
  const existing = await stripe.products.search({ query: `name:'${name}' AND active:'true'`, limit: 1 });
  return existing.data[0] ?? (await stripe.products.create({ name }));
}

async function findOrCreatePrice(productId: string, lookupKey: string, cents: number, interval: 'month' | 'year') {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data[0]) return { price: existing.data[0], created: false };
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: cents,
    recurring: { interval },
    lookup_key: lookupKey,
  });
  return { price, created: true };
}

async function main() {
  console.log('Setting up Stripe products/prices...\n');
  const results: string[] = [];

  for (const tier of TIERS) {
    const product = await findOrCreateProduct(tier.name);
    for (const interval of ['month', 'year'] as const) {
      const lookupKey = `landethic_${tier.key}_${interval === 'month' ? 'monthly' : 'yearly'}_2026`;
      const cents = interval === 'month' ? tier.monthlyCents : tier.yearlyCents;
      const { price, created } = await findOrCreatePrice(product.id, lookupKey, cents, interval);
      console.log(`${created ? 'Created' : 'Found existing'} ${tier.name} (${interval}ly): ${price.id}`);
      results.push(`${tier.envVar}${interval === 'year' ? '_YEARLY' : ''}=${price.id}`);
    }
  }

  console.log('\nAdd these to .env.local (and to your Vercel project env vars for production):\n');
  console.log(results.join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
