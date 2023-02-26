import type { Dayjs } from 'dayjs';

export interface WeeklyAwardRecord {
  guildId: string;
  channelId: string;
  messageId: string;
  guildName: string;
  channelName: string;
  content: string;
  author: string;
  url: Url;
  reactionsCount: number;
  timestamp: Dayjs;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface WeeklyAwardConfigRecord {
  guildId: string;
  guildName: string;
  channelName: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface WeeklyAwardDatabaseRow {
  guild_id: string;
  channel_id: string;
  message_id: string;
  guild_name: string;
  channel_name: string;
  content: string;
  author: string;
  url: Url;
  reactions_count: number;
  timestamp: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyAwardConfigRow {
  guild_id: string;
  guild_name: string;
  channel_name: string;
  created_at: string;
  updated_at: string;
}
