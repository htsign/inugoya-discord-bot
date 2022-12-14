import { Events } from 'discord.js';
import client from './client.js';
import { log } from './log.js';
import { Message } from '../type/message';
import keywords from './keywords.json';
import keywordReactions from './keywordReactions.json';

const template = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・
(|　　 |)::::`;

const reactedMessageIds: Set<string> = new Set();

const getId = (message: Message<any>) => [message.channelId, message.guildId, message.id].join();

client.once(Events.ClientReady, () => {
  log('watch messages...', keywords);
  log('watch reactions...', keywordReactions);
});
client.on(Events.MessageCreate, message => {
  const { content, author } = message;
  const id = getId(message);

  if (author.bot) return;

  log('message incoming: ', content);
  if (keywords.some(keyword => content.includes(keyword))) {
    reactedMessageIds.add(id);
    message.reply(template);
  }
});
client.on(Events.MessageDelete, message => {
  const id = getId(message);
  reactedMessageIds.delete(id);
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const id = getId(message);

  if (message.author.bot) return;

  log('reaction incoming: ', reaction.emoji.name);
  if (!reactedMessageIds.has(id) && keywordReactions.includes((await reaction.fetch()).emoji.name ?? '')) {
    reactedMessageIds.add(id);
    message.reply(template);
  }
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions } = message;

  if (author.bot) return;

  if (!keywordReactions.some(kr => reactions.cache.get(kr))) {
    const id = getId(message);
    reactedMessageIds.delete(id);
  }
});
