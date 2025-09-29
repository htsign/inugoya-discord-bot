import { setTimeout } from 'node:timers/promises';
import Database, { type Transaction } from 'better-sqlite3';
import type {
  HageConfigRecord,
  HageConfigRow,
  HageKeywordRecord,
  HageReactionKeywordRecord,
  HageReactionKeywordRow,
} from '../../../types/bot/features/hage.ts';
import dayjs from '../../lib/dayjsSetup.ts';
import { log } from '../../lib/log.ts';

const db = new Database('hage.db');

class HageConfig {
  #TABLE = 'config';

  #keywords: HageKeyword;
  #reactionKeywords: HageReactionKeyword;

  static #isRow(row: unknown): row is HageConfigRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('guild_name' in row && typeof row.guild_name === 'string')) return false;
    if (!('template' in row && typeof row.template === 'string')) return false;
    if (!('more_template' in row && typeof row.more_template === 'string')) return false;
    if (!('rare_template' in row && typeof row.rare_template === 'string')) return false;
    if (!('timeout' in row && typeof row.timeout === 'number')) return false;
    if (!('stack_size' in row && typeof row.stack_size === 'number')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  get records(): HageConfigRecord[] {
    const stmt = db.prepare(`select * from ${this.#TABLE}`);

    const rows = stmt.all();
    return rows
      .filter(HageConfig.#isRow)
      .map(row => ({
        guildId: row.guild_id,
        guildName: row.guild_name,
        template: row.template,
        moreTemplate: row.more_template,
        rareTemplate: row.rare_template,
        timeout: row.timeout,
        stackSize: row.stack_size,
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  get keywords(): HageKeyword {
    return this.#keywords;
  }

  get reactionKeywords(): HageReactionKeyword {
    return this.#reactionKeywords;
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        guild_id text not null primary key,
        guild_name text not null,
        template text not null,
        more_template text not null,
        rare_template text not null,
        timeout integer not null,
        stack_size integer not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();

    this.#keywords = new HageKeyword();
    this.#reactionKeywords = new HageReactionKeyword();
  }

  async register(
    guildId: string,
    guildName: string,
    template: string,
    moreTemplate: string,
    rareTemplate: string,
    timeout: number,
    stackSize: number,
  ): Promise<void> {
    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        guild_name,
        template,
        more_template,
        rare_template,
        timeout,
        stack_size
      ) values (
        @guildId,
        @guildName,
        @template,
        @moreTemplate,
        @rareTemplate,
        @timeout,
        @stackSize
      )
      on conflict (guild_id) do
        update set
          guild_name = @guildName,
          template = @template,
          more_template = @moreTemplate,
          rare_template = @rareTemplate,
          timeout = @timeout,
          stack_size = @stackSize,
          updated_at = datetime('now')
    `);

    try {
      stmt.run({ guildId, guildName, template, moreTemplate, rareTemplate, timeout, stackSize });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.register(guildId, guildName, template, moreTemplate, rareTemplate, timeout, stackSize);
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

  get(guildId: string): HageConfigRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    const row = stmt.get(guildId);
    if (!HageConfig.#isRow(row)) return null;

    return {
      guildId: row.guild_id,
      guildName: row.guild_name,
      template: row.template,
      moreTemplate: row.more_template,
      rareTemplate: row.rare_template,
      timeout: row.timeout,
      stackSize: row.stack_size,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    };
  }
}

class HageKeyword {
  #TABLE = 'keywords';

  static #isRow(row: unknown): row is import('types/bot/features/hage').HageKeywordRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('id' in row && typeof row.id === 'number')) return false;
    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('keyword' in row && typeof row.keyword === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        id integer not null primary key,
        guild_id text not null,
        keyword text not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  getRecords(guildId: string): HageKeywordRecord[] {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    return stmt.all(guildId)
      .filter(HageKeyword.#isRow)
      .map(row => ({
        id: row.id,
        guildId: row.guild_id,
        keyword: row.keyword,
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  async add(guildId: string, keyword: string): Promise<void> {
    if (this.get(guildId, keyword) != null) {
      return log(`${HageKeyword.name}#${this.add.name}:`, 'already added', guildId, keyword);
    }

    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        keyword
      ) values (
        @guildId,
        @keyword
      )
    `);

    try {
      stmt.run({ guildId, keyword });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.add(guildId, keyword);
      }
      throw e;
    }
  }

  async delete(guildId: string, ...keywords: string[]): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId and
        keyword  = @keyword
    `);

    const deleteKeywords: Transaction<(keywords: string[]) => void> = db.transaction(keywords => {
      for (const keyword of keywords) {
        if (this.get(guildId, keyword) == null) {
          return log(`${HageKeyword.name}#${this.delete.name}:`, 'not found', guildId, keyword);
        }

        stmt.run({ guildId, keyword });
      }
      return;
    });

    try {
      deleteKeywords(keywords);
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId, ...keywords);
      }
      throw e;
    }
  }

