import { APIEmbed, APIEmbedField, Events, ChannelType } from 'discord.js';
import dayjs from './dayjsSetup';
import client from './client';
import { log } from './log';
import { Message } from '../type/message';

const messages: Map<Message<boolean>, number> = new Map();

client.once(Events.ClientReady, async () => {
  log('weekly award is ready.');
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot) return;

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

  if (now.day() === SUNDAY && now.hour() === 12 && now.minute() === 0) {
    const guilds = await client.guilds.fetch();
    const server = await guilds.find(guild => guild.name === 'inugoya')?.fetch();
    const channels = server?.channels?.cache;
    const rootChannel = channels?.find(channel => channel.name === 'root');

    if (rootChannel?.type === ChannelType.GuildText) {
      const sendEmbed = (options: APIEmbed) => rootChannel.send({
        embeds: [{ title: 'リアクション大賞', ...options }],
      });

      // remove messages sent over a week ago
      for (const [message] of messages) {
        if (now.diff(dayjs(message.createdTimestamp).tz(), 'days') >= 7) {
          messages.delete(message);
        }
      }

      if ([...messages.values()].some(count => count > 0)) {
        // tally messages by reactions count
        type MsgCount = { [count: number]: Message<boolean>[] };
        const talliedMessages = [...messages]
          .reduce<MsgCount>((acc, [msg, count]) => ({ ...acc, [count]: [...(acc[count] ? acc[count] : []), msg] }), {});

        // sort descending order by reactions count
        const messagesArray = Object.entries(talliedMessages).sort(([a, ], [b, ]) => (+b) - (+a));

        const { fields } = messagesArray
          // take 3 elements
          .filter((_, i) => i < Math.min(messagesArray.length, 3))
          // create fields
          .reduce<{ fields: APIEmbedField[], rank: number }>(({ fields, rank }, [count, messages]) => {
            const rankText = rank === 1 ? '最も' : ` ${rank}番目に`;
            return {
              fields: fields.concat({
                name: `先週${rankText}リアクションが多かった投稿${messages.length >= 2 ? 'たち' : ''}です！！ [${count}個]`,
                value: messages.map(message => message.url).join('\n'),
              }),
              rank: rank + messages.length,
            };
          }, { fields: [], rank: 1 });

        await sendEmbed({ fields });
      }
      else {
        await sendEmbed({ description: '先週はリアクションが付いた投稿はありませんでした！！' });
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
