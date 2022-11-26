// @ts-check

/**
 * @typedef {import('discord.js').Message<T> | import('discord.js').PartialMessage} Message<T>
 * @template T
 */

const { Events, ChannelType } = require('discord.js');
const dayjs = require('./dayjsSetup.js');
const client = require('./client.js');
const { log } = require('./log.js');

/** @type {Map<Message<boolean>, number>} */
const messages = new Map();

client.once(Events.ClientReady, async () => {
  log('weekly award is ready.');
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot) return;
  if (dayjs().diff(dayjs(message.createdTimestamp), 'days') >= 7) return; // ignore messages sent over a week ago

  const reactionsCount = reactions.cache.reduce((acc, reaction) => acc + reaction.count, 0);
  messages.set(message, reactionsCount);
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot) return;

  if (!reactions.cache.first()) {
    messages.delete(message);
  }
});

const SUNDAY = 0;

const tick = async () => {
  const now = dayjs().tz();

  if (now.day() === SUNDAY && now.hour() === 0 && now.minute() === 0) {
    const guilds = await client.guilds.fetch();
    const server = await guilds.find(guild => guild.name === 'inugoya')?.fetch();
    const channels = server?.channels?.cache;
    const rootChannel = channels?.find(channel => channel.name === 'root');

    if (rootChannel?.type === ChannelType.GuildText) {
      if ([...messages.values()].some(count => count > 0)) {
        // sort descending order by reactions count
        const messagesArray = [...messages].sort(([, a], [, b]) => b - a);

        // take 3 elements
        for (let i = 0, len = Math.min(messagesArray.length, 3); i < len; ++i) {
          const [message, count] = messagesArray[i];
          
          const rankText = i === 0 ? '最も' : ` ${i + 1}番目に`;
          await rootChannel.send(`【リアクション大賞】
先週${rankText}リアクションが多かった投稿です！！ [${count}個]
${message.url}`);
        }
      }
      else {
        await rootChannel.send(`【リアクション大賞】
先週はリアクションが付いた投稿はありませんでした！！`);
      }
    }
    messages.clear();

    // run again almost next week.
    setTimeout(tick, 86400 * 6.9);
  }
  // or else, after 1 sec.
  else {
    setTimeout(tick, 1000);
  }
}
tick();
