import { log } from '@lib/log';
import { DATETIME_FORMAT } from '@lib/util';
import {
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Obj } from 'types';
import type { ChatInputCommandCollection } from 'types/bot';
import { db } from './db';

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
    ],
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const { guildId, guild } = interaction;
      const guildName = guild?.name;
      const bot = guild?.members.me;

      if (guild == null || guildName == null || bot == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);

      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      const permissions = bot.permissionsIn(channel);
      if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.MentionEveryone)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      log('register launched:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, channel.id, channel.name);

      response.edit(`このサーバーを登録し、${channel} に通知するよう設定しました。`);
    },
  },
  unregister: {
    description: '登録を解除します。',
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '登録解除したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('unregister launched:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.unregister(guildId);

      response.edit('このサーバーの登録を解除しました。');
    },
  },
  status: {
    description: '登録状況を確認します。',
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '確認したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('peek status launched:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: '通知チャンネル', value: `<#${configRecord.channelId}>`, inline: true },
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
  launched: {
    description: '犬小屋への帰還',
    options: Object.entries(subCommands)
      .map(([name, content]) => Object.assign({ name, type: ApplicationCommandOptionType.Subcommand }, content)),
    async func(interaction: ChatInputCommandInteraction): Promise<void> {
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
