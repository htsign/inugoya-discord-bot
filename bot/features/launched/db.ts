import { setTimeout } from 'node:timers/promises';
import { Database } from 'bun:sqlite';
import { dayjs } from '../../lib/dayjsSetup';
import type { LaunchedConfigRecord, LaunchedConfigRow } from 'types/bot/features/launched';

const db = new Database('launched.db', { readwrite: true, create: true });

class LaunchedConfig {
  #TABLE = 'config';

  static #isRow(row: unknown): row is LaunchedConfigRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('channel_id' in row && typeof row.channel_id === 'string')) return false;
    if (!('channel_name' in row && typeof row.channel_name === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  get records(): LaunchedConfigRecord[] {
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

  async register(guildId: string, guildName: string, channelId: string, channelName: string): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        channel_id,
        channel_name
      ) values (
        $guildId,
        $guildName,
        $channelId,
        $channelName
      )
      on conflict (guild_id) do
        update set
          guild_name = $guildName,
          channel_id = $channelId,
          channel_name = $channelName,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({
        $guildId: guildId,
        $guildName: guildName,
        $channelId: channelId,
        $channelName: channelName,
      });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, channelId, channelName);
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
      stmt.run(guildId);
    }
  }

  get(guildId: string): LaunchedConfigRecord | null {
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
