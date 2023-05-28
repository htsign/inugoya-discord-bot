const { setTimeout } = require('node:timers/promises');
const dayjs = require('../../lib/dayjsSetup');
const { log } = require('../../lib/log');

const db = require('better-sqlite3')('hage.db');

class HageConfig {
  #TABLE = 'config';

  /** @type {HageKeyword} */
  #keywords;
  /** @type {HageReactionKeyword} */
  #reactionKeywords;

  /** @type {(row: unknown) => row is import('types/bot/features/hage').HageConfigRow} */
  static #isRow(row) {
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

  /** @type {import('types/bot/features/hage').HageConfigRecord[]} */
  get records() {
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

  get keywords() {
    return this.#keywords;
  }

  get reactionKeywords() {
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

  /**
   * @param {string} guildId
   * @param {string} guildName
   * @param {string} template
   * @param {string} moreTemplate
   * @param {string} rareTemplate
   * @param {number} timeout
   * @param {number} stackSize
   * @returns {Promise<void>}
   */
  async register(guildId, guildName, template, moreTemplate, rareTemplate, timeout, stackSize) {
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
   * @returns {import('types/bot/features/hage').HageConfigRecord?}
   */
  get(guildId) {
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

  /** @type {(row: unknown) => row is import('types/bot/features/hage').HageKeywordRow} */
  static #isRow(row) {
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

  /**
   * @param {string} guildId
   * @returns {import('types/bot/features/hage').HageKeywordRecord[]}
   */
  getRecords(guildId) {
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

  /**
   * @param {string} guildId
   * @param {string} keyword
   * @returns {Promise<void>}
   */
  async add(guildId, keyword) {
    if (this.get(guildId, keyword) != null) {
      return log('HageKeyword#add:', 'already added', guildId, keyword);
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

  /**
   * @param {string} guildId
   * @param {string} keyword
   * @returns {Promise<void>}
   */
  async delete(guildId, keyword) {
    if (this.get(guildId, keyword) == null) {
      return log('HageKeyword#delete:', 'not found', guildId, keyword);
    }

    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId and
        keyword  = @keyword
    `);

    try {
      stmt.run({ guildId, keyword });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId, keyword);
      }
      throw e;
    }
  }

  /**
   * @param {string} guildId
   * @returns {Promise<void>}
   */
  async deleteAll(guildId) {
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

  /**
   * @param {string} guildId
   * @param {string} keyword
   * @returns {import('types/bot/features/hage').HageKeywordRecord?}
   */
  get(guildId, keyword) {
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

  /** @type {(row: unknown) => row is import('types/bot/features/hage').HageReactionKeywordRow} */
  static #isRow(row) {
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

  /**
   * @param {string} guildId
   * @returns {import('types/bot/features/hage').HageReactionKeywordRecord[]}
   */
  getRecords(guildId) {
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

  /**
   * @param {string} guildId
   * @param {string} reaction
   * @returns {Promise<void>}
   */
  async add(guildId, reaction) {
    if (this.get(guildId, reaction) != null) {
      return log('HageReactionKeyword#add:', 'already added', guildId, reaction);
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

  /**
   * @param {string} guildId
   * @param {string} reaction
   * @returns {Promise<void>}
   */
  async delete(guildId, reaction) {
    if (this.get(guildId, reaction) == null) {
      return log('HageReactionKeyword#delete:', 'not found', guildId, reaction);
    }

    const stmt = db.prepare(`
      delete from ${this.#TABLE}
      where
        guild_id = @guildId and
        keyword  = @reaction
    `);

    try {
      stmt.run({ guildId, reaction });
    }
    catch (e) {
      if (e instanceof TypeError && e.message.includes('database connection is busy')) {
        await setTimeout();
        return this.delete(guildId, reaction);
      }
      throw e;
    }
  }

  /**
   * @param {string} guildId
   * @returns {Promise<void>}
   */
  async deleteAll(guildId) {
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

  /**
   * @param {string} guildId
   * @param {string} reaction
   * @returns {import('types/bot/features/hage').HageReactionKeywordRecord?}
   */
  get(guildId, reaction) {
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

exports.db = new HageConfig();
