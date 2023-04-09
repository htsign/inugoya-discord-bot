const { ApplicationCommandType, PermissionFlagsBits, ApplicationCommandOptionType, ChannelType } = require('discord.js');
const { log } = require('../../lib/log');
const { db } = require('./db');

const DEFAULT_THRESHOLD = 5;

/** @type {ChatInputCommand<[Channel, number]?, { resultMessage: (values: [Channel, number]?) => string }, 'cached' | 'raw'>} */
const subCommands = {
  register: {
    description: '初期登録をします。',
    resultMessage: values => {
      if (values != null) {
        const [channel, threshold] = values;
        return `VC盛り上がり通知の巡回対象にこのサーバーを登録し、VCの参加人数が ${threshold} 以上の場合に ${channel} に通知するよう設定しました。`;
      }
      else {
        return '設定に失敗しました。';
      }
    },
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
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channel = interaction.options.getChannel('channel', true);
      const threshold = interaction.options.getInteger('threshold') ?? DEFAULT_THRESHOLD;

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
      log('register vcAttention:', interaction.user.username, guildName);

      await db.register(guildId, guildName, channel.name, threshold);

      return [channel, threshold];
    },
  },
  unregister: {
    description: '登録を解除します。',
    resultMessage: _ => 'VC盛り上がり通知の巡回対象からこのサーバーを削除しました。',
    async func(interaction) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;

      if (guildName == null) {
        await interaction.reply({ content: '登録解除したいサーバーの中で実行してください。', ephemeral: true });
        return null;
      }
      log('unregister vcAttention:', interaction.user.username, guildName);

      await db.unregister(guildId);

      return null;
    },
  },
};

/** @type {ChatInputCommand<Promise<string>>} */
module.exports = {
  vcattention: {
    description: 'VC盛り上がり通知',
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandType.ChatInput,
      ...content,
    })),
    async func(interaction) {
      const subCommandName = interaction.options.getSubcommand(true);

      if (!interaction.inGuild()) {
        await interaction.reply({ content: 'サーバー内で実行してください。', ephemeral: true });
        return;
      }

      const subCommand = subCommands[subCommandName];
      if (subCommand != null) {
        const { func, resultMessage } = subCommand;
        await interaction.deferReply();

        const returnedValues = await func(interaction);
        await interaction.editReply(resultMessage(returnedValues));
      }
    },
    defaultMemberPermissions: PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.KickMembers,
  },
};
