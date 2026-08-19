export interface SpeedMetrics {
  totalMs: number;
  prepMs: number;
  forensicMs: number;
  aiInferenceMs: number;
  throughputLabel: string;
  isCached?: boolean;
}

export type DynamicRecord = Record<string, unknown>;
