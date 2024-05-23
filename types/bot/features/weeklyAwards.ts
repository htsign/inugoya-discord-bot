import type { Weekday } from '@features/weeklyAwards/weekday';
import type { Dayjs } from 'dayjs';
import type { Message } from 'discord.js';
import type { Url } from 'types';

export interface MessageAndReactions {
  message: Message<true>;
  reactionsCount: number;
}

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
  channelId: string;
  channelName: string;
  showsRankCount: number;
  minReacted: number;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface WeeklyAwardTimeRecord {
  guildId: string;
  weekday: Weekday;
  hour: number;
  minute: number;
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
  channel_id: string;
  channel_name: string;
  shows_rank_count: number;
  min_reacted: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyAwardTimeRow {
  guild_id: string;
  weekday: number;
  hour: number;
  minute: number;
  created_at: string;
  updated_at: string;
}
