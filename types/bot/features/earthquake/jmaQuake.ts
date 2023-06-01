export interface JMAQuake {
  _id: string;
  id: string;
  code: 551;
  time: string;
  issue: Issue;
  earthquake: Earthquake;
  points?: ObservationPoint[];
}

interface Issue {
  source?: string;
  time: string;
  type: IssueType;
  correct?: CollectType;
}

type IssueType =
  | 'ScalePrompt'
  | 'Destination'
  | 'ScaleAndDestination'
  | 'DetailScale'
  | 'Foreign'
  | 'Other'
  ;

type CollectType =
  | 'None'
  | 'Unknown'
  | 'ScaleOnly'
  | 'DestinationOnly'
  | 'ScaleAndDestination'
  ;

interface Earthquake {
  time: string;
  hypocenter?: Hypocenter;
  maxScale?: EarthquakeMaxScale;
  domesticTsunami?: DomesticTsunami;
  foreignTsunami?: ForeignTsunami;
}

interface Hypocenter {
  name?: string;
  latitude?: number;
  longitude?: number;
  depth?: number;
  magnitude?: number;
}

type EarthquakeMaxScale = -1 | 10 | 20 | 30 | 40 | 45 | 50 | 55 | 60 | 70;

type DomesticTsunami =
  | 'None'
  | 'Unknown'
  | 'Checking'
  | 'NonEffective'
  | 'Watch'
  | 'Warning'
  ;

type ForeignTsunami =
  | 'None'
  | 'Unknown'
  | 'Checking'
  | 'NonEffectiveNearby'
  | 'WarningNearby'
  | 'WarningPacific'
  | 'WarningPacificWide'
  | 'WarningIndian'
  | 'WarningIndianWide'
  | 'Potential'
  ;

interface ObservationPoint {
  pref: string;
  addr: string;
  isArea: boolean;
  scale: EarthquakeScale;
}

type EarthquakeScale = 10 | 20 | 30 | 40 | 45 | 46 | 50 | 55 | 60 | 70;
