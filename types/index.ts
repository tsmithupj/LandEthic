// ─── Core domain types for LandEthic.io ───────────────────────────────────

export type Goal =
  | 'wildlife_diversity'
  | 'deer_hunting'
  | 'bird_sanctuary'
  | 'pollinator_habitat'
  | 'soil_restoration'
  | 'turkey_habitat'
  | 'native_plants'
  | 'water_quality';

export const GOAL_LABELS: Record<Goal, string> = {
  wildlife_diversity: 'Wildlife diversity',
  deer_hunting: 'Deer hunting',
  bird_sanctuary: 'Bird sanctuary',
  pollinator_habitat: 'Pollinator habitat',
  soil_restoration: 'Soil restoration',
  turkey_habitat: 'Turkey habitat',
  native_plants: 'Native plants',
  water_quality: 'Water quality',
};

export type SubscriptionTier = 'free' | 'steward' | 'naturalist' | 'conservationist';

export interface ParcelBoundary {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][];
  acreage: number;
  ownerName?: string;
  parcelId?: string;
  county?: string;
  state?: string;
}

export interface PropertyProfile {
  id: string;
  name: string;
  address: string;
  acreage: number;
  county: string;
  state: string;
  goals: Goal[];
  boundary: ParcelBoundary | null;
  // Derived from satellite + external data
  woodedAcres?: number;
  openAcres?: number;
  soilType?: string;
  waterFeatures?: string[];
  ecosystemScore?: number; // 0–100
  createdAt: string;
}

export interface ActionTask {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  whyItMatters: string;
  impactScore: number; // 0–10
  impactBreakdown: {
    goalAlignment: number;
    ecosystemImpact: number;
    seasonalTiming: number;
    easeCost: number;
  };
  tags: string[];
  month?: string;   // e.g. "June 2026"
  season?: string;  // e.g. "Summer"
  tier: SubscriptionTier;
  completed: boolean;
  completedAt?: string;
  // Where on the property this task takes place
  locationDescription?: string; // natural-language directions using cardinal directions and land features
  area?: number[][];            // outline of the work area on the map: closed ring of [lng, lat]
  // Conservationist weekly checklist
  week?: number;                // 1–4: which week of its month to do this task
  steps?: TaskStep[];           // small check-off steps
  // Species/materials recommendations
  recommendations?: {
    species?: string[];
    materials?: string[];
    dimensions?: string;
    placement?: string;
    photoPrompt?: string;   // Steward+: what to photograph for species ID
    impactNote?: string;    // Naturalist+: how this task moves the land health score
    timeNeeded?: string;    // Naturalist+: hands-on time, e.g. "About 2 hours"
    costEstimate?: string;  // Naturalist+: supply cost, e.g. "$40–60 for seed"
  };
}

export interface TaskStep {
  text: string;
  done: boolean;
}

export interface ActionPlan {
  id: string;
  propertyId: string;
  tier: SubscriptionTier;
  generatedAt: string;
  tasks: ActionTask[];
  summary: string;
  /** "YYYY-MM" of the last monthly update (Naturalist+). */
  lastMonthlyUpdate?: string;
  /** Short note written with the last monthly update. */
  monthlyNote?: string;
}

// ─── Habitat planners (Conservationist) ───────────────────────────────────

export interface SeedPick {
  seed: string;          // e.g. "Durana white clover"
  lbsPerAcre: number;
  notes?: string;
}

export interface FoodPlot {
  id: string;
  name: string;
  acres: number;
  where: string;
  area?: number[][];     // closed ring of [lng, lat]
  targetWildlife: string[];
  seedMix: SeedPick[];
  plantingWindow: string;
  soilPrep: string[];
  limeAndFertilizer?: string;
  maintenance: string[];
  why: string;
}

export interface NestingBox {
  id: string;
  species: string;       // e.g. "Eastern bluebird"
  boxType: string;       // e.g. "Peterson-style box, 1.5-inch round hole"
  count: number;
  mountHeight: string;   // e.g. "5 feet"
  facing: string;        // e.g. "East, away from prevailing wind"
  spacing?: string;
  where: string;
  area?: number[][];     // small ring around where the boxes go
  putUpBy?: string;
  cleanOut?: string;
  tips: string[];
  why: string;
}

export interface HabitatPlan {
  propertyId: string;
  foodPlots: FoodPlot[];
  foodPlotNote?: string;
  nestingBoxes: NestingBox[];
  nestingBoxNote?: string;
  generatedAt: string;
}

// ─── API request/response shapes ──────────────────────────────────────────

export interface AnalyzePropertyRequest {
  address: string;
  acreage?: number;
  goals: Goal[];
  boundaryGeoJson?: ParcelBoundary;
  satelliteImageBase64?: string;
}

export interface AnalyzePropertyResponse {
  profile: PropertyProfile;
  insights: Array<{
    type: 'positive' | 'warning' | 'opportunity';
    title: string;
    description: string;
    zoneLabel?: string;
    where?: string;
    steps?: string[];
    area?: number[][];
  }>;
}

export interface GeneratePlanRequest {
  propertyId: string;
  tier: SubscriptionTier;
}

export interface GeneratePlanResponse {
  plan: ActionPlan;
}

export interface ParcelLookupRequest {
  address: string;
}

export interface ParcelLookupResponse {
  parcels: ParcelBoundary[];
  ownerMatch: boolean;
}
