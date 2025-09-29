import { setTimeout } from 'node:timers/promises';
import Database, { type Transaction } from 'better-sqlite3';
import type { Message } from 'discord.js';
import type {
  WeeklyAwardConfigRecord,
  WeeklyAwardConfigRow,
  WeeklyAwardDatabaseRow,
  WeeklyAwardRecord,
  WeeklyAwardTimeRecord,
  WeeklyAwardTimeRow,
} from '../../../types/bot/features/weeklyAwards.ts';
import dayjs from '../../lib/dayjsSetup.ts';
import { isUrl } from '../../lib/util.ts';
import { fromNumber, type Weekday } from './weekday.ts';

const db = new Database('weeklyAward.db');

class WeeklyAward {
  #TABLE = 'reacted_messages';

  #config: WeeklyAwardConfig;
  #times: WeeklyAwardTime;

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

  get config(): WeeklyAwardConfig {
    return this.#config;
  }

  get times(): WeeklyAwardTime {
    return this.#times;
  }

  constructor() {
    db.pragma('auto_vacuum = incremental');
    db.prepare(`
      create table if not exists ${this.#TABLE} (
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
    `).run();

    this.#config = new WeeklyAwardConfig();
    this.#times = new WeeklyAwardTime();
  }

  get(guildId: string, channelId: string, messageId: string): WeeklyAwardRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id   = @guildId   and
        channel_id = @channelId and
        message_id = @messageId
    `);

    const row = stmt.get({ guildId, channelId, messageId });
    if (!WeeklyAward.#isRow(row)) return null;

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
      timestamp: dayjs.utc(row.timestamp).tz(),
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }

  async set(message: Message<true>, reactionsCount: number): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
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
          reactions_count = @reactionsCount,
          updated_at = datetime('now')
    `);

    const { channel } = message;
    const channelName = 'name' in channel ? channel.name : '';

    try {
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
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.set(message, reactionsCount);
      }
      throw e;
    }
  }

  all(): WeeklyAwardRecord[] {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    return stmt.all()
      .filter(WeeklyAward.#isRow)
      .map(row => ({
        guildId: row.guild_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        guildName: row.guild_name,
        channelName: row.channel_name,
        content: row.content,
        author: row.author,
        url: row.url,
        reactionsCount: row.reactions_count,
        timestamp: dayjs.utc(row.timestamp).tz(),
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  *iterate(): Generator<WeeklyAwardRecord> {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    for (const row of stmt.iterate()) {
      if (!WeeklyAward.#isRow(row)) continue;

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
        timestamp: dayjs.utc(row.timestamp).tz(),
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      };
    }
  }

  async transaction<T>(values: T[], callback: (arg: T) => void): Promise<void> {
    const fn: Transaction<(values: T[]) => void> = db.transaction(values => values.forEach(callback));

    try {
      fn(values);
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.transaction(values, callback);
      }
      throw e;
    }
  }

  async delete(guildId: string, channelId: string, messageId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id   = @guildId   and
        channel_id = @channelId and
        message_id = @messageId
    `);

    try {
      stmt.run({ guildId, channelId, messageId });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId, channelId, messageId);
      }
      throw e;
    }
  }

  async *deleteOutdated(guildId: string, days: number): AsyncGenerator<number | undefined> {
    const whereStatement = `
      where
        guild_id = @guildId and
        julianday('now') - julianday(timestamp) > @days
    `;
    const cntStmt = db.prepare(`select count(*) from ${this.#TABLE} ${whereStatement}`).pluck();
    const delStmt = db.prepare(`delete from ${this.#TABLE} ${whereStatement}`);

    try {
      // return outdated records count
      const count = cntStmt.get({ guildId, days });

      if (typeof count === 'number') {
        yield count;
      }
      else {
        throw new TypeError('count must be a number');
      }

      if (count > 0) {
        delStmt.run({ guildId, days });
        yield;
      }
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return yield* this.deleteOutdated(guildId, days);
      }
      throw e;
    }
  }

  vacuum() {
    db.pragma('incremental_vacuum');
  }
}

class WeeklyAwardConfig {
  #TABLE = 'post_target';

  static #isRow(row: unknown): row is WeeklyAwardConfigRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_id' in row && typeof row.channel_id === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('shows_rank_count' in row && typeof row.shows_rank_count === 'number')) return false;
    if (!('min_reacted' in row && typeof row.min_reacted === 'number')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  get records(): WeeklyAwardConfigRecord[] {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter(WeeklyAwardConfig.#isRow)
      .map(row => ({
        guildId: row.guild_id,
        guildName: row.guild_name,
        channelId: row.channel_id,
        channelName: row.channel_name,
        showsRankCount: row.shows_rank_count,
        minReacted: row.min_reacted,
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        guild_id text not null primary key,
        guild_name text not null,
        channel_id text not null,
        channel_name text not null,
        shows_rank_count integer not null,
        min_reacted integer not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  async register(guildId: string, guildName: string, channelId: string, channelName: string, showsRankCount: number, minReacted: number): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_id,
        channel_name,
        shows_rank_count,
        min_reacted
      ) values (
        @guildId,
        @guildName,
        @channelId,
        @channelName,
        @showsRankCount,
        @minReacted
      )
      on conflict (guild_id) do
        update set
          guild_name = @guildName,
          channel_id = @channelId,
          channel_name = @channelName,
          shows_rank_count = @showsRankCount,
          min_reacted = @minReacted,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ guildId, guildName, channelId, channelName, showsRankCount, minReacted });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, channelId, channelName, showsRankCount, minReacted);
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
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.unregister(guildId);
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
    if (!WeeklyAwardConfig.#isRow(row)) return null;

    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      channelId: row.channel_id,
      channelName: row.channel_name,
      showsRankCount: row.shows_rank_count,
      minReacted: row.min_reacted,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

class WeeklyAwardTime {
  #TABLE = 'times';

  static #isRow(row: unknown): row is WeeklyAwardTimeRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('weekday' in row && typeof row.weekday === 'number')) return false;
    if (!('hour' in row && typeof row.hour === 'number')) return false;
    if (!('minute' in row && typeof row.minute === 'number')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        guild_id text not null primary key,
        weekday integer not null,
        hour integer not null,
        minute integer not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  async set(guildId: string, weekday: Weekday, hour: number, minute: number): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        weekday,
        hour,
        minute
      ) values (
        @guildId,
        @weekday,
        @hour,
        @minute
      )
      on conflict (guild_id) do
        update set
          weekday = @weekday,
          hour = @hour,
          minute = @minute,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ guildId, weekday, hour, minute });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.set(guildId, weekday, hour, minute);
      }
      throw e;
    }
  }

  async delete(guildId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = ?
    `);

    try {
      stmt.run(guildId);
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId);
      }
      throw e;
    }
  }

  get(guildId: string): WeeklyAwardTimeRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (!WeeklyAwardTime.#isRow(row)) return null;

    return {
      guildId: row.guild_id,
      weekday: fromNumber(row.weekday),
      hour: row.hour,
      minute: row.minute,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

const _db = new WeeklyAward();
export { _db as db };
