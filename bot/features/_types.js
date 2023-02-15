/** @typedef {import('discord.js').Channel} Channel */
/**
 * @typedef {import('discord.js').Message<InGuild> | import('discord.js').PartialMessage} Message<InGuild>
 * @template {boolean} InGuild
 */

/** @typedef {import('discord.js').Snowflake} Snowflake */
/** @typedef {import('discord.js').APIEmbed} APIEmbed */
/** @typedef {import('discord.js').APIEmbedField} APIEmbedField */

/** @typedef {import('discord.js').CacheType} CacheType */
/**
 * @typedef {import('discord.js').Interaction<TCacheType>} Interaction<TCacheType>
 * @template {CacheType} TCacheType
 */
/**
 * @typedef {import('discord.js').ChatInputCommandInteraction<TCacheType>} ChatInputCommandInteraction<TCacheType>
 * @template {CacheType} TCacheType
 */
/** @typedef {import('discord.js').ChatInputApplicationCommandData} ChatInputApplicationCommandData */
/**
 * @typedef {(interaction: ChatInputCommandInteraction<TCacheType>) => Promise<void>} ChatInputCommandFunction<TCacheType>
 * @template {CacheType=} [TCacheType=CacheType]
 */

/** @typedef {import('discord.js').VoiceState} VoiceState */

/**
 * @typedef {{
 *   [commandName: string]: Omit<ChatInputApplicationCommandData, 'name'> & { func: ChatInputCommandFunction<TCacheType> }
 * }} ChatInputCommand
 * @template {CacheType=} [TCacheType=CacheType]
 */
