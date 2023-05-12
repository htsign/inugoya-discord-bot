const { Events, Message } = require('discord.js');
const { addHandler } = require('../../lib/listeners');
const { log } = require('../../lib/log');
const { fetchMessageByIds, messageToEmbeds } = require('../util');

const TRY_COUNT_THRESHOLD = 3;

/**
 * @param {Message} message
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 * @returns {Promise<APIEmbed[]>}
 */
const core = async (message, guildId, channelId, messageId) => {
  for (let tryCount = 0; tryCount < TRY_COUNT_THRESHOLD; ++tryCount) {
    const referredMessage = await fetchMessageByIds(guildId, channelId, messageId);

    if (referredMessage != null) {
      return messageToEmbeds(referredMessage, ['reactions']);
    }
    else {
      const insideOf = message.guild != null ? message.guild.name : message.author.username;
      log(`messageUrlExpand: ${insideOf}`, 'fetches failed', tryCount + 1, guildId, channelId, messageId);
    }
  }

  return [];
};

addHandler(Events.MessageCreate, async message => {
  if (message.author.bot || message.channel.isVoiceBased()) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  /** @type {Promise<APIEmbed[]>[]} */
  const embedPromises = [];

  for (const [, guildId, channelId, messageId] of regExpIterator) {
    if (guildId == null || channelId == null || messageId == null) {
      throw new Error('invalid url');
    }

    embedPromises.push(core(message, guildId, channelId, messageId));
  }

  const embeds = (await Promise.all(embedPromises)).flat();
  if (embeds.length > 0) {
    log(
      [
        message.guild != null ? [message.guild.name] : [],
        'name' in message.channel ? [message.channel.name] : [],
      ].flat().join('/'),
      'expand discord urls:',
      embeds.map(e => e.url),
    );

    message.channel.send({ embeds: embeds.splice(0, 10) });

    while (embeds.length > 0) {
      await message.channel.send({ embeds: embeds.splice(0, 10) });
    }
  }
});
