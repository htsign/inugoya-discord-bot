export interface UserQuakeEvaluation {
  id: string;
  code: 9611;
  time: string;
  count: number;
  confidence: Confidence;
  started_at?: string;
  updated_at?: string;
  area_confidences: AreaConfidence[];
}

type Confidence = 0 | 0.97015 | 0.96774 | 0.97024 | 0.98052;

interface AreaConfidence {
  confidence?: number;
  count?: number;
  display?: string;
}
