import { ApplicationCommandOptionType, Channel, ChannelType, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { log } from '@lib/log';
import { startAward, stopAward } from '.';
import { db } from './db';
import type { ChatInputCommandCollection } from 'types/bot';

const subCommands: ChatInputCommandCollection<Channel | null, { resultMessage: (channel: Channel | null) => string }, 'cached' | 'raw'> = {
  register: {
    description: '初期登録をします。',
    resultMessage: channel => channel != null
        ? `リアクション大賞の巡回対象にこのサーバーを登録し、週の報告を ${channel} で行うよう設定しました。`
        : '設定に失敗しました。',
    options: [
      {
        name: 'channel',
        description: '報告させたいチャンネル',
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildAnnouncement, ChannelType.GuildText],
        required: true,
      }
    ],
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<Channel | null> {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channel = interaction.options.getChannel('channel', true);

      if (guildName == null) {
        await interaction.editReply('登録したいサーバーの中で実行してください。');
        return null;
      }
      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        await interaction.editReply('適用できないチャンネルです。');
        return null;
      }
      else if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        await interaction.editReply('このチャンネルには発言する権限がありません。');
        return null;
      }
      log('register weeklyAward:', interaction.user.username, guildName);

      await db.config.register(guildId, guildName, channel.name);
      await startAward(guildId);

      return channel;
    },
  },
  unregister: {
    description: '登録を解除します。',
    resultMessage: _ => 'リアクション大賞の巡回対象からこのサーバーを削除しました。',
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channelName = interaction.channel?.name;

      if (guildName == null || channelName == null) {
        await interaction.reply({ content: '登録解除したいチャンネルの中で実行してください。', ephemeral: true });
        return null;
      }
      log('unregister weeklyAward:', interaction.user.username, guildName);

      await stopAward(guildId);
      await db.config.unregister(guildId);

      return null;
    },
  },
};

export const commands: ChatInputCommandCollection<void, {}> = {
  weeklyaward: {
    description: 'リアクション大賞',
    // @ts-ignore
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandOptionType.Subcommand,
      ...content,
    })),
    async func(interaction: ChatInputCommandInteraction): Promise<void> {
      const subCommandName = interaction.options.getSubcommand(true);

      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'サーバー内で実行してください。', ephemeral: true });
        return;
      }

      const subCommand = subCommands[subCommandName];
      if (subCommand != null) {
        const { func, resultMessage } = subCommand;
        await interaction.deferReply();
        const channel = await func(interaction);
        await interaction.editReply(resultMessage(channel));
      }
    },
    defaultMemberPermissions: PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.KickMembers,
  },
};
