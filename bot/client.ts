import { Client, GatewayIntentBits, Partials, PresenceUpdateStatus } from 'discord.js';
import { getEnv } from '@lib/util';

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
});
client.setMaxListeners(50);

client.login(getEnv('ACCESS_TOKEN')).then(_ => {
  client.user?.setPresence({
    activities: [
      { name: '犬小屋を監視しています' },
    ],
    status: PresenceUpdateStatus.Online,
  });
});

export default client;
