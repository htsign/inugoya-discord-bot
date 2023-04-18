import { APIEmbed, Events, Message } from 'discord.js';
import client from 'bot/client';
import { log } from '@lib/log';
import { fetchMessageByIds, messageToEmbeds } from '../util';

const TRY_COUNT_THRESHOLD = 3;

const core = async (message: Message, guildId: string, channelId: string, messageId: string): Promise<APIEmbed[]> => {
  for (let tryCount = 0; tryCount < TRY_COUNT_THRESHOLD; ++tryCount) {
    const referredMessage = await fetchMessageByIds(guildId, channelId, messageId);

    if (referredMessage != null) {
      return messageToEmbeds(referredMessage);
    }
    else {
      const insideOf = message.guild != null ? message.guild.name : message.author.username;
      log(`messageUrlExpand: ${insideOf}`, 'fetches failed', tryCount + 1, guildId, channelId, messageId);
    }
  }

  return [];
};

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || message.channel.isVoiceBased()) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  const embedPromises: Promise<APIEmbed[]>[] = [];

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
        message.guild != null ? [message.guild.id] : [],
        'name' in message.channel ? [message.channel.name] : [],
      ].flat().join('/'),
      'expand discord urls:',
      embeds.map(e => e.url),
    );

    message.channel.send({ embeds });
  }
});
