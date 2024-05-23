import type { Dayjs } from 'dayjs';
import type { AreaPeers } from './areaPeers';
import type { EEW } from './eew';
import type { EEWDetection } from './eewDetection';
import type { JMAQuake } from './jmaQuake';
import type { JMATsunami } from './jmaTsunami';
import type { UserQuake } from './userQuake';
import type { UserQuakeEvaluation } from './userQuakeEvaluation';

export type WebSocketResponse =
  | JMAQuake
  | JMATsunami
  | AreaPeers
  | EEWDetection
  | EEW
  | UserQuake
  | UserQuakeEvaluation
  ;

export type * from './jmaQuake';
export type * from './jmaTsunami';
export type * from './areaPeers';
export type * from './eewDetection';
export type * from './eew';
export type * from './userQuake';
export type * from './userQuakeEvaluation';
export type * from './geocoding';

export interface EEWConfigRecord {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  minIntensity: number;
  alertThreshold: number;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface EEWConfigRow {
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  min_intensity: number;
  alert_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface GeoCodingRecord {
  prefecture: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface GeoCodingRow {
  prefecture: string;
  address: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}
