const { Events } = require("discord.js");
const client = require("../../client");
const { log } = require("../../lib/log");
const { messageToEmbeds } = require("../trans");

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  for (const [, guildId, channelId, messageId] of regExpIterator) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (channel?.isTextBased()) {
        const referredMessage = await channel.messages.fetch(messageId);
        const embeds = await messageToEmbeds(referredMessage);

        if (embeds.length > 0) {
          await message.channel.send({ embeds });
        }
      }
    }
    catch (e) {
      if (e instanceof Error) {
        log(e.stack ?? `${e.name}: ${e.message}`);
      }
      else {
        throw e;
      }
    }
  }
});
