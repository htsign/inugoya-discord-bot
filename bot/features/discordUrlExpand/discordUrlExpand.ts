import { APIEmbed, Events, Message } from 'discord.js';
import { addHandler } from 'bot/listeners';
import { log } from '@lib/log';
import { fetchMessageByIds, messageToEmbeds } from '../util';

const TRY_COUNT_THRESHOLD = 3;

const core = async (message: Message, guildId: string, channelId: string, messageId: string): Promise<APIEmbed[]> => {
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
