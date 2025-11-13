export interface Inputs {
  a: string;
  b: string;
  c: string;
  d: string;
}

export interface Results {
  absoluteRiskExposed: { value: number } | null;
  absoluteRiskControl: { value: number } | null;
  riskDifference: { value: number; lower: number; upper: number; } | null;
  relativeRisk: { value: number; lower: number; upper: number; pValue: string; zStat: number; } | null;
  oddsRatio: { value: number; lower: number; upper: number; pValue: string; zStat: number; } | null;
  impactMeasures: {
    absolute: { label: string; value: number; };
    relative: { label: string; value: number; };
  } | null;
  nnt: { value: number; type: 'Benefit' | 'Harm'; lower: number | string; upper: number | string; } | null;
  power: { value: number } | null;
  type1Error: { value: number } | null;
  type2Error: { value: number } | null;
}
