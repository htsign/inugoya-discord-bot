import { type Emoji, Events, type Guild, type Message, type PartialMessage, type Snowflake } from 'discord.js';
import MersenneTwister from 'mersenne-twister';
import dayjs from '../../lib/dayjsSetup.ts';
import { log, logError } from '../../lib/log.ts';
import { Timeout } from '../../lib/timeout.ts';
import { addHandler } from '../../listeners.ts';
import { db } from './db.ts';

const reactedMessageIds = new Set<`${Snowflake},${Snowflake},${Snowflake}`>();
const timeouts = new Map<Snowflake, Set<Timeout<boolean>>>();

const mtSeed = dayjs().tz();
const mtRnd = new MersenneTwister(mtSeed.unix());

const getId = (message: Message<boolean> | PartialMessage): `${Snowflake},${Snowflake},${Snowflake}` =>
  `${message.guildId},${message.channelId},${message.id}`;

/**
 * @todo remove this if fixed it
 */
const _emojiToString = (emoji: Emoji) => {
  const emojiString = emoji.toString();

  // do workaround if `emoji.toString()` returns `<:_:xxxxxxxxxxxx>`
  // bug since: discord.js v14.14.0
  if (/^<:_:\d+>$/.test(emojiString)) {
    return `<:${emoji.name}:${emoji.id}>`;
  }
  return emojiString;
}

const replyToHage = (guildId: Snowflake, messageHandler: (text: string) => Promise<void>, id: `${Snowflake},${Snowflake},${Snowflake}`) => {
  const configRecord = db.get(guildId);
  if (configRecord == null) {
    log(`${replyToHage.name}:`, 'not registered', guildId);
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
      for (const x of set) x.fire();
    }
  }
};

export const removeUnregisteredKeywords = async (guild: Guild): Promise<void> => {
  const emojis = guild.emojis.cache ?? await guild.emojis.fetch();
  const availableEmojiSymbols = emojis.filter(emoji => emoji.available).map(_emojiToString);

  const forDeletionKeywords = db.keywords.getRecords(guild.id)
    .map(record => record.keyword)
    .filter(keyword => /^<:\w+:\d+>$/.test(keyword) && !availableEmojiSymbols.includes(keyword));
  const forDeletionReactions = db.reactionKeywords.getRecords(guild.id)
    .map(record => record.reaction)
    .filter(reaction => /^<:\w+:\d+>$/.test(reaction) && !availableEmojiSymbols.includes(reaction));

  await db.keywords.delete(guild.id, ...forDeletionKeywords);
  await db.reactionKeywords.delete(guild.id, ...forDeletionReactions);
};

addHandler(Events.ClientReady, () => {
  log('random generator initialized by', mtSeed.format('YYYY/MM/DD HH:mm:ss'), mtSeed.unix());
});
addHandler(Events.GuildDelete, guild => {
  db.keywords.deleteAll(guild.id);
  db.reactionKeywords.deleteAll(guild.id);
  db.unregister(guild.id);
});
addHandler(Events.MessageCreate, message => {
  const { content, author, guild, channel } = message;

  if (author.bot || guild == null || channel.isVoiceBased() || !('name' in channel)) return;

  const configRecord = db.get(guild.id);
  if (configRecord == null) return;

  const keywords = db.keywords.getRecords(guild.id).map(record => record.keyword);
  const id = getId(message);

  log([guild.name, channel.name].join('/'), 'message incoming:', author.username, content);

  if (keywords.some(keyword => content.includes(keyword))) {
    replyToHage(guild.id, async text => {
      try {
        await channel.send(text);
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, 'hage:', `failed to send to: ${guild.name}/${channel.name}`);
          return;
        }
        throw e;
      }

      log('hage:', `sent to: ${guild.name}/${channel.name}`, text);
    }, id);
  }
});
addHandler(Events.MessageDelete, message => {
  const id = getId(message);
  reactedMessageIds.delete(id);
});
addHandler(Events.MessageReactionAdd, async (reaction, user) => {
  let message: Message<boolean>;
  try {
    message = await reaction.message.fetch();
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, 'hage:', `failed to fetch message: reacted by ${user.username}`);
      return;
    }
    throw e;
  }
  const { author, guild, channel } = message;

  if (author.bot || guild == null || !('name' in channel)) return;

  const configRecord = db.get(guild.id);
  if (configRecord == null) return;

  const reactionKeywords = db.reactionKeywords.getRecords(guild.id).map(record => record.reaction);
  const id = getId(message);

  log([guild.name, channel.name].join('/'), 'reaction incoming:', user.username, reaction.emoji.name);

  if (!reactedMessageIds.has(id) && reactionKeywords.includes(_emojiToString(reaction.emoji))) {
    replyToHage(guild.id, async text => {
      try {
        await message.reply(text);
      }
      catch (e) {
        if (e instanceof Error) {
          logError(e, 'hage:', `failed to reply to: ${author.username}`);
          return;
        }
        throw e;
      }

      log('hage:', `reply to ${author.username}`, ':', text);
    }, id);
  }
});
addHandler(Events.MessageReactionRemove, async (reaction, user) => {
  let message: Message<boolean>;
  try {
    message = await reaction.message.fetch();
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, 'hage:', `failed to fetch message: react removed by ${user.username}`);
      return;
    }
    throw e;
  }
  const { author, reactions, guildId } = message;

  if (author.bot || guildId == null) return;

  const reactionKeywords = db.reactionKeywords.getRecords(guildId).map(record => record.reaction);

  if (!reactionKeywords.some(r => reactions.cache.get(r))) {
    const id = getId(message);
    reactedMessageIds.delete(id);
  }
});
