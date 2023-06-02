import { Events, Message } from 'discord.js';
import { addHandler } from '../../listeners.js';
import { log } from '../../lib/log.js';
import { fetchMessageByIds, messageToEmbeds } from '../util.js';

const TRY_COUNT_THRESHOLD = 3;

/**
 * @param {Message} message
 * @param {string} guildId
 * @param {string} channelId
 * @param {string} messageId
 * @returns {Promise<import('discord.js').APIEmbed[]>}
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

  /** @type {Promise<import('discord.js').APIEmbed[]>[]} */
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

    try {
      await message.channel.send({ embeds: embeds.splice(0, 10) });

      while (embeds.length > 0) {
        await message.channel.send({ embeds: embeds.splice(0, 10) });
      }
    }
    catch (e) {
      if (e instanceof Error) {
        const to = [
          message.guild != null ? [message.guild.name] : [],
          'name' in message.channel ? [message.channel.name] : [],
        ].flat().join('/');
        log('discordUrlExpand:', `failed to send to ${to}`, e.stack ?? `${e.name}: ${e.message}`);
        return;
      }
      throw e;
    }
  }
});
