/** @typedef {0 | 1 | 2 | 3 | 4 | 5 | 6} Weekday */

/**
 * @typedef MessageAndReactions
 * @property {Message<true>} message
 * @property {number} reactionsCount
 */

/**
 * @typedef WeeklyAwardRecord
 * @property {string} guildId
 * @property {string} channelId
 * @property {string} messageId
 * @property {string} guildName
 * @property {string} channelName
 * @property {string} content
 * @property {string} author
 * @property {Url} url
 * @property {number} reactionsCount
 * @property {Dayjs} timestamp
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef WeeklyAwardConfigRecord
 * @property {string} guildId
 * @property {string} guildName
 * @property {string} channelId
 * @property {string} channelName
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef WeeklyAwardTimeRecord
 * @property {string} guildId
 * @property {Weekday} weekday
 * @property {number} hour
 * @property {number} minute
 * @property {Dayjs} createdAt
 * @property {Dayjs} updatedAt
 */

/**
 * @typedef WeeklyAwardDatabaseRow
 * @property {string} guild_id
 * @property {string} channel_id
 * @property {string} message_id
 * @property {string} guild_name
 * @property {string} channel_name
 * @property {string} content
 * @property {string} author
 * @property {Url} url
 * @property {number} reactions_count
 * @property {string} timestamp
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef WeeklyAwardConfigRow
 * @property {string} guild_id
 * @property {string} guild_name
 * @property {string} channel_id
 * @property {string} channel_name
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef WeeklyAwardTimeRow
 * @property {string} guild_id
 * @property {number} weekday
 * @property {number} hour
 * @property {number} minute
 * @property {string} created_at
 * @property {string} updated_at
 */
