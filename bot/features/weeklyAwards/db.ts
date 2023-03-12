import { setTimeout } from 'node:timers/promises';
import { Message } from 'discord.js';
import { Database } from 'bun:sqlite';
import { dayjs } from '@lib/dayjsSetup';
import { isUrl } from '@lib/util';
import type { WeeklyAwardConfigRecord, WeeklyAwardConfigRow, WeeklyAwardDatabaseRow, WeeklyAwardRecord } from 'types/bot/features/weeklyAwards';

const db = new Database('weeklyAward.db', { readwrite: true, create: true });
const TABLE = 'reacted_messages';

class WeeklyAwardDatabase {
  #config = new WeeklyAwardDatabaseConfig();

  static #isRow(row: unknown): row is WeeklyAwardDatabaseRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('channel_id' in row && typeof row.channel_id === 'string')) return false;
    if (!('message_id' in row && typeof row.message_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('content' in row && typeof row.content === 'string')) return false;
    if (!('author' in row && typeof row.author === 'string')) return false;
    if (!('url' in row && typeof row.url === 'string' && isUrl(row.url))) return false;
    if (!('reactions_count' in row && typeof row.reactions_count === 'number')) return false;
    if (!('timestamp' in row && typeof row.timestamp === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  get config() {
    return this.#config;
  }

  constructor() {
    db.run(`
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
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now')),
        primary key (guild_id, channel_id, message_id)
      )
    `);
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
        timestamp,
        created_at,
        updated_at
      from ${TABLE}
      where
        guild_id   = $guildId   and
        channel_id = $channelId and
        message_id = $messageId
    `);

    const row = stmt.get({
      $guildId: guildId,
      $channelId: channelId,
      $messageId: messageId,
    });

    if (!WeeklyAwardDatabase.#isRow(row)) return null;

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
      createdAt: dayjs(row.created_at).tz(),
      updatedAt: dayjs(row.updated_at).tz(),
    };
  }

  async set(message: Message<true>, reactionsCount: number): Promise<void> {
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
        $guildId,
        $channelId,
        $messageId,
        $guildName,
        $channelName,
        $content,
        $author,
        $url,
        $reactionsCount,
        $timestamp
      )
      on conflict (guild_id, channel_id, message_id) do
        update set
          guild_name = $guildName,
          channel_name = $channelName,
          content = $content,
          author = $author,
          reactions_count = $reactionsCount,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({
        $guildId: message.guildId,
        $channelId: message.channelId,
        $messageId: message.id,
        $guildName: message.guild?.name ?? '',
        $channelName: message.channel.name,
        $content: message.content,
        $author: message.author?.username ?? '',
        $url: message.url,
        $reactionsCount: reactionsCount,
        $timestamp: dayjs(message.createdTimestamp).utc().toISOString(),
      });
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.set(message, reactionsCount);
        }
      }
      throw e;
    }
  }

  *iterate(): Generator<WeeklyAwardRecord> {
    const stmt = db.prepare(`select * from ${TABLE}`);

    for (const row of stmt.values()) {
      if (!WeeklyAwardDatabase.#isRow(row)) continue;

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
        createdAt: dayjs(row.created_at).tz(),
        updatedAt: dayjs(row.updated_at).tz(),
      };
    }
  }

  async transaction<T>(values: T[], callback: (value: T) => void): Promise<void> {
    const fn: ReturnType<typeof db.transaction> = db.transaction(values => values.forEach(callback));

    try {
      fn(values);
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.transaction(values, callback);
        }
      }
      throw e;
    }
  }

  async delete(guildId: string, channelId: string, messageId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${TABLE}
      where
        guild_id   = @guildId   and
        channel_id = @channelId and
        message_id = @messageId
    `);

    try {
      stmt.run({ guildId, channelId, messageId });
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.delete(guildId, channelId, messageId);
        }
      }
      throw e;
    }
  }

  async deleteOutdated(guildId: string, days: number): Promise<void> {
    const stmt = db.prepare(`
      delete from ${TABLE}
      where
        guild_id = @guildId and
        julianday('now') - julianday(timestamp) > @days
    `);

    try {
      stmt.run({ guildId, days });
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.deleteOutdated(guildId, days);
        }
      }
      throw e;
    }
  }
}

class WeeklyAwardDatabaseConfig {
  #TABLE = 'post_target';

  static #isRow(row: unknown): row is WeeklyAwardConfigRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  get records(): WeeklyAwardConfigRecord[] {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter((row: unknown): row is WeeklyAwardConfigRow => WeeklyAwardDatabaseConfig.#isRow(row))
      .map(row => ({
        guildId: row.guild_id,
        guildName: row.guild_name,
        channelName: row.channel_name,
        createdAt: dayjs(row.created_at).tz(),
        updatedAt: dayjs(row.updated_at).tz(),
      }));
  }

  constructor() {
    db.run(`
      create table if not exists ${this.#TABLE} (
        guild_id text not null primary key,
        guild_name text not null,
        channel_name text not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `);
  }

  async register(guildId: string, guildName: string, channelName: string): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_name
      ) values (
        $guildId,
        $guildName,
        $channelName
      )
      on conflict (guild_id) do
        update set
          guild_name = $guildName,
          channel_name = $channelName,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({
        $guildId: guildId,
        $guildName: guildName,
        $channelName: channelName,
      });
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.register(guildId, guildName, channelName);
        }
      }
      throw e;
    }
  }

  async unregister(guildId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = ?
    `);

    try {
      stmt.run(guildId);
    }
    catch (e) {
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.unregister(guildId);
        }
      }
      throw e;
    }
  }

  get(guildId: string): WeeklyAwardConfigRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (!WeeklyAwardDatabaseConfig.#isRow(row)) return null;

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
