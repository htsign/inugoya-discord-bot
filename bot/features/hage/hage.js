const { Events } = require('discord.js');
const MersenneTwister = require('mersenne-twister');
const dayjs = require('../../lib/dayjsSetup');
const client = require('../../client');
const { Timeout } = require('../../lib/timeout');
const { log } = require('../../lib/log');
const { db } = require('./db');

/** @type {Set<`${Snowflake},${Snowflake},${Snowflake}`>} */
const reactedMessageIds = new Set();
/** @type {Map<Snowflake, Set<Timeout<boolean>>>} */
const timeouts = new Map();

const mtSeed = dayjs().tz();
const mtRnd = new MersenneTwister(mtSeed.unix());

/** @type {function(Message<boolean>): `${Snowflake},${Snowflake},${Snowflake}`} */
const getId = message => `${message.guildId},${message.channelId},${message.id}`;

/**
 * @param {Snowflake} guildId
 * @param {(text: string) => Promise<Message<boolean>>} messageHandler
 * @param {`${Snowflake},${Snowflake},${Snowflake}`} id
 */
const replyToHage = (guildId, messageHandler, id) => {
  const configRecord = db.get(guildId);
  if (configRecord == null) {
    log('replyToHage:', 'not registered', guildId);
    return;
  }

  reactedMessageIds.add(id);

  // register an object that removes itself in 10 minutes
  if (!timeouts.has(guildId)) {
    timeouts.set(guildId, new Set());
  }
  const set = timeouts.get(guildId);
  if (set == null) throw new Error('invalid state');

  set.add(new Timeout(x => set.delete(x), configRecord.timeout * 60 * 1000));

  if (mtRnd.random() < .05) {
    messageHandler(configRecord.rareTemplate);
  }
  else {
    if (set.size < configRecord.stackSize) {
      messageHandler(configRecord.template);
    }
    else {
      messageHandler(configRecord.moreTemplate);
      set.forEach(x => x.fire());
    }
  }
};

client.once(Events.ClientReady, () => {
  log('random generator initialized by', mtSeed.format('YYYY/MM/DD HH:mm:ss'), mtSeed.unix());
});
client.on(Events.GuildDelete, guild => {
  db.unregister(guild.id);
});
client.on(Events.MessageCreate, message => {
  const { content, author, guild, channel } = message;

  if (author.bot || guild == null || channel.isVoiceBased() || !('name' in channel)) return;

  const configRecord = db.get(guild.id);
  if (configRecord == null) return;

  const keywords = db.keywords.getRecords(guild.id).map(record => record.keyword);
  const id = getId(message);

  log([guild.name, channel.name].join('/'), 'message incoming:', author.username, content);

  if (keywords.some(keyword => content.includes(keyword))) {
    replyToHage(guild.id, text => (log('hage send:', text), channel.send(text)), id);
  }
});
client.on(Events.MessageDelete, message => {
  const id = getId(message);
  reactedMessageIds.delete(id);
});
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, guild, channel } = message;

  if (author.bot || guild == null || !('name' in channel)) return;

  const configRecord = db.get(guild.id);
  if (configRecord == null) return;

  const reactionKeywords = db.reactionKeywords.getRecords(guild.id).map(record => record.reaction);
  const id = getId(message);

  log([guild.name, channel.name].join('/'), 'reaction incoming:', user.username, reaction.emoji.name);

  if (!reactedMessageIds.has(id) && reactionKeywords.includes(reaction.emoji.toString())) {
    replyToHage(guild.id, text => (log('hage reply to', author.username, ':', text), message.reply(text)), id);
  }
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const { author, reactions, guildId } = message;

  if (author.bot || guildId == null) return;

  const reactionKeywords = db.reactionKeywords.getRecords(guildId).map(record => record.reaction);

  if (!reactionKeywords.some(r => reactions.cache.get(r))) {
    const id = getId(message);
    reactedMessageIds.delete(id);
  }
});
