// @ts-check

/**
 * @typedef {import('discord.js').Message<T> | import('discord.js').PartialMessage} Message<T>
 * @template T
 */

const { Events } = require('discord.js');
const client = require('./client.js');
const keywords = require('./keywords.json');
const keywordReactions = require('./keywordReactions.json');

const template = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・
(|　　 |)::::`;

/** @type {Set<string>} */
const reactedMessageIds = new Set();

/** @type {function(Message<any>): string} */
const getId = message => [message.channelId, message.guildId, message.id].join();

client.once(Events.ClientReady, () => {
  console.log('watch messages...', keywords);
  console.log('watch reactions...', keywordReactions);
});
client.on(Events.MessageCreate, message => {
  const { content, author } = message;
  const id = getId(message);

  if (author.bot) return;

  console.log('message incoming: ', content);
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

  console.log('reaction incoming: ', reaction.emoji.name);
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
