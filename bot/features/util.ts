import { EmbedBuilder, Message, APIEmbed } from 'discord.js';
import fastAvgColor from 'fast-average-color-node';
import { log } from '@lib/log';
import client from '../client';

export const fetchMessageByIds = async (guildId: string, channelId: string, messageId: string): Promise<Message<true> | null> => {
  try {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased() &&!channel.isVoiceBased()) {
      return channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);
    }
    return null;
  }
  catch (e) {
    if (e instanceof Error) {
      const argDetails = `guildId: ${guildId}, channelId: ${channelId}, messageId: ${messageId}`;
      if (e.stack != null) {
        const [firstLine, ...rest] = e.stack.split('\n');
        log([`${firstLine} [${argDetails}]`, ...rest].join('\n'));
      }
      else {
        log(`${e.name}: ${e.message} [${argDetails}]`);
      }
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

    const author = await message.author.fetch();

    const getAverageColor = async (avatarUrl: string | null): Promise<number | null> => {
      if (avatarUrl == null) return null;

      const { value: [red, green, blue] } = await fastAvgColor.getAverageColor(avatarUrl, { silent: true });
      return (red << 16) + (green << 8) + blue;
    };

    const embed = new EmbedBuilder()
      .setURL(message.url)
      .setTimestamp(message.editedTimestamp ?? message.createdTimestamp)
      .setColor(author?.accentColor ?? await getAverageColor(author?.avatarURL()));

    if (author != null) {
      embed.setAuthor({ name: author.username, url: message.url, iconURL: author.displayAvatarURL() });
    }

    if (message.content !== '') {
      embed.setDescription(message.content);
    }

    if (addReactionField) {
      const reactions = message.reactions.cache;
      const reactionsCount = reactions.reduce((acc, x) => acc + x.count, 0);

      if (reactionsCount > 0) {
        embed.addFields({ name: 'Reactions', value: String(reactionsCount) });
      }
    }

    const [attachments, spoilerAttachments] = message.attachments.partition(x => !x.spoiler);

    if (spoilerAttachments.size > 0) {
      embed.addFields({ name: 'Spoilers', value: String(spoilerAttachments.size) });
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

    for (const attachment of attachments.values()) {
      const [type] = attachment.contentType?.split('/') ?? [];
      const key = type === 'video' ? 'video' : 'image';

      embeds.push({ url: message.url, [key]: { url: attachment.url } });
    }

    return embeds;
  }
  else {
    return [];
  }
};