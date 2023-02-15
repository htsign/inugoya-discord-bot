const { Events, ChannelType } = require('discord.js');
const GraphemeSplitter = require('grapheme-splitter');
const dayjs = require('../../lib/dayjsSetup');
const client = require('../../client');
const { log } = require('../../lib/log');
const { db } = require('./db');

const SUNDAY = 0;
const CONTENT_MAX_LENGTH = 20;

const splitter = new GraphemeSplitter();

client.once(Events.ClientReady, async () => {
  log('weekly award is ready.');
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

const tick = async () => {
  const now = dayjs().tz();

  if (now.day() === SUNDAY && now.hour() === 12 && now.minute() === 0) {
    const guilds = await client.guilds.fetch();
    const server = await guilds.find(guild => guild.name === 'inugoya')?.fetch();
    const channels = server?.channels?.cache;
    const rootChannel = channels?.find(channel => channel.name === 'root');

    if (rootChannel?.type === ChannelType.GuildText) {
      /** @type {function(APIEmbed): Promise<Message<true>>} */
      const sendEmbed = options => rootChannel.send({ embeds: [{ title: 'リアクション大賞', ...options }]});

      // remove messages sent over a week ago
      db.transaction([...db.iterate()], record => {
        if (now.diff(record.timestamp, 'days') >= 7) {
          db.delete(record.guildId, record.channelId, record.messageId);
        }
      });

      if ([...db.iterate()].some(({ reactionsCount: count }) => count > 0)) {
        // tally messages by reactions count
        const talliedMessages = [...db.iterate()]
          .reduce((/** @type {{ [count: number]: WeeklyAwardRecord[] }} */ acc, record) =>
            ({ ...acc, [record.reactionsCount]: [...acc[record.reactionsCount] ?? [], record] }), {});
        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a, ], [b, ]) => (+b) - (+a));

        const { fields } = messagesArray
        // take 3 elements
          .filter((_, i) => i < Math.min(messagesArray.length, 3))
          // create fields
          .reduce((/** @type {{ fields: APIEmbedField[], rank: number }} */ { fields, rank }, [count, records]) => {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;
            const createContent = (/** @type {WeeklyAwardRecord} */ record) => {
              const chars = splitter.splitGraphemes(record.content ?? '');
              return chars.length > CONTENT_MAX_LENGTH ? chars.slice(0, CONTENT_MAX_LENGTH - 1).join('') + '…' : chars.join('');
            };
            return {
              fields: fields.concat({
                name: `先週${rankText}リアクションが多かった投稿${records.length >= 2 ? 'たち' : ''}です！！ [${count}個]`,
                value: records.map(record => `[${createContent(record)}](${record.url})`).join('\n'),
              }),
              rank: rank + records.length,
            };
          }, { fields: [], rank: 1 });

        await sendEmbed({ fields });
      }
      else {
        await sendEmbed({ description: '先週はリアクションが付いた投稿はありませんでした！！' });
      }
    }

    // run again almost next week.
    setTimeout(tick, 86400 * 6.9);
  }
  // or else, after 1 sec.
  else {
    setTimeout(tick, 1000);
  }
  }
tick();
