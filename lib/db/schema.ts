import { pgTable, uuid, text, numeric, boolean, jsonb, timestamp, index, integer } from 'drizzle-orm/pg-core';
import type { Goal, SubscriptionTier, TaskStep, FoodPlot, NestingBox } from '@/types';
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
  // Monthly update (Naturalist+): "YYYY-MM" of the last update, and the note written with it
  lastMonthlyUpdate: text('last_monthly_update'),
  monthlyNote: text('monthly_note'),
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
  // Outline of the work area on the map: closed ring of [lng, lat]
  area: jsonb('area').$type<number[][]>(),
  // Weekly checklist (Conservationist): week of the month (1–4) and small check-off steps
  week: integer('week'),
  steps: jsonb('steps').$type<TaskStep[]>(),
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
    timeNeeded?: string;
    costEstimate?: string;
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
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// One row per AI request, used for the per-user daily cap in lib/rate-limit.ts.
// Old rows can be deleted at any time — only the last 24 hours are ever read.
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull(),
  route: text('route').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('ai_usage_user_route_created_idx').on(t.clerkUserId, t.route, t.createdAt),
]);

// Past Species ID results, shown as "Your recent identifications" in the field guide.
// The photo is stored as a small JPEG thumbnail (data URL, ~20 KB) — not the full upload.
export const speciesIds = pgTable('species_ids', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  thumbnail: text('thumbnail'),
  commonName: text('common_name').notNull(),
  scientificName: text('scientific_name'),
  iconicTaxon: text('iconic_taxon'),
  score: numeric('score', { mode: 'number' }),
  // Full list of top matches returned at the time, so the details can be shown again
  results: jsonb('results').$type<Record<string, unknown>[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('species_ids_user_created_idx').on(t.clerkUserId, t.createdAt),
]);

// Food plot and nesting box plans (Conservationist). One row per property.
export const habitatPlans = pgTable('habitat_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: 'cascade' }),
  foodPlots: jsonb('food_plots').$type<FoodPlot[]>().notNull().default([]),
  foodPlotNote: text('food_plot_note'),
  nestingBoxes: jsonb('nesting_boxes').$type<NestingBox[]>().notNull().default([]),
  nestingBoxNote: text('nesting_box_note'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});

// "Report a problem" — what a member sent us when something went wrong, with the
// error and technical details captured automatically. Reviewed at /admin/reports.
export const problemReports = pgTable('problem_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id'),
  email: text('email'),
  tier: text('tier'),
  page: text('page'),
  /** What the member typed. */
  message: text('message'),
  /** The error they saw (or the crash message). */
  error: text('error'),
  /** Browser, screen, app version, recent requests and errors. */
  details: jsonb('details').$type<Record<string, unknown>>(),
  /** Hash of the sender's IP — only used to stop floods of reports. */
  ipHash: text('ip_hash'),
  status: text('status').notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('problem_reports_created_idx').on(t.createdAt),
]);
