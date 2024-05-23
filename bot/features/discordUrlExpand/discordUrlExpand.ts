import { log } from '@lib/log';
import { addHandler } from 'bot/listeners';
import { type APIEmbed, Events, type Message } from 'discord.js';
import { fetchMessageByIds, messageToEmbeds } from '../util';

const TRY_COUNT_THRESHOLD = 3;

const core = async (message: Message, guildId: string, channelId: string, messageId: string): Promise<APIEmbed[]> => {
  for (let tryCount = 0; tryCount < TRY_COUNT_THRESHOLD; ++tryCount) {
    const referredMessage = await fetchMessageByIds(guildId, channelId, messageId);

    if (referredMessage != null) {
      return messageToEmbeds(referredMessage, ['reactions']);
    }

    const insideOf = message.guild != null ? message.guild.name : message.author.username;
    log(`discordUrlExpand#${core.name}: ${insideOf}`, 'fetches failed', tryCount + 1, guildId, channelId, messageId);
  }

  return [];
};

addHandler(Events.MessageCreate, async message => {
  const { guild, channel, author, content } = message;

  if (author.bot || channel.isVoiceBased()) return;

  const sendTo = [
    guild != null ? [guild.name] : [],
    'name' in channel ? [channel.name] : [],
  ].flat().join('/');

  const regExpIterator = content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  const embedPromises: Promise<APIEmbed[]>[] = [];

  for (const [, guildId, channelId, messageId] of regExpIterator) {
    if (guildId == null || channelId == null || messageId == null) {
      throw new Error('invalid url');
    }

    embedPromises.push(core(message, guildId, channelId, messageId));
  }

  const embeds = (await Promise.all(embedPromises)).flat();
  if (embeds.length > 0) {
    log(`expand discord urls[${sendTo}]:`, embeds.map(e => e.url));

    try {
      await channel.send({ embeds: embeds.splice(0, 10) });

      while (embeds.length > 0) {
        await channel.send({ embeds: embeds.splice(0, 10) });
      }
    }
    catch (e) {
      if (e instanceof Error) {
        log(`discordUrlExpand[${sendTo}]:`, 'failed to send', e.stack ?? `${e.name}: ${e.message}`);
        return;
      }
      throw e;
    }
  }
});
