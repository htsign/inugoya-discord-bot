const { Events, Colors, AttachmentBuilder, EmbedBuilder } = require("discord.js");
const client = require("../../client");
const { log } = require("../../lib/log");

client.on(Events.MessageCreate, async message => {
  if (message.author.bot) return;

  const regExpIterator = message.content.matchAll(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\b/g) ?? [];

  /** @type {APIEmbed[]} */
  const embeds = [];

  for (const [url, guildId, channelId, messageId] of regExpIterator) {
    try {
      const guild = await client.guilds.fetch(guildId);
      const channel = await guild.channels.fetch(channelId);

      if (channel?.isTextBased()) {
        const referredMessage = await channel.messages.fetch(messageId);

        const author = await referredMessage.author.fetch();

        const embed = new EmbedBuilder()
          .setURL(url)
          .setAuthor({ name: author.username, url, iconURL: author.displayAvatarURL() })
          .setDescription(referredMessage.content)
          .setTimestamp(referredMessage.editedTimestamp ?? referredMessage.createdTimestamp)
          .setColor(referredMessage.author.accentColor ?? Colors.Default);

        {
          const iconURL = referredMessage.guild.iconURL();
          embed.setFooter({
            text: referredMessage.channel.name,
            ...(iconURL != null ? { iconURL } : {}),
          });
        }

        embeds.push(embed.toJSON());

        for (const attachment of referredMessage.attachments.values()) {
          embeds.push({ url, image: { url: attachment.url } });
        }
      }
    }
    catch (e) {
      if (e instanceof Error) {
        log(e.name, e.message);
      }
      else {
        throw e;
      }
    }
  }

  if (embeds.length > 0) {
    await message.channel.send({ embeds });
  }
});
