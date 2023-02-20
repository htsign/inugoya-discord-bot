import { Events, ChannelType, Message, APIEmbed } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import { dayjs } from '../../lib/dayjsSetup';
import client from '../../client';
import { log } from '../../lib/log';
import { fetchMessageByIds, messageToEmbeds } from '../util';
import { db } from './db';

const SUNDAY = 0;

/**
 * key is Guild ID, value is Timeout ID
 */
const instances = new Map<string, NodeJS.Timeout>();

client.once(Events.ClientReady, async () => {
  for (const { guildId } of db.config.records) {
    startAward(guildId);
  }

  log('weekly award is ready.');
});
client.on(Events.GuildDelete, async guild => {
  stopAward(guild.id);
  db.config.unregister(guild.id);
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot || !message.inGuild()) return;

  // do not record reactions count if message reacted is posted to not registered server
  if (db.config.get(message.guildId) == null) return;

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  db.set(message, reactionsCount);
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot || !message.inGuild()) return;

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  if (reactionsCount > 0) {
    db.set(message, reactionsCount);
  }
  else {
    db.delete(message.guildId, message.channelId, message.id);
  }
});

const tick = async (guildId: string, guildName: string, channelName: string): Promise<void> => {
  const now = dayjs().tz();

  if (now.day() === SUNDAY && now.hour() === 12 && now.minute() === 0) {
    const guilds = await client.guilds.fetch();
    const guild = await guilds.find(guild => guild.name === guildName)?.fetch();
    const channel = guild?.channels?.cache?.find(channel => channel.name === channelName);

    if (channel?.type === ChannelType.GuildText) {
      // remove messages sent over a week ago
      db.transaction([...db.iterate()], record => {
        if (now.diff(record.timestamp, 'days') >= 7) {
          db.delete(record.guildId, record.channelId, record.messageId);
        }
      });
      db.vacuum();

      if ([...db.iterate()].some(({ reactionsCount: count }) => count > 0)) {
        const messages: { message: Message<true>, reactionsCount: number }[] = [];

        // collect messages posted in current guild
        for (const record of db.iterate()) {
          if (record.guildId !== guildId) continue;

          const message = await fetchMessageByIds(guildId, record.channelId, record.messageId);
          if (message != null) messages.push({ message, reactionsCount: record.reactionsCount });
        }

        // tally messages by reactions count
        const talliedMessages = messages
          .reduce<{ [count: number]: Message<true>[] }>((acc, { message, reactionsCount }) =>
            ({ ...acc, [reactionsCount]: [...acc[reactionsCount] ?? [], message] }), {});

        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a, ], [b, ]) => (+b) - (+a));

        const contents: { title: string, embeds: APIEmbed[] }[] = [];
        {
          let rank = 1;

          // take 3 elements
          for (const [count, messages] of messagesArray.filter((_, i) => i < Math.min(messagesArray.length, 3))) {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;

            const embeds: APIEmbed[] = [];

            for (const message of messages) {
                  embeds.push(...await messageToEmbeds(message, false));
            }
            contents.push({
              title: `先週${rankText}リアクションが多かった投稿${messages.length >= 2 ? 'たち' : ''}です！！ [${count}個]`,
              embeds,
            });
            rank += messages.length;
          }
        }

        if (isNonEmpty(contents)) {
          const [firstContent, ...restContents] = contents;
          const firstMessage = await channel.send({ content: `【リアクション大賞】\n${firstContent.title}`, embeds: firstContent.embeds });

          if (restContents.length > 0) {
            const thread = await firstMessage.startThread({ name: 'リアクション大賞全体' });

            for (const content of restContents) {
              await thread.send({ content: content.title, embeds: content.embeds });
            }
          }
        }
      }
      else {
        await channel.send('【リアクション大賞】\n先週はリアクションが付いた投稿はありませんでした！！');
      }
    }

    // run again almost next week.
    const timeout = setTimeout(() => tick(guildId, guildName, channelName), 86400 * 1000 * 6.9);
    instances.set(guildId, timeout);
  }
  // or else, after 1 sec.
  else {
    const timeout = setTimeout(() => tick(guildId, guildName, channelName), 1000);
    instances.set(guildId, timeout);
  }
};

export const startAward = async (guildId: string): Promise<void> => {
  const configRecord = db.config.get(guildId);
  if (configRecord == null) {
    return log(`startAward: ${{ guildId }} is not registered.`);
  }

  const { guildName, channelName, createdAt, updatedAt } = configRecord;
  log('startAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  return tick(guildId, guildName, channelName);
};

export const stopAward = (guildId: string): void => {
  const configRecord = db.config.get(guildId);
  if (configRecord == null) {
    return log(`stopAward: ${{ guildId }} is not registered.`);
  }

  const { createdAt, updatedAt } = configRecord;
  log('stopAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  if (instances.has(guildId)) {
    clearTimeout(instances.get(guildId));
  }
};
