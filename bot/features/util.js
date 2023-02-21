const { EmbedBuilder, Colors } = require("discord.js");
const fastAvgColor = require('fast-average-color-node');
const client = require("../client");
const { log } = require("../lib/log");

/**
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 * @returns {Promise<Message<true>?>}
 */
const fetchMessageByIds = async (guildId, channelId, messageId) => {
  try {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      return channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);
    }
    return null;
  }
  catch (e) {
    if (e instanceof Error) {
      log(e.stack ?? `${e.name}: ${e.message}`);
      return null;
    }
    else {
      throw e;
    }
  }
};

/**
 * @param {Message<boolean>} message
 * @param {boolean=} [addReactionField=true]
 * @returns {Promise<APIEmbed[]>}
 */
const messageToEmbeds = async (message, addReactionField = true) => {
  const { channel } = message;

  if (channel.isTextBased()) {

    /** @type {APIEmbed[]} */
    const embeds = [];

    const author = await message.author?.fetch();

    /** @type {(avatarUrl: string | null | undefined) => Promise<number | null>} */
    const getAverageColor = async avatarUrl => {
      if (avatarUrl == null) return null;

      const { value: [red, green, blue] } = await fastAvgColor.getAverageColor(avatarUrl, { silent: true });
      return (red << 16) + (green << 8) + blue;
    };

    const embed = new EmbedBuilder()
      .setURL(message.url)
      .setTimestamp(message.editedTimestamp ?? message.createdTimestamp)
      .setColor(author?.accentColor ?? await getAverageColor(author?.avatarURL()) ?? Colors.Default);

    if (author != null) {
      embed.setAuthor({ name: author.username, url: message.url, iconURL: author.displayAvatarURL() });
    }

    if (message.content !== '') {
      embed.setDescription(message.content);
    }

    if (addReactionField) {
      /** @type {APIEmbedField[]} */
      const fields = [];

      const reactions = message.reactions.cache;
      const reactionsCount = reactions.reduce((acc, x) => acc + x.count, 0);

      if (reactionsCount > 0) {
        fields.push({ name: 'Reactions', value: String(reactionsCount) });
      }

      embed.setFields(...fields);
    }

    if (!channel.isDMBased()) {
      const text = channel.name;
      const iconURL = message.guild?.iconURL();

      if (iconURL != null) {
        embed.setFooter({ text, iconURL });
      }
      else {
        embed.setFooter({ text });
      }
    }

    embeds.push(embed.toJSON());

    for (const attachment of message.attachments.values()) {
      embeds.push({ url: message.url, image: { url: attachment.url } });
    }

    return embeds;
  }
  else {
    return [];
  }
};

module.exports = {
  fetchMessageByIds,
  messageToEmbeds,
};
