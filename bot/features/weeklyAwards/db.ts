import { Message } from 'discord.js';
import { dayjs } from '@lib/dayjsSetup';
import Database, { Transaction } from 'better-sqlite3';
import type { WeeklyAwardConfigRecord, WeeklyAwardRecord } from 'types/bot/features/weeklyAwards';

const db = Database('weeklyAward.db');
const TABLE = 'reacted_messages';

class WeeklyAwardDatabase {
  #config = new WeeklyAwardDatabaseConfig();

  get config() {
    return this.#config;
  }

  constructor() {
    db.pragma('auto_vacuum = incremental');
    db.prepare(`
      create table if not exists ${TABLE} (
        guild_id text not null,
        channel_id text not null,
        message_id text not null,
        guild_name text not null,
        channel_name text not null,
        content text not null,
        author text not null,
        url text not null,
        reactions_count integer not null,
        timestamp text not null,
        primary key (guild_id, channel_id, message_id)
      )
    `).run();
  }

  get(guildId: string, channelId: string, messageId: string): WeeklyAwardRecord | null {
    const stmt = db.prepare(`
      select
        guild_name,
        channel_name,
        content,
        author,
        url,
        reactions_count,
        timestamp
      from ${TABLE}
      where
        guild_id   = @guildId   and
        channel_id = @channelId and
        message_id = @messageId
    `);

    const row = stmt.get({ guildId, channelId, messageId });
    if (row == null) return null;

    return {
      guildId,
      channelId,
      messageId,
      guildName: row.guild_name,
      channelName: row.channel_name,
      content: row.content,
      author: row.author,
      url: row.url,
      reactionsCount: row.reactions_count,
      timestamp: dayjs(row.timestamp).tz(),
    };
  }

  set(message: Message<true>, reactionsCount: number): void {
    const stmt = db.prepare(`
      insert into ${TABLE} (
        guild_id,
        channel_id,
        message_id,
        guild_name,
        channel_name,
        content,
        author,
        url,
        reactions_count,
        timestamp
      ) values (
        @guildId,
        @channelId,
        @messageId,
        @guildName,
        @channelName,
        @content,
        @author,
        @url,
        @reactionsCount,
        @timestamp
      )
      on conflict (guild_id, channel_id, message_id) do
        update set
          guild_name = @guildName,
          channel_name = @channelName,
          content = @content,
          author = @author,
          reactions_count = @reactionsCount
    `);

    const { channel } = message;
    const channelName = 'name' in channel ? channel.name : '';

    stmt.run({
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      guildName: message.guild?.name ?? '',
      channelName,
      content: message.content,
      author: message.author?.username ?? '',
      url: message.url,
      reactionsCount,
      timestamp: dayjs(message.createdTimestamp).utc().toISOString(),
    });
  }

  *iterate(): Generator<WeeklyAwardRecord> {
    const stmt = db.prepare(`select * from ${TABLE}`);

    for (const row of stmt.iterate()) {
      yield {
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        guildName: row.guild_name,
        channelName: row.channel_name,
        content: row.content,
        author: row.author,
        url: row.url,
        reactionsCount: row.reactions_count,
        timestamp: dayjs(row.timestamp).tz(),
      };
    }
  }

  transaction<T>(values: T[], callback: (value: T) => void): void {
    const fn: Transaction<(values: T[]) => void> = db.transaction(values => values.forEach(callback));

    fn(values);
  }

  delete(guildId: string, channelId: string, messageId: string): void {
    const stmt = db.prepare(`
      delete from ${TABLE}
      where
        guild_id   = @guildId   and
        channel_id = @channelId and
        message_id = @messageId
    `);

    stmt.run({ guildId, channelId, messageId });
  }

  vacuum() {
    db.pragma('incremental_vacuum');
  }
}

class WeeklyAwardDatabaseConfig {
  #TABLE = 'post_target';

  get records(): WeeklyAwardConfigRecord[] {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows.map(row => ({
      guildId: row.guild_id,
      guildName: row.guild_name,
      channelName: row.channel_name,
      createdAt: dayjs(row.created_at).tz(),
      updatedAt: dayjs(row.updated_at).tz(),
    }));
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        guild_id text not null primary key,
        guild_name text not null,
        channel_name text not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  register(guildId: string, guildName: string, channelName: string): void {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_name
      ) values (
        @guildId,
        @guildName,
        @channelName
      )
      on conflict (guild_id) do
        update set
          guild_name = @guildName,
          channel_name = @channelName,
          updated_at = datetime('now')
    `);

    stmt.run({ guildId, guildName, channelName });
  }

  unregister(guildId: string): void {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = ?
    `);

    stmt.run(guildId);
  }

  get(guildId: string): WeeklyAwardConfigRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (row == null) return null;

    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      channelName: row.channel_name,
      createdAt: dayjs(row.created_at).tz(),
      updatedAt: dayjs(row.updated_at).tz(),
    };
  }
}

const _db = new WeeklyAwardDatabase();
export { _db as db };
