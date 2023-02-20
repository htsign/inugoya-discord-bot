import { Events } from "discord.js";
import client from "../../client";
import { fetchMessageByIds, messageToEmbeds } from "../util";

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  for (const [, guildId, channelId, messageId] of regExpIterator) {
    if (guildId == null || channelId == null || messageId == null) {
      throw new Error('invalid url');
    }

    const referredMessage = await fetchMessageByIds(guildId, channelId, messageId);

    if (referredMessage != null) {
      const embeds = await messageToEmbeds(referredMessage);

      if (embeds.length > 0) {
        await message.channel.send({ embeds });
      }
    }
  }
});
