const { setTimeout } = require('node:timers/promises');
const dayjs = require('../../lib/dayjsSetup');

const db = require('better-sqlite3')('weeklyAward.db');

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
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now')),
        primary key (guild_id, channel_id, message_id)
      )
    `).run();
  }

  /**
   * @param {string} guildId
   * @param {string} channelId
   * @param {string} messageId
   * @returns {WeeklyAwardRecord?}
   */
  get(guildId, channelId, messageId) {
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
      createdAt: dayjs(row.created_at).tz(),
      updatedAt: dayjs(row.updated_at).tz(),
    };
  }

  /**
   * @param {Message<true>} message
   * @param {number} reactionsCount
   * @returns {Promise<void>}
   */
  async set(message, reactionsCount) {
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
      if (e instanceof TypeError) {
        if (e.message.includes('database connection is busy')) {
          await setTimeout();
          return this.set(message, reactionsCount);
        }
      }
      throw e;
    }
  }

  /**
   * @returns {Generator<WeeklyAwardRecord>}
   */
  *iterate() {
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
        createdAt: dayjs(row.created_at).tz(),
        updatedAt: dayjs(row.updated_at).tz(),
      };
    }
  }

  /**
   * @param {T[]} values
   * @param {function(T): void} callback
   * @returns {Promise<void>}
   * @template T
   */
  async transaction(values, callback) {
    /** @type {Transaction<(values: T[]) => void>} */
    const fn = db.transaction(values => values.forEach(callback));

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

  /**
   * @param {string} guildId
   * @param {string} channelId
   * @param {string} messageId
   * @returns {Promise<void>}
   */
  async delete(guildId, channelId, messageId) {
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

  /**
   * @param {string} guildId
   * @param {number} days
   * @returns {Promise<void>}
   */
  async deleteOutdated(guildId, days) {
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

  vacuum() {
    db.pragma('incremental_vacuum');
  }
}

class WeeklyAwardDatabaseConfig {
  #TABLE = 'post_target';

  /** @type {WeeklyAwardConfigRecord[]} */
  get records() {
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

  /**
   * @param {string} guildId
   * @param {string} guildName
   * @param {string} channelName
   * @returns {Promise<void>}
   */
  async register(guildId, guildName, channelName) {
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

    try {
      stmt.run({ guildId, guildName, channelName });
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

  /**
   * @param {string} guildId
   * @returns {Promise<void>}
   */
  async unregister(guildId) {
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

  /**
   * @param {string} guildId
   * @returns {WeeklyAwardConfigRecord?}
   */
  get(guildId) {
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

exports.db = new WeeklyAwardDatabase();