  async deleteAll(guildId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId
    `);

    try {
      stmt.run({ guildId });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.deleteAll(guildId);
      }
      throw e;
    }
  }

  get(guildId: string, keyword: string): HageKeywordRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = @guildId and
        keyword  = @keyword
    `);

    const row = stmt.get({ guildId, keyword });
    if (!HageKeyword.#isRow(row)) return null;

    return {
      id: row.id,
      guildId,
      keyword,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    }
  }
}

class HageReactionKeyword {
  #TABLE = 'reaction_keywords';

  static #isRow(row: unknown): row is HageReactionKeywordRow {
    if (row == null || typeof row !== 'object') return false;

    if (!('id' in row && typeof row.id === 'number')) return false;
    if (!('guild_id' in row && typeof row.guild_id === 'string')) return false;
    if (!('reaction' in row && typeof row.reaction === 'string')) return false;
    if (!('created_at' in row && typeof row.created_at === 'string')) return false;
    if (!('updated_at' in row && typeof row.updated_at === 'string')) return false;

    return true;
  }

  constructor() {
    db.prepare(`
      create table if not exists ${this.#TABLE} (
        id integer not null primary key,
        guild_id text not null,
        reaction text not null,
        created_at text not null default (datetime('now')),
        updated_at text not null default (datetime('now'))
      )
    `).run();
  }

  getRecords(guildId: string): HageReactionKeywordRecord[] {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = ?
    `);

    return stmt.all(guildId)
      .filter(HageReactionKeyword.#isRow)
      .map(row => ({
        id: row.id,
        guildId: row.guild_id,
        reaction: row.reaction,
        createdAt: dayjs.utc(row.created_at).tz(),
        updatedAt: dayjs.utc(row.updated_at).tz(),
      }));
  }

  async add(guildId: string, reaction: string): Promise<void> {
    if (this.get(guildId, reaction) != null) {
      return log(`${HageReactionKeyword.name}#${this.add.name}:`, 'already added', guildId, reaction);
    }

    const stmt = db.prepare(`
      insert into ${this.#TABLE} (
        guild_id,
        reaction
      ) values (
        @guildId,
        @reaction
      )
    `);

    try {
      stmt.run({ guildId, reaction });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.add(guildId, reaction);
      }
      throw e;
    }
  }

  async delete(guildId: string, ...reactions: string[]): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId and
        reaction = @reaction
    `);

    const deleteReactions: Transaction<(reactions: string[]) => void> = db.transaction(reactions => {
      for (const reaction of reactions) {
        if (this.get(guildId, reaction) == null) {
          return log(`${HageReactionKeyword.name}#${this.delete.name}:`, 'not found', guildId, reaction);
        }

        stmt.run({ guildId, reaction });
      }
      return;
    });

    try {
      deleteReactions(reactions);
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId, ...reactions);
      }
      throw e;
    }
  }

  async deleteAll(guildId: string): Promise<void> {
    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId
    `);

    try {
      stmt.run({ guildId });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.deleteAll(guildId);
      }
      throw e;
    }
  }

  get(guildId: string, reaction: string): HageReactionKeywordRecord | null {
    const stmt = db.prepare(`
      select *
      from ${this.#TABLE}
      where
        guild_id = @guildId and
        reaction  = @reaction
    `);

    const row = stmt.get({ guildId, reaction });
    if (!HageReactionKeyword.#isRow(row)) return null;

    return {
      id: row.id,
      guildId,
      reaction,
      createdAt: dayjs.utc(row.created_at).tz(),
      updatedAt: dayjs.utc(row.updated_at).tz(),
    }
  }
}

const _db = new HageConfig();
export { _db as db };
