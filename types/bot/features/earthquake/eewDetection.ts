export interface EEWDetection {
  _id: string;
  id: string;
  code: 554;
  time: string;
  type: DetectionType;
}

type DetectionType =
  | 'Full'
  | 'Chime'
  ;
