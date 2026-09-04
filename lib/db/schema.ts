import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import type { Goal, SubscriptionTier } from '@/types';
import type { Insight } from '@/lib/store';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull(),
  name: text('name').notNull(),
  address: text('address').notNull(),
  acreage: numeric('acreage', { mode: 'number' }).notNull(),
  county: text('county').notNull(),
  state: text('state').notNull(),
  goals: jsonb('goals').$type<Goal[]>().notNull(),
  // Raw polygon rings used by the map components — not `PropertyProfile.boundary`
  // (a `ParcelBoundary` object), which the AI always returns as null today.
  boundary: jsonb('boundary').$type<number[][][] | null>(),
  woodedAcres: numeric('wooded_acres', { mode: 'number' }),
  openAcres: numeric('open_acres', { mode: 'number' }),
  soilType: text('soil_type'),
  waterFeatures: jsonb('water_features').$type<string[]>(),
  ecosystemScore: numeric('ecosystem_score', { mode: 'number' }),
  insights: jsonb('insights').$type<Insight[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('properties_clerk_user_id_idx').on(t.clerkUserId),
]);

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  tier: text('tier').$type<SubscriptionTier>().notNull(),
  summary: text('summary').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('plans_property_id_idx').on(t.propertyId),
]);

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  // Denormalized so ownership checks don't require a join through plans -> properties.
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  whyItMatters: text('why_it_matters').notNull(),
  locationDescription: text('location_description'),
  impactScore: numeric('impact_score', { mode: 'number' }).notNull(),
  impactBreakdown: jsonb('impact_breakdown').$type<{
    goalAlignment: number;
    ecosystemImpact: number;
    seasonalTiming: number;
    easeCost: number;
  }>().notNull(),
  recommendations: jsonb('recommendations').$type<{
    species?: string[];
    materials?: string[];
    dimensions?: string;
    placement?: string;
    photoPrompt?: string;
    impactNote?: string;
  }>(),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  month: text('month'),
  season: text('season'),
  tier: text('tier').$type<SubscriptionTier>().notNull(),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [
  index('tasks_plan_id_idx').on(t.planId),
  index('tasks_property_id_idx').on(t.propertyId),
]);

export const subscriptions = pgTable('subscriptions', {
  clerkUserId: text('clerk_user_id').primaryKey(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  tier: text('tier').$type<SubscriptionTier>().notNull().default('free'),
  status: text('status'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
