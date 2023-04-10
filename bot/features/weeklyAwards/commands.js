const { ApplicationCommandType, PermissionFlagsBits, ApplicationCommandOptionType, ChannelType, EmbedBuilder } = require('discord.js');
const { log } = require('../../lib/log');
const { startAward, stopAward } = require('.');
const { db } = require('./db');

/** @type {ChatInputCommand<void, {}, 'cached' | 'raw'>} */
const subCommands = {
  register: {
    description: '初期登録をします。',
    options: [
      {
        name: 'channel',
        description: '報告させたいチャンネル',
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildAnnouncement, ChannelType.GuildText],
        required: true,
      }
    ],
    async func(interaction) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channel = interaction.options.getChannel('channel', true);

      if (guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      else if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      log('register weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.config.register(guildId, guildName, channel.id, channel.name);
      await startAward(guildId);

      response.edit(`リアクション大賞の巡回対象にこのサーバーを登録し、週の報告を ${channel} で行うよう設定しました。`);
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
      log('unregister weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await stopAward(guildId);
      await db.config.unregister(guildId);

      response.edit('リアクション大賞の巡回対象からこのサーバーを削除しました。');
    },
  },
  status: {
    description: '現在のこのサーバーの登録状況を確認します。',
    async func(interaction) {
      const { guildId, guild } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '登録解除したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('peek status weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.config.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        embed.setDescription('登録済み');
        embed.addFields({ name: '報告チャンネル', value: `<#${configRecord.channelId}>` });
      }
      else {
        embed.setDescription('未登録');
      }
      response.edit({ embeds: [embed] });
    }
  },
};

/** @type {ChatInputCommand<void>} */
module.exports = {
  weeklyaward: {
    description: 'リアクション大賞',
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandType.ChatInput,
      ...content,
    })),
    func(interaction) {
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
