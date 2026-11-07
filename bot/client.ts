import {
  Client,
  GatewayIntentBits,
  Partials,
  PresenceUpdateStatus,
} from 'discord.js';
import { Agent } from 'undici';
import { getEnv } from './lib/util.ts';
import { init } from './listeners.ts';

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
  ],
  rest: { agent: new Agent() }, // bypass the global dispatcher; jsdom's undici 8 dependency hijacks it and breaks file uploads
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
