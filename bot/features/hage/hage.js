const { Events } = require('discord.js');
const MersenneTwister = require('mersenne-twister');
const client = require('../../client.js');
const { Timeout } = require('../../lib/timeout.js');
const { log } = require('../../lib/log.js');
const keywords = require('./keywords.json');
const keywordReactions = require('./keywordReactions.json');
const dayjs = require('dayjs');

const HAGE_TIMEOUT = 10 * 60 * 1000;

const template = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・
(|　　 |)::::`;

const moreTemplate = `:彡⌒:|
(´･ω:|　　やっぱり髪の話してる
ヽつ::|
　ヽ :;|
　　　 ＼`;

const rareTemplate = `.        (~)
　 ／⌒ヽ
    {jjjjjjjjjjjj}
     (  ´･ω･ )
    ( :::： ::: )
　  し―Ｊ`;

/** @type {Set<string>} */
const reactedMessageIds = new Set();
/** @type {Set<Timeout<boolean>>} */
const timeouts = new Set();

const mtSeed = dayjs().tz();
const mtRnd = new MersenneTwister(mtSeed.unix());

/** @type {function(Message<boolean>): string} */
const getId = message => [message.channelId, message.guildId, message.id].join();

/**
 * @param {Message<boolean>} message
 * @param {string} id
 */
const replyToHage = (message, id) => {
  reactedMessageIds.add(id);

  // register an object that removes itself in 10 minutes
  timeouts.add(new Timeout(x => timeouts.delete(x), HAGE_TIMEOUT));

  if (mtRnd.random() < .05) {
    message.reply(rareTemplate);
  }
  else {
    if (timeouts.size < 5) {
      message.reply(template);
    }
    else {
      message.reply(moreTemplate);
      timeouts.forEach(x => x.fire());
    }
  }
};

client.once(Events.ClientReady, () => {
  log('watch messages...', keywords);
  log('watch reactions...', keywordReactions);

  log('random generator initialized by', mtSeed.format('YYYY/MM/DD HH:mm:ss'), mtSeed.unix());
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
