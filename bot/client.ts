import { Client, GatewayIntentBits, Partials, PresenceUpdateStatus } from 'discord.js';
import { TOKEN } from './credentials.js';

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

client.login(TOKEN).then(_ => {
  client.user?.setPresence({
    activities: [
      { name: 'ハゲを監視しています' },
    ],
    status: PresenceUpdateStatus.Online,
  });
});

export default client;
