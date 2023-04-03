const { Client, GatewayIntentBits, Partials, PresenceUpdateStatus } = require('discord.js');
const { getEnv } = require('./lib/util');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.Message,
    Partials.Reaction,
  ]
})
  .setMaxListeners(50);

client.login(getEnv('ACCESS_TOKEN')).then(_ => {
  client.user?.setPresence({
    activities: [
      { name: 'ハゲを監視しています' },
    ],
    status: PresenceUpdateStatus.Online,
  });
});

module.exports = client;
