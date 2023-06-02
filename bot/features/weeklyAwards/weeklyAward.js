import { Events, ChannelType } from 'discord.js';
import { isNonEmpty } from 'ts-array-length';
import dayjs from '../../lib/dayjsSetup.js';
import { addHandler } from '../../listeners.js';
import client from '../../client.js';
import { log } from '../../lib/log.js';
import { fetchMessageByIds, messageToEmbeds } from '../util.js';
import { db } from './db.js';

/**
 * @type {Map<string, NodeJS.Timeout>}
 * key is Guild ID, value is Timeout ID
 */
const instances = new Map();

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
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot || !message.inGuild()) return;

  // do not record reactions count if message reacted is posted to not registered server
  if (db.config.get(message.guildId) == null) return;

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  await db.set(message, reactionsCount);
});
addHandler(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
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

/**
 * @param {string} guildId
 * @param {string} guildName
 * @param {string} channelName
 * @param {number} showsRankCount
 * @param {number} minReacted
 * @param {import('./weekday').Weekday} weekday
 * @param {number} hour
 * @param {number} minute
 * @returns {Promise<void>}
 */
const tick = async (guildId, guildName, channelName, showsRankCount, minReacted, weekday, hour, minute) => {
  const now = dayjs().tz();

  if (now.day() === weekday && now.hour() === hour && now.minute() === minute) {
    log('WeeklyAward: report initiated', guildName);

    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels?.cache?.find(channel => channel.name === channelName);

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

      if (db.all().some(({ reactionsCount: count }) => count >= minReacted)) {
        /** @typedef {import('types/bot/features/weeklyAwards').MessageAndReactions} MessageAndReactions */

        /**
         * @param {import('types/bot/features/weeklyAwards').WeeklyAwardRecord} record
         * @returns {Promise<MessageAndReactions?>}
         */
        const fetchesMessage = async record => {
          if (record.guildId !== guildId) return null;

          const message = await fetchMessageByIds(guildId, record.channelId, record.messageId);
          return message != null ? { message, reactionsCount: record.reactionsCount } : null;
        };

        /** @type {Promise<MessageAndReactions | null>[]} */
        const fetchingPromises = [];

        // collect messages posted in current guild
        for (const record of db.iterate()) {
          if (record.reactionsCount < minReacted) continue;

          fetchingPromises.push(fetchesMessage(record));
        }

        const messages = (await Promise.all(fetchingPromises))
          .filter(/** @type {(x: MessageAndReactions?) => x is MessageAndReactions} */ x => x != null);

        // tally messages by reactions count
        const talliedMessages = messages
          .reduce((/** @type {{ [count: number]: import('discord.js').Message<true>[] }} */ acc, { message, reactionsCount }) =>
            ({ ...acc, [reactionsCount]: [...acc[reactionsCount] ?? [], message] }), {});
        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a], [b]) => (+b) - (+a));

        /** @type {{ title: string, embeds: import('discord.js').APIEmbed[] }[]} */
        const contents = [];
        {
          let rank = 1;

          for (const [count, messages] of messagesArray.filter((_, i) => i < Math.min(messagesArray.length, showsRankCount))) {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;

            /** @type {import('discord.js').APIEmbed[]} */
            const embeds = [];

            for (const message of messages) {
              embeds.push(...await messageToEmbeds(message, ['originalUrl']));
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

          /** @type {import('discord.js').Message<true>} */
          let firstMessage;
          try {
            firstMessage = await channel.send({ content: `**【リアクション大賞】**\n${title}`, embeds });
          }
          catch (e) {
            if (e instanceof Error) {
              log('weeklyAward#tick:', `failed to send to ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
              return;
            }
            throw e;
          }

          if (restContents.length > 0) {
            /** @type {import('discord.js').AnyThreadChannel} */
            let thread;
            try {
              thread = await firstMessage.startThread({ name: 'リアクション大賞全体' });
            }
            catch (e) {
              if (e instanceof Error) {
                log('weeklyAward#tick:', `failed to start thread in ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
                return;
              }
              throw e;
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
                  log('weeklyAward#tick:', `failed to send to ${guildName}/${thread.name}`, e.stack ?? `${e.name}: ${e.message}`);
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
            log('weeklyAward#tick:', `failed to send to ${guildName}/${channelName}`, e.stack ?? `${e.name}: ${e.message}`);
            return;
          }
          throw e;
        }
      }
    }

    log(guildName, 'WeeklyAward: report finished');

    // run again almost next week.
    const timeout = setTimeout(() => tick(guildId, guildName, channelName, showsRankCount, minReacted, weekday, hour, minute), 86400 * 1000 * 6.9);
    instances.set(guildId, timeout);
  }
  // or else, after 1 sec.
  else {
    const timeout = setTimeout(() => tick(guildId, guildName, channelName, showsRankCount, minReacted, weekday, hour, minute), 1000);
    instances.set(guildId, timeout);
  }
};

/**
 * @param {string} guildId
 * @returns {Promise<void>}
 */
export const startAward = async guildId => {
  const configRecord = db.config.get(guildId);
  const timeRecord = db.times.get(guildId);
  if (configRecord == null || timeRecord == null) {
    return log(`startAward: ${{ guildId }} is not registered.`);
  }

  const { guildName, channelName, showsRankCount, minReacted, createdAt, updatedAt } = configRecord;
  const { weekday, hour, minute } = timeRecord;
  log('startAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  if (instances.has(guildId)) {
    await stopAward(guildId);
  }
  return tick(guildId, guildName, channelName, showsRankCount, minReacted, weekday, hour, minute);
};

/**
 * @param {string} guildId
 * @returns {Promise<void>}
 */
export const stopAward = async guildId => {
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
