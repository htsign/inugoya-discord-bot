import {
  type APIEmbed,
  type APIInteractionDataResolvedChannel,
  type Attachment,
  BaseChannel,
  ChannelType,
  type ChatInputCommandInteraction,
  DiscordAPIError,
  EmbedBuilder,
  type Guild,
  type GuildBasedChannel,
  type GuildChannelResolvable,
  type GuildMember,
  type Message,
  type NewsChannel,
  PermissionFlagsBits,
  type PermissionResolvable,
  RESTJSONErrorCodes,
  type Snowflake,
  type TextChannel,
  type User,
} from 'discord.js';
import { getAverageColor as _getAverageColor } from 'fast-average-color-node';
import { isNonEmpty } from 'ts-array-length';
import client from '#client';
import {
  log,
  logError,
} from '#lib/log.ts';
import type { Nullable } from '#types';
import type { EmbedMessageOptions } from '#types/bot';

export const fetchMessageByIds = async (guildId: string, channelId: string, messageId: string): Promise<Message<true> | null> => {
  try {
    const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId);
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId);

    if (channel?.isTextBased() && !channel.isVoiceBased()) {
      return channel.messages.cache.get(messageId) ?? await channel.messages.fetch(messageId);
    }
    return null;
  }
  catch (e) {
    if (e instanceof Error) {
      const argDetails = `guildId: ${guildId}, channelId: ${channelId}, messageId: ${messageId}`;
      if (e.stack != null) {
        const [firstLine, ...rest] = e.stack.split('\n');
        log(`${fetchMessageByIds.name}:`, [`${firstLine} [${argDetails}]`, ...rest].join('\n'));
      }
      else {
        log(`${fetchMessageByIds.name}:`, `${e.name}: ${e.message} [${argDetails}]`);
      }
      return null;
    }

    throw e;
  }
};

export const messageToEmbeds = async (message: Message<boolean>, options: EmbedMessageOptions[]): Promise<APIEmbed[]> => {
  const { channel } = message;

  if (!channel.isTextBased()) return [];

  const optionsSet = new Set(options);

  const embeds: APIEmbed[] = [];

  let author: User | null = null;
  try {
    author = await message.author.fetch();
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, `${messageToEmbeds.name}:`, 'failed to fetch author');
    }
    else {
      throw e;
    }
  }

  const getAverageColor = async (avatarUrl: Nullable<string>): Promise<number | null> => {
    if (avatarUrl == null) return null;

    const { value: [red, green, blue] } = await _getAverageColor(avatarUrl, { silent: true });
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

  for (const option of optionsSet) {
    switch (option) {
      case 'reactions': {
        const reactions = message.reactions.cache;
        const reactionsCount = reactions.reduce((acc, x) => acc + x.count, 0);

        if (reactionsCount > 0) {
          embed.addFields({ name: 'Reactions', value: String(reactionsCount), inline: true });
        }
        break;
      }
      case 'originalLink': {
        embed.addFields({ name: 'Original Link', value: message.url, inline: true });
        break;
      }
      default: {
        throw new RangeError(`exhaustive check: ${option satisfies never} is invalid`);
      }
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

  const getEmbedMediaType = (attachment: Attachment): 'image' | 'video' => {
    const [type] = attachment.contentType?.split('/') ?? [];
    return type === 'video' ? 'video' : 'image';
  };

  const attachmentArray = attachments.toJSON();
  if (isNonEmpty(attachmentArray)) {
    const attachment = attachmentArray[0];
    const { url } = attachment;

    embeds.push({ ...embed.toJSON(), [getEmbedMediaType(attachment)]: { url } });
  }
  else {
    embeds.push(embed.toJSON());
  }

  for (const attachment of attachmentArray.slice(1)) {
    const { url } = attachment;

    embeds.push({ url: message.url, [getEmbedMediaType(attachment)]: { url } });
  }

  return embeds;
};

/**
 * Fetches a channel of `guild`, resolving to `null` instead of rejecting when Discord reports it as an Unknown Channel (e.g. deleted).
 */
export const fetchGuildChannelOrNull = async (guild: Guild, channelId: Snowflake): Promise<GuildBasedChannel | null> => {
  try {
    return await guild.channels.fetch(channelId);
  }
  catch (e) {
    if (e instanceof DiscordAPIError && e.code === RESTJSONErrorCodes.UnknownChannel) return null;

    throw e;
  }
};

export const canPostIn = (me: Nullable<GuildMember>, channel: GuildChannelResolvable, extra: PermissionResolvable = []): boolean =>
  me?.permissionsIn(channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, extra]) ?? false;

/**
 * Narrows `channel` to a text or announcement channel that `me` can post to (plus `extra`), or replies with the reason and returns `null`.
 */
export const resolvePostChannel = async (
  interaction: Pick<ChatInputCommandInteraction, 'reply'>,
  channel: GuildBasedChannel | APIInteractionDataResolvedChannel,
  me: Nullable<GuildMember>,
  { extra, message = 'このチャンネルには発言する権限がありません。' }: { extra?: PermissionResolvable, message?: string } = {},
): Promise<TextChannel | NewsChannel | null> => {
  if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || !(channel instanceof BaseChannel)) {
    await interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
    return null;
  }
  if (!canPostIn(me, channel, extra)) {
    await interaction.reply({ content: message, ephemeral: true });
    return null;
  }

  return channel;
};
