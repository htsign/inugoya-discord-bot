export interface RegionalIndicatorsSuccess {
  success: true;
  values: string[];
}

export interface RegionalIndicatorsFailure {
  success: false;
  message: string;
}

export type RegionalIndicatorsResult = RegionalIndicatorsSuccess | RegionalIndicatorsFailure;
