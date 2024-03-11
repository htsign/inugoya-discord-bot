import { setTimeout } from 'node:timers/promises';
import Database from 'better-sqlite3';
import dayjs from '../../lib/dayjsSetup.js';

const db = new Database('earthquake.db');

class EEWConfig {
  #TABLE = 'post_target';

  /** @type {(row: unknown) => row is import('types/bot/features/earthquake').EEWConfigRow} */
  static #isRow(row) {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_id' in row && typeof row.channel_id === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('min_intensity' in row && typeof row.min_intensity === 'number')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  /** @type {import('types/bot/features/earthquake').EEWConfigRecord[]} */
  get records() {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter(EEWConfig.#isRow)
      .map(row => ({
        guildId: row.guild_id,
        guildName: row.guild_name,
        channelId: row.channel_id,
        channelName: row.channel_name,
        minIntensity: row.min_intensity,
        alertThreshold: row.alert_threshold,
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
        min_intensity integer not null,
        alert_threshold integer not null,
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
   * @param {number} minIntensity
   * @param {number} alertThreshold
   * @returns {Promise<void>}
   */
  async register(guildId, guildName, channelId, channelName, minIntensity, alertThreshold) {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_id,
        channel_name,
        min_intensity,
        alert_threshold
      ) values (
        @guildId,
        @guildName,
        @channelId,
        @channelName,
        @minIntensity,
        @alertThreshold
      )
      on conflict (guild_id) do
        update set
          guild_name = @guildName,
          channel_id = @channelId,
          channel_name = @channelName,
          min_intensity = @minIntensity,
          alert_threshold = @alertThreshold,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ guildId, guildName, channelId, channelName, minIntensity, alertThreshold });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, channelId, channelName, minIntensity, alertThreshold);
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
      throw e;
    }
  }

  /**
   * @param {string} guildId
   * @returns {import('types/bot/features/earthquake').EEWConfigRecord?}
   */
  get(guildId) {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (!EEWConfig.#isRow(row)) return null;

    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      channelId: row.channel_id,
      channelName: row.channel_name,
      minIntensity: row.min_intensity,
      alertThreshold: row.alert_threshold,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

class GeoCoding {
  #TABLE = 'geocoding';

  /** @type {(row: unknown) => row is import('types/bot/features/earthquake').GeoCodingRow} */
  static #isRow(row) {
    if (row == null || typeof row !== 'object') return false;

    if (!('prefecture' in row && typeof row.prefecture === 'string')) return false;
    if (!('address' in row && typeof row.address === 'string')) return false;
    if (!('latitude' in row && typeof row.latitude === 'number')) return false;
    if (!('longitude' in row && typeof row.longitude === 'number')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  /** @type {import('types/bot/features/earthquake').GeoCodingRecord[]} */
  get records() {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter(GeoCoding.#isRow)
      .map(row => ({
        prefecture: row.prefecture,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        prefecture text not null,
        address text not null,
        latitude real not null,
        longitude real not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now')),
        primary key (prefecture, address)
      )
    `).run();
  }

  /**
   * @param {string} prefecture
   * @param {string} address
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<void>}
   */
  async add(prefecture, address, latitude, longitude) {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        prefecture,
        address,
        latitude,
        longitude
      ) values (
        @prefecture,
        @address,
        @latitude,
        @longitude
      )
      on conflict (prefecture, address) do
        update set
          latitude = @latitude,
          longitude = @longitude,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ prefecture, address, latitude, longitude });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.add(prefecture, address, latitude, longitude);
      }
      throw e;
    }
  }

  /**
   * @param {string} prefecture
   * @param {string} address
   * @param {number} [timeoutDays=50]
   * @returns {import('types/bot/features/earthquake').GeoCodingRecord?}
   */
  get(prefecture, address, timeoutDays = 50) {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        prefecture = @prefecture
        and address = @address
        and julianday(datetime('now')) - julianday(updated_at) < @timeoutDays
    `);

    const row = stmt.get({ prefecture, address, timeoutDays });
    if (!GeoCoding.#isRow(row)) return null;

    return {
      prefecture: row.prefecture,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

const eewConfig = new EEWConfig();
const geoCoding = new GeoCoding();
export {
  eewConfig as db,
  geoCoding,
};
