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
        content text not null,
        author text not null,
        url text not null,
        reactions_count integer not null,
        timestamp text not null,
        primary key (guild_id, channel_id, message_id)
      )
    `).run();
  }

  /**
   * @param {string} guildId
   * @param {string} channelId
   * @param {string} messageId
   * @returns {WeeklyAwardRecord}
   */
  get(guildId, channelId, messageId) {
    const stmt = db.prepare(`
      select
        content,
        author,
        url,
        reactions_count,
        timestamp
      from ${TABLE}
      where
        guild_id   = @guildId,
        channel_id = @channelId,
        message_id = @messageId
    `);

    const row = stmt.get({ guildId, channelId, messageId });
    return {
      guildId,
      channelId,
      messageId,
      content: row.content,
      author: row.author,
      url: row.url,
      reactionsCount: row.reactions_count,
      timestamp: dayjs(row.timestamp).tz(),
    };
  }

  /**
   * @param {Message<true>} message
   * @param {number} reactionsCount
   */
  set(message, reactionsCount) {
    const stmt = db.prepare(`
      insert into ${TABLE} (
        guild_id,
        channel_id,
        message_id,
        content,
        author,
        url,
        reactions_count,
        timestamp
      ) values (
        @guildId,
        @channelId,
        @messageId,
        @content,
        @author,
        @url,
        @reactionsCount,
        @timestamp
      )
      on conflict (guild_id, channel_id, message_id) do
        update set
          content = @content,
          reactions_count = @reactionsCount
    `);

    stmt.run({
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      content: message.content,
      author: message.author?.username ?? '',
      url: message.url,
      reactionsCount,
      timestamp: dayjs(message.createdTimestamp).utc().toISOString(),
    });
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
        content: row.content,
        author: row.author,
        url: row.url,
        reactionsCount: row.reactions_count,
        timestamp: dayjs(row.timestamp).tz(),
      };
    }
  }

  /**
   * @param {T[]} values
   * @param {function(T): void} callback
   * @template T
   */
  transaction(values, callback) {
    /** @type {Transaction<(values: T[]) => void>} */
    const fn = db.transaction(values => values.forEach(callback));

    fn(values);
  }

  /**
   * @param {string} guildId
   * @param {string} channelId
   * @param {string} messageId
   */
  delete(guildId, channelId, messageId) {
    const stmt = db.prepare(`
      delete from ${TABLE}
      where
        guild_id   = @guildId,
        channel_id = @channelId,
        message_id = @messageId
    `);

    stmt.run({ guildId, channelId, messageId });
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
      createdAt: dayjs(row.createed_at).tz(),
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
   */
  register(guildId, guildName, channelName) {
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

  /**
   * @param {string} guildId
   */
  unregister(guildId) {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = ?
    `);

    stmt.run(guildId);
  }

  /**
   * @param {string} guildId
   * @returns {WeeklyAwardConfigRecord}
   */
  get(guildId) {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where guild_id = ?
    `);

    const row = stmt.get(guildId);
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