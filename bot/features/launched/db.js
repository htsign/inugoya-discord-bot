import { setTimeout } from 'node:timers/promises';
import Database from 'better-sqlite3';
import dayjs from '../../lib/dayjsSetup.js';

const db = new Database('launched.db');

class LaunchedConfig {
  #TABLE = 'config';

  /** @type {(row: unknown) => row is import('types/bot/features/launched').LaunchedConfigRow} */
  static #isRow(row) {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_id' in row && typeof row.channel_id === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  /** @type {import('types/bot/features/launched').LaunchedConfigRecord[]} */
  get records() {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter(LaunchedConfig.#isRow)
      .map(row => ({
        guildId: row.guild_id,
        guildName: row.guild_name,
        channelId: row.channel_id,
        channelName: row.channel_name,
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
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  /**
   * @param {string} guildId
   * @param {string} guildName
   * @param {string} channelId
   * @param {string} channelName
   * @returns {Promise<void>}
   */
  async register(guildId, guildName, channelId, channelName) {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_id,
        channel_name
      ) values (
        @guildId,
        @guildName,
        @channelId,
        @channelName
      )
      on conflict (guild_id) do
        update set
          guild_name = @guildName,
          channel_id = @channelId,
          channel_name = @channelName,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ guildId, guildName, channelId, channelName });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, channelId, channelName);
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
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.unregister(guildId);
      }
      stmt.run(guildId);
    }
  }

  /**
   * @param {string} guildId
   * @returns {import('types/bot/features/launched').LaunchedConfigRecord?}
   */
  get(guildId) {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (!LaunchedConfig.#isRow(row)) return null;

    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      channelId: row.channel_id,
      channelName: row.channel_name,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

const _db = new LaunchedConfig();
export { _db as db };
