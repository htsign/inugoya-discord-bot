const { Events } = require("discord.js");
const client = require("../../client");
const { log } = require("../../lib/log");
const { fetchMessageByIds, messageToEmbeds } = require("../util");

const TRY_COUNT_THRESHOLD = 3;

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || message.channel.isVoiceBased()) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  /** @type {APIEmbed[]} */
  const embeds = [];

  for (const [, guildId, channelId, messageId] of regExpIterator) {
    if (guildId == null || channelId == null || messageId == null) {
      throw new Error('invalid url');
    }

    for (let tryCount = 0; tryCount < TRY_COUNT_THRESHOLD; ++tryCount) {
      const referredMessage = await fetchMessageByIds(guildId, channelId, messageId);

      if (referredMessage != null) {
        const messageEmbeds = await messageToEmbeds(referredMessage);

        if (messageEmbeds.length > 0) {
          embeds.push(...messageEmbeds);
          break;
        }
      }
      else {
        log('discordUrlExpand:', 'fetches failed', tryCount + 1, guildId, channelId, messageId);
      }
    }
  }

  if (embeds.length > 0) {
    message.channel.send({ embeds });
  }
});
