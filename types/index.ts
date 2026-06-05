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
  // Species/materials recommendations
  recommendations?: {
    species?: string[];
    materials?: string[];
    dimensions?: string;
    placement?: string;
    photoPrompt?: string;   // Steward+: what to photograph for species ID
    impactNote?: string;    // Naturalist+: how this task moves the land health score
  };
}

export interface ActionPlan {
  id: string;
  propertyId: string;
  tier: SubscriptionTier;
  generatedAt: string;
  tasks: ActionTask[];
  summary: string;
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
