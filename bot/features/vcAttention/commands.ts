import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { ChatInputCommandCollection } from '../../../types/bot/index.ts';
import type { Obj } from '../../../types/index.ts';
import { log } from '../../lib/log.ts';
import { DATETIME_FORMAT } from '../../lib/util.ts';
import { db } from './db.ts';

const DEFAULT_THRESHOLD = 5;

const subCommands: ChatInputCommandCollection<void, Obj, 'cached' | 'raw'> = {
  register: {
    description: '初期登録をします。',
    options: [
      {
        name: 'channel',
        description: '通知させたいチャンネル',
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildAnnouncement, ChannelType.GuildText],
        required: true,
      },
      {
        name: 'threshold',
        description: `盛り上がり判定の最低人数（デフォルト: ${DEFAULT_THRESHOLD}）`,
        type: ApplicationCommandOptionType.Integer,
      },
    ],
    async func(interaction) {
      const { guildId, guild } = interaction;
      const guildName = guild?.name;
      const bot = guild?.members.me;

      if (guild == null || guildName == null || bot == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const threshold = interaction.options.getInteger('threshold') ?? DEFAULT_THRESHOLD;

      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      const permissions = bot.permissionsIn(channel);
      if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.MentionEveryone)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      log('register vcAttention:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, channel.id, channel.name, threshold);

      response.edit(
        `VC盛り上がり通知の巡回対象にこのサーバーを登録し、VCの参加人数が ${threshold} 以上の場合に ${channel} に通知するよう設定しました。`,
      );
    },
  },
  unregister: {
    description: '登録を解除します。',
    async func(interaction) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '登録解除したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('unregister vcAttention:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.unregister(guildId);

      response.edit('VC盛り上がり通知の巡回対象からこのサーバーを削除しました。');
    },
  },
  status: {
    description: '現在のこのサーバーの登録状況を確認します。',
    async func(interaction) {
      const { guildId, guild } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '確認したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('peek status vcAttention:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: '報告チャンネル', value: `<#${configRecord.channelId}>`, inline: true },
          { name: '閾値', value: `${configRecord.threshold} 人`, inline: true },
          { name: ' ', value: '----------------' },
          { name: '初回設定日時', value: configRecord.createdAt.format(DATETIME_FORMAT), inline: true },
          { name: '最終更新日時', value: configRecord.updatedAt.format(DATETIME_FORMAT), inline: true },
        );
      }
      else {
        embed.setDescription('未登録').setColor(Colors.Red);
      }
      response.edit({ embeds: [embed] });
    },
  },
};

export const commands: ChatInputCommandCollection<void, Obj> = {
  vcattention: {
    description: 'VC盛り上がり通知',
    // @ts-expect-error
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandType.ChatInput,
      ...content,
    })),
    async func(interaction) {
      const subCommandName = interaction.options.getSubcommand(true);

      if (!interaction.inGuild()) {
        interaction.reply({ content: 'サーバー内で実行してください。', ephemeral: true });
        return;
      }

      const subCommand = subCommands[subCommandName];
      if (subCommand != null) {
        subCommand.func(interaction);
      }
    },
    defaultMemberPermissions: PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.KickMembers,
  },
};
