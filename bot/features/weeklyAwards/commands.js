import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { log } from "../../lib/log";
import { startAward, stopAward } from ".";
import { db } from "./db";

/** @type {import('../_types').ChatInputCommandCollection<{ resultMessage: string }, 'cached' | 'raw'>} */
const subCommands = {
  register: {
    description: '初期登録をします。',
    resultMessage: 'リアクション大賞の巡回対象にこのサーバーを登録し、週の報告をこのチャンネルで行うよう設定しました。',
    async func(interaction) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channelName = interaction.channel?.name;

      if (guildName == null || channelName == null) {
        await interaction.reply({ content: '登録したいチャンネルの中で実行してください。', ephemeral: true });
        return;
      }
      log('register weeklyAward:', interaction.user.username, guildName);

      db.config.register(guildId, guildName, channelName);
      await startAward(guildId);
    },
  },
  unregister: {
    description: '登録を解除します。',
    resultMessage: 'リアクション大賞の巡回対象からこのサーバーを削除しました。',
    async func(interaction) {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;
      const channelName = interaction.channel?.name;

      if (guildName == null || channelName == null) {
        await interaction.reply({ content: '登録解除したいチャンネルの中で実行してください。', ephemeral: true });
        return;
      }
      log('unregister weeklyAward:', interaction.user.username, guildName);

      stopAward(guildId);
      db.config.unregister(guildId);
    },
  },
};

/** @type {import('../_types').ChatInputCommandCollection<{}>} */
export const commands = {
  weeklyaward: {
    description: 'リアクション大賞',
    // @ts-ignore
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandOptionType.Subcommand,
      ...content,
    })),
    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @returns {Promise<void>}
     */
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
        await func(interaction);
        await interaction.editReply(resultMessage);
      }
    },
    defaultMemberPermissions: PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.KickMembers,
  },
};
