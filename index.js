const dotenv = require('dotenv');
const { Client, Events, GatewayIntentBits, PresenceUpdateStatus } = require('discord.js');
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
  ],
});

client.once(Events.ClientReady, () => {
  console.log('watches...', keywords);
});
client.on(Events.MessageCreate, ({ content, author, channel }) => {
  if (author.bot) return;
  
  console.log('incoming: ', content);
  if (keywords.some(keyword => content.includes(keyword))) {
    channel.send(template);
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
