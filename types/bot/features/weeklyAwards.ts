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
}

export interface WeeklyAwardConfigRecord {
  guildId: string;
  guildName: string;
  channelName: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}
