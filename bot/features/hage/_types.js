/**
 * @typedef HageConfigRecord
 * @property {string} guildId
 * @property {string} guildName
 * @property {string} template
 * @property {string} moreTemplate
 * @property {string} rareTemplate
 * @property {number} timeout
 * @property {number} stackSize
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef HageKeywordRecord
 * @property {number} id
 * @property {string} guildId
 * @property {string} keyword
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef HageReactionKeywordRecord
 * @property {number} id
 * @property {string} guildId
 * @property {string} reaction
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef HageConfigRow
 * @property {string} guild_id
 * @property {string} guild_name
 * @property {string} template
 * @property {string} more_template
 * @property {string} rare_template
 * @property {number} timeout
 * @property {number} stack_size
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef HageKeywordRow
 * @property {number} id
 * @property {string} guild_id
 * @property {string} keyword
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef HageReactionKeywordRow
 * @property {number} id
 * @property {string} guild_id
 * @property {string} reaction
 * @property {string} created_at
 * @property {string} updated_at
 */
