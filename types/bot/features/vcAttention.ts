import type { Dayjs } from 'dayjs';

export interface VCAttentionConfigRecord {
  guildId: string;
  guildName: string;
  channelId: string;
  channelName: string;
  threshold: number;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface VCAttentionConfigRow {
  guild_id: string;
  guild_name: string;
  channel_id: string;
  channel_name: string;
  threshold: number;
  created_at: string;
  updated_at: string;
}
