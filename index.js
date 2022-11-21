// @ts-check

/**
 * @typedef {import('discord.js').Message<T> | import('discord.js').PartialMessage} Message<T>
 * @template T
 */

const dotenv = require('dotenv');
const { Client, Events, GatewayIntentBits, Partials, PresenceUpdateStatus } = require('discord.js');
const keywords = require('./keywords.json');

const template = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・
(|　　 |)::::`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [
    Partials.Message,
    Partials.Reaction,
  ]
});

/** @type {Set<string>} */
const reactedMessageIds = new Set();

/** @type {function(Message<any>): string} */
const getId = message => [message.channelId, message.guildId, message.id].join();

client.once(Events.ClientReady, () => {
  console.log('watches...', keywords);
});
client.on(Events.MessageCreate, message => {
  const { content, author } = message;
  const id = getId(message);

  if (author.bot) return;

  console.log('incoming: ', content);
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
  const hageCount = message.reactions.cache.find(({ emoji }) => emoji.name === 'hage')?.count ?? 0;

  if (!reactedMessageIds.has(id)) {
    if (hageCount > 0) {
      reactedMessageIds.add(id);
      message.reply(template);
    }
  }
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  const message = await reaction.message.fetch();
  const id = getId(message);
  const hageCount = message.reactions.cache.find(({ emoji }) => emoji.name === 'hage')?.count ?? 0;

  if (hageCount === 0) {
    reactedMessageIds.delete(id);
  }
});

const token = dotenv.config().parsed?.ACCESS_TOKEN ?? process.env.ACCESS_TOKEN;
if (token == null) {
  throw new Error('token is empty');
}

client.login(token).then(_ => {
  client.user?.setPresence({
    activities: [
      { name: 'ハゲを監視しています' },
    ],
    status: PresenceUpdateStatus.Online,
  });
});
