import { getEnv } from '@lib/util';
import { init } from 'bot/listeners';
import { Client, GatewayIntentBits, Partials, PresenceUpdateStatus } from 'discord.js';

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

client.login(getEnv('ACCESS_TOKEN')).then(_ => {
  const { user } = client;
  if (user == null) return;

  const presence = user.setPresence({
    activities: [
      { name: '犬小屋を監視しています' },
    ],
    status: PresenceUpdateStatus.Online,
  });
  init(presence.client);
});

export default client;
