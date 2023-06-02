import { setTimeout } from 'node:timers/promises';
import { Database } from 'bun:sqlite';
import { dayjs } from '../../lib/dayjsSetup.js';
import type { EEWConfigRecord, EEWConfigRow } from 'types/bot/features/earthquake';

const db = new Database('earthquake.db', { readwrite: true, create: true });

class EEWConfig {
  #TABLE = 'post_target';

  static #isRow(row: unknown): row is EEWConfigRow {
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

  get records(): EEWConfigRecord[] {
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
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  async register(guildId: string, guildName: string, channelId: string, channelName: string, minIntensity: number): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_id,
        channel_name,
        min_intensity
      ) values (
        $guildId,
        $guildName,
        $channelId,
        $channelName,
        $minIntensity
      )
      on conflict (guild_id) do
        update set
          guild_name = $guildName,
          channel_id = $channelId,
          channel_name = $channelName,
          min_intensity = $minIntensity,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({
        $guildId: guildId,
        $guildName: guildName,
        $channelId: channelId,
        $channelName: channelName,
        $minIntensity: minIntensity,
      });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, channelId, channelName, minIntensity);
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

  get(guildId: string): EEWConfigRecord | null {
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
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

const _db = new EEWConfig();
export { _db as db };
