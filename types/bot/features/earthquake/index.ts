import type { Dayjs } from 'dayjs';
import type { AreaPeers } from './areaPeers.ts';
import type { EEW } from './eew.ts';
import type { EEWDetection } from './eewDetection.ts';
import type { JMAQuake } from './jmaQuake.ts';
import type { JMATsunami } from './jmaTsunami.ts';
import type { UserQuake } from './userQuake.ts';
import type { UserQuakeEvaluation } from './userQuakeEvaluation.ts';

export type WebSocketResponse =
  | JMAQuake
  | JMATsunami
  | AreaPeers
  | EEWDetection
  | EEW
  | UserQuake
  | UserQuakeEvaluation;

export type * from './areaPeers.ts';
export type * from './eew.ts';
export type * from './eewDetection.ts';
export type * from './geocoding.ts';
export type * from './jmaQuake.ts';
export type * from './jmaTsunami.ts';
export type * from './userQuake.ts';
export type * from './userQuakeEvaluation.ts';

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
