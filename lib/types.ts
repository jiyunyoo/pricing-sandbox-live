export type Generation = 'Z' | 'M' | 'X' | 'Boomer';
export type Sex = 'M' | 'F';
export type HouseholdCode = 'single' | 'parents' | 'dink' | 'family' | 'senior_couple';
export type GoodType = 'search' | 'experience';

export interface PersonaValues {
  gaseong: number;
  gasim: number;
  meaning: number;
  brand: number;
}

export interface PersonaLifestyle {
  monitor_interest: number;
  cosmetics_interest: number;
}

export interface Persona {
  id: string;
  name: string;
  nameEn: string;
  archetype: string;
  gen: Generation;
  age: number;
  sex: Sex;
  household: string;
  householdCode: HouseholdCode;
  region: string;
  occupation: string;
  income: number;
  savings_rate: number;
  debt: string;
  values: PersonaValues;
  lifestyle: PersonaLifestyle;
  bio: string;
  sources: string;
}

export interface Product {
  id: string;
  name: string;
  emoji: string;
  goodType: GoodType;
  basePrice: number;
  unit: string;
  priceSource: string;
  elasticityPrior: string;
}

export interface CustomProduct {
  id: 'custom';
  name: string;
  emoji: string;
  goodType: GoodType;
  basePrice: number;
  unit: string;
  priceSource: string;
  elasticityPrior: string;
}

export type ActiveProduct = Product | CustomProduct;

export interface Decision {
  buy: boolean;
  confidence: number;
  rationale_cot: string;
}

export interface PersonaDecision {
  personaId: string;
  stage1Base: Decision;
  stage1Priced: Decision;
  stage2?: Decision;
  flipped?: boolean;
}

export interface DiscussionThread {
  leader: { personaId: string; seedPost: string };
  comments: { personaId: string; text: string }[];
}

export interface SimulateRequest {
  product: ActiveProduct;
  deltaPct: number;
  discussion: boolean;
  popPerArch: number;
}

export interface SimulateResponse {
  product: ActiveProduct;
  deltaPct: number;
  discussion: boolean;
  decisions: PersonaDecision[];
  thread?: DiscussionThread;
  metrics: {
    Q_base: number;
    Q_pre: number;
    Q_post: number;
    deltaQ_pre: number;
    deltaQ_post: number;
    elasticity: number;
    wom_m: number;
    mcnemar: { b: number; c: number; chi2: number; significant: boolean };
    cohort: Record<string, { n: number; buyRateBase: number; buyRatePre: number; buyRatePost: number }>;
  };
  population: {
    n: number;
    Q_base: number;
    Q_pre: number;
    Q_post: number;
  };
}
