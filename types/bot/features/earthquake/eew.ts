export interface EEW {
  id: string;
  code: 556;
  time: string;
  test?: boolean;
  earthquake?: Earthquake;
  issue: Issue;
  cancelled: boolean;
  areas: Area[];
}

interface Earthquake {
  originTime: string;
  arrivalTime: string;
  condition?: string;
  hypocenter: Hypocenter;
}

interface Hypocenter {
  name?: string;
  reduceName?: string;
  latitude?: number;
  longitude?: number;
  depth?: number;
  magnitude?: number;
}

interface Issue {
  time: string;
  eventId: string;
  serial: string;
}

export interface Area {
  pref: string;
  name: string;
  scaleFrom: ScaleFrom;
  scaleTo: ScaleTo;
  kindCode?: KindCode;
  arrivalTime?: string;
}

export type Intensity = 10 | 20 | 30 | 40 | 45 | 50 | 55 | 60 | 70;
export type ScaleFrom = -1 | 0 | Intensity;
export type ScaleTo = ScaleFrom | 99;
type KindCode = '10' | '11' | '19';
