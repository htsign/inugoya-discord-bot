import type { Dayjs } from 'dayjs';

export interface LaunchedConfigRecord {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface LaunchedConfigRow {
  id: number;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  created_at: string;
  updated_at: string;
}
