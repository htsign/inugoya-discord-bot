const { Events, ChannelType } = require('discord.js');
const dayjs = require('../../lib/dayjsSetup');
const client = require('../../client');
const { log } = require('../../lib/log');
const { fetchMessageByIds, messageToEmbeds } = require('../util');
const { db } = require('./db');

const SUNDAY = 0;

/**
 * @type {Map<string, NodeJS.Timeout>}
 * key is Guild ID, value is Timeout ID
 */
const instances = new Map();

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

/**
 * @param {string} guildId
 * @param {string} guildName
 * @param {string} channelName
 * @returns {Promise<void>}
 */
const tick = async (guildId, guildName, channelName) => {
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

      if ([...db.iterate()].some(({ reactionsCount: count }) => count > 0)) {
        /** @type {{ message: Message<true>, reactionsCount: number }[]} */
        const messages = [];

        for (const record of db.iterate()) {
          const message = await fetchMessageByIds(record.guildId, record.channelId, record.messageId);
          if (message != null) messages.push({ message, reactionsCount: record.reactionsCount });
        }

        // tally messages by reactions count
        const talliedMessages = messages
          .reduce((/** @type {{ [count: number]: Message<true>[] }} */ acc, { message, reactionsCount }) =>
            ({ ...acc, [reactionsCount]: [...acc[reactionsCount] ?? [], message] }), {});
        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a, ], [b, ]) => (+b) - (+a));

        /** @type {{ title: string, embeds: APIEmbed[] }[]} */
        const contents = [];
        {
          let rank = 1;

          // take 3 elements
          for (const [count, messages] of messagesArray.filter((_, i) => i < Math.min(messagesArray.length, 3))) {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;

            /** @type {APIEmbed[]} */
            const embeds = [];

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

        const [firstContent, ...restContents] = contents;
        const firstMessage = await channel.send({ content: `【リアクション大賞】\n${firstContent.title}`, embeds: firstContent.embeds });

        if (restContents.length > 0) {
          const thread = await firstMessage.startThread({ name: 'リアクション大賞全体' });

          for (const content of restContents) {
            await thread.send({ content: content.title, embeds: content.embeds });
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

/**
 * @param {string} guildId
 * @returns {Promise<void>}
 */
const startAward = guildId => {
  const configRecord = db.config.get(guildId);
  const { guildName, channelName, createdAt, updatedAt } = configRecord;
  log('startAward:', {
    ...configRecord,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  });

  return tick(guildId, guildName, channelName);
};

/**
 * @param {string} guildId
 */
const stopAward = guildId => {
  const configRecord = db.config.get(guildId);
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

module.exports = {
  startAward,
  stopAward,
};
