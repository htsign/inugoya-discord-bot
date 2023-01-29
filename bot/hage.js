/**
 * @typedef {import('discord.js').Message<T> | import('discord.js').PartialMessage} Message<T>
 * @template T
 */

const { Events } = require('discord.js');
const client = require('./client.js');
const { Timeout } = require('./timeout.js');
const { log } = require('./log.js');
const keywords = require('./keywords.json');
const keywordReactions = require('./keywordReactions.json');

const HAGE_TIMEOUT = 10 * 60 * 1000;

const template = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・
(|　　 |)::::`;

const moreTemplate = `:彡⌒:|
(´･ω:|　　やっぱり髪の話してる
ヽつ::|
　ヽ :;|
　　　 ＼`;

/** @type {Set<string>} */
const reactedMessageIds = new Set();
/** @type {Set<Timeout<boolean>>} */
const timeouts = new Set();

/** @type {function(Message<unknown>): string} */
const getId = message => [message.channelId, message.guildId, message.id].join();

/**
 * @param {Message<boolean>} message 
 * @param {string} id
 */
const replyToHage = (message, id) => {
    reactedMessageIds.add(id);
    
    // register an object that removes itself in 10 minutes
    timeouts.add(new Timeout(x => timeouts.delete(x), HAGE_TIMEOUT));

    if (timeouts.size < 5) {
      message.reply(template);
    }
    else {
      message.reply(moreTemplate);
      timeouts.forEach(x => x.fire());
    }
};

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
    replyToHage(message, id);
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
    replyToHage(message, id);
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
