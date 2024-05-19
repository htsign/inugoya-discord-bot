import { APIEmbed, AnyThreadChannel, Events, ChannelType, Message } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import client from 'bot/client';
import { addHandler } from 'bot/listeners';
import { dayjs } from '@lib/dayjsSetup';
import { log } from '@lib/log';
import { fetchMessageByIds, messageToEmbeds } from '../util';
import { db } from './db';
import { Weekday } from './weekday';
import type { MessageAndReactions, WeeklyAwardRecord } from 'types/bot/features/weeklyAwards';

/**
 * key is Guild ID, value is Timeout ID
 */
const instances = new Map<string, Timer>();

addHandler(Events.ClientReady, async () => {
  for (const { guildId } of db.config.records) {
    startAward(guildId);
  }

  log('weekly award is ready.');
});
addHandler(Events.GuildDelete, async guild => {
  await stopAward(guild.id);
  await Promise.all([
    db.deleteOutdated(guild.id, 0),
    db.times.delete(guild.id),
    db.config.unregister(guild.id),
  ]);
});
addHandler(Events.MessageReactionAdd, async (reaction, user) => {
  let message: Message<boolean>;
  try {
    message = await reaction.message.fetch();
  }
  catch (e) {
    if (e instanceof Error) {
      log('weeklyAward:', `failed to fetch message: reacted by ${user.username}`, e.stack ?? `${e.name}: ${e.message}`);
      return;
    }
    throw e;
  }
  const { author, reactions } = message;

  if (author.bot || !message.inGuild()) return;

  // do not record reactions count if message reacted is posted to not registered server
  if (db.config.get(message.guildId) == null) return;

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  await db.set(message, reactionsCount);
});
addHandler(Events.MessageReactionRemove, async (reaction, user) => {
  let message: Message<boolean>;
  try {
    message = await reaction.message.fetch();
  }
  catch (e) {
    if (e instanceof Error) {
      log('weeklyAward:', `failed to fetch message: react removed by ${user.username}`, e.stack ?? `${e.name}: ${e.message}`);
      return;
    }
    throw e;
  }
  const { author, reactions } = message;

  if (author.bot || !message.inGuild()) return;

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  if (reactionsCount > 0) {
    await db.set(message, reactionsCount);
  }
  else {
    await db.delete(message.guildId, message.channelId, message.id);
  }
});

