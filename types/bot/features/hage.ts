import type { Dayjs } from 'dayjs';

export interface HageConfigRecord {
  guildId: string;
  guildName: string;
  template: string;
  moreTemplate: string;
  rareTemplate: string;
  timeout: number;
  stackSize: number;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface HageKeywordRecord {
  id: number;
  guildId: string;
  keyword: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface HageReactionKeywordRecord {
  id: number;
  guildId: string;
  reaction: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface HageConfigRow {
  guild_id: string;
  guild_name: string;
  template: string;
  more_template: string;
  rare_template: string;
  timeout: number;
  stack_size: number;
  created_at: string;
  updated_at: string;
}

export interface HageKeywordRow {
  id: number;
  guild_id: string;
  keyword: string;
  created_at: string;
  updated_at: string;
}

export interface HageReactionKeywordRow {
  id: number;
  guild_id: string;
  reaction: string;
  created_at: string;
  updated_at: string;
}
