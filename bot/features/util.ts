import { EmbedBuilder, Colors, Message, APIEmbed, APIEmbedField } from 'discord.js';
import { log } from '@lib/log';
import client from '../client';

export const fetchMessageByIds = async (guildId: string, channelId: string, messageId: string): Promise<Message<true> | null> => {
  try {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased()) {
      return channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);
    }
    return null;
  }
  catch (e) {
    if (e instanceof Error) {
      log(e.stack ?? `${e.name}: ${e.message}`);
      return null;
    }
    else {
      throw e;
    }
  }
};

export const messageToEmbeds = async (message: Message<boolean>, addReactionField: boolean = true): Promise<APIEmbed[]> => {
  const { channel } = message;

  if (channel.isTextBased()) {

    const embeds: APIEmbed[] = [];

    const author = await message.author?.fetch();

    const embed = new EmbedBuilder()
      .setURL(message.url)
      .setTimestamp(message.editedTimestamp ?? message.createdTimestamp)
      .setColor(message.author?.accentColor ?? Colors.Default);

    if (author != null) {
      embed.setAuthor({ name: author.username, url: message.url, iconURL: author.displayAvatarURL() });
    }

    if (message.content !== '') {
      embed.setDescription(message.content);
    }

    if (addReactionField) {
      const fields: APIEmbedField[] = [];

      const reactions = message.reactions.cache;
      const reactionsCount = reactions.reduce((acc, x) => acc + x.count, 0);

      if (reactionsCount > 0) {
        fields.push({ name: 'Reactions', value: String(reactionsCount) });
      }

      embed.setFields(...fields);
    }

    if (!channel.isDMBased()) {
      const text = channel.name;
      const iconURL = message.guild?.iconURL();

      if (iconURL != null) {
        embed.setFooter({ text, iconURL });
      }
      else {
        embed.setFooter({ text });
      }
    }

    embeds.push(embed.toJSON());

    for (const attachment of message.attachments.values()) {
      embeds.push({ url: message.url, image: { url: attachment.url } });
    }

    return embeds;
  }
  else {
    return [];
  }
};