const tick = async (
  guildId: string,
  guildName: string,
  channelId: string,
  channelName: string,
  showsRankCount: number,
  minReacted: number,
  weekday: Weekday,
  hour: number,
  minute: number,
): Promise<void> => {
  const now = dayjs().tz();

  if (now.day() === weekday && now.hour() === hour && now.minute() === minute) {
    log('WeeklyAward: report initiated', guildName);

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels?.cache?.find(channel => channel.id === channelId);

    if (channel?.type === ChannelType.GuildText) {
      // remove messages sent over a week ago
      for await (const count of db.deleteOutdated(guildId, 7)) {
        if (typeof count === 'number') {
          log(`WeeklyAward: outdated records [${count}]`, guildName);
        }
        else {
          db.vacuum();
          log('WeeklyAward: records deleted', guildName);
        }
      }

      if (db.all().some(({ reactionsCount: count }) => count > minReacted)) {
        const fetchesMessage = async (record: WeeklyAwardRecord): Promise<MessageAndReactions | null> => {
          if (record.guildId !== guildId) return null;

          const message = await fetchMessageByIds(guildId, record.channelId, record.messageId);
          return message != null ? { message, reactionsCount: record.reactionsCount } : null;
        };

        const fetchingPromises: Promise<MessageAndReactions | null>[] = [];

        // collect messages posted in current guild
        for (const record of db.iterate()) {
          if (record.reactionsCount < minReacted) continue;

          fetchingPromises.push(fetchesMessage(record));
        }

        const messages = (await Promise.all(fetchingPromises))
          .filter((x: MessageAndReactions | null): x is MessageAndReactions => x != null);

        // tally messages by reactions count
        const talliedMessages = messages
          .reduce<{ [count: number]: Message<true>[] }>((acc, { message, reactionsCount }) =>
            ({ ...acc, [reactionsCount]: [...acc[reactionsCount] ?? [], message] }), {});

        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a], [b]) => (+b) - (+a));

        const contents: { title: string, embeds: APIEmbed[] }[] = [];
        {
          let rank = 1;

          for (const [count, messages] of messagesArray.filter((_, i) => i < Math.min(messagesArray.length, showsRankCount))) {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;

            const embeds: APIEmbed[] = [];

            for (const message of messages) {
              embeds.push(...await messageToEmbeds(message, ['originalLink']));
            }
            contents.push({
              title: `**先週${rankText}リアクションが多かった投稿${messages.length >= 2 ? 'たち' : ''}です！！** [${count}個]`,
              embeds,
            });
            rank += messages.length;
          }
        }

        if (isNonEmpty(contents)) {
          const [{ title, embeds }, ...restContents] = contents;

          let firstMessage: Message<true>;
          try {
            firstMessage = await channel.send({ content: `**【リアクション大賞】**\n${title}`, embeds });
          }
          catch (e) {
            if (e instanceof Error) {
              log(`weeklyAward#${tick.name}:`, `failed to send to ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
              return;
            }
            throw e;
          }

          if (restContents.length > 0) {
            let thread: AnyThreadChannel;
            try {
              thread = await firstMessage.startThread({ name: 'リアクション大賞全体' });
            }
            catch (e) {
              if (e instanceof Error) {
                log(`weeklyAward#${tick.name}:`, `failed to start thread in ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
                if (firstMessage.thread == null) {
                  return;
                }
                else {
                  thread = firstMessage.thread;
                }
              }
              else {
                throw e;
              }
            }

            for (const { title, embeds } of restContents) {
              try {
                // attach upto 10 embeds per message because of discord api limitation
                await thread.send({ content: title, embeds: embeds.splice(0, 10) });

                while (embeds.length > 0) {
                  await thread.send({ embeds: embeds.splice(0, 10) });
                }
              }
              catch (e) {
                if (e instanceof Error) {
                  log(`weeklyAward#${tick.name}:`, `failed to send to ${guildName}/${thread.name}`, e.stack ?? `${e.name}: ${e.message}`);
                  continue;
                }
                throw e;
              }
            }
          }
        }
      }
      else {
        try {
          await channel.send('【リアクション大賞】\n先週はリアクションが付いた投稿はありませんでした！！');
        }
        catch (e) {
          if (e instanceof Error) {
            log(`weeklyAward#${tick.name}:`, `failed to send to ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
            return;
          }
          throw e;
        }
      }
    }

    log(guildName, 'WeeklyAward: report finished');

    // run again almost next week.
    const timeout = setTimeout(
      () => tick(guildId, guildName, channelId, channelName, showsRankCount, minReacted, weekday, hour, minute),
      86400 * 1000 * 6.9,
    );
    instances.set(guildId, timeout);
  }
  // or else, after 1 sec.
  else {
    const timeout = setTimeout(
      () => tick(guildId, guildName, channelId, channelName, showsRankCount, minReacted, weekday, hour, minute),
      1000,
    );
    instances.set(guildId, timeout);
  }
};

export const startAward = async (guildId: string): Promise<void> => {
  const configRecord = db.config.get(guildId);
  const timeRecord = db.times.get(guildId);
  if (configRecord == null || timeRecord == null) {
    return log(`startAward: ${{ guildId }} is not registered.`);
  }

  const { guildName, channelId, channelName, showsRankCount, minReacted, createdAt, updatedAt } = configRecord;
  const { weekday, hour, minute } = timeRecord;
  log('startAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  if (instances.has(guildId)) {
    await stopAward(guildId);
  }
  return tick(guildId, guildName, channelId, channelName, showsRankCount, minReacted, weekday, hour, minute);
};

export const stopAward = async (guildId: string): Promise<void> => {
  const configRecord = db.config.get(guildId);
  if (configRecord == null) {
    return await log(`stopAward: ${{ guildId }} is not registered.`);
  }

  const { createdAt, updatedAt } = configRecord;
  await log('stopAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  if (instances.has(guildId)) {
    clearTimeout(instances.get(guildId));
  }
};
