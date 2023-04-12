import { ApplicationCommandOptionType, ChannelType, ChatInputCommandInteraction, Colors, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { log } from '@lib/log';
import { DATETIME_FORMAT } from '@lib/util';
import { startAward, stopAward } from '.';
import { db } from './db';
import { FRIDAY, MONDAY, SATURDAY, SUNDAY, THURSDAY, TUESDAY, WEDNESDAY, fromNumber, jpString } from './weekday';
import type { ChatInputCommandCollection } from 'types/bot';

const DEFAULT_WEEKDAY = SUNDAY;
const DEFAULT_HOUR = 12;
const DEFAULT_MINUTE = 0;

const subCommands: ChatInputCommandCollection<void, {}, 'cached' | 'raw'> = {
  register: {
    description: '初期登録をします。',
    options: [
      {
        name: 'channel',
        description: '報告させたいチャンネル',
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildAnnouncement, ChannelType.GuildText],
        required: true,
      },
      {
        name: 'weekday',
        description: `報告する週（デフォルト: ${jpString(DEFAULT_WEEKDAY)}）`,
        type: ApplicationCommandOptionType.Integer,
        choices: ([SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY] as const)
          .map(n => ({ name: jpString(n), value: n })),
        minValue: SUNDAY,
        maxValue: SATURDAY,
      },
      {
        name: 'hour',
        description: `報告する時間（デフォルト: ${DEFAULT_HOUR}）`,
        type: ApplicationCommandOptionType.Integer,
        minValue: 0,
        maxValue: 23,
      },
      {
        name: 'minute',
        description: `報告する分（デフォルト: ${DEFAULT_MINUTE}）`,
        type: ApplicationCommandOptionType.Integer,
        minValue: 0,
        maxValue: 59,
      },
    ],
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel', true);
      const weekday = fromNumber(interaction.options.getInteger('weekday') ?? DEFAULT_WEEKDAY);
      const hour = interaction.options.getInteger('hour') ?? DEFAULT_HOUR;
      const minute = interaction.options.getInteger('minute') ?? DEFAULT_MINUTE;

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
      await db.times.set(guildId, weekday, hour, minute);
      await startAward(guildId);

      const hourString = String(hour).padStart(2, '0');
      const minuteString = String(minute).padStart(2, '0');
      response.edit([
        'リアクション大賞の巡回対象にこのサーバーを登録し、',
        `週の報告を ${jpString(weekday)}の ${hourString}:${minuteString} に ${channel} で行うよう設定しました。`,
      ].join(''));
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
      log('unregister weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await stopAward(guildId);
      await db.times.delete(guildId);
      await db.config.unregister(guildId);

      response.edit('リアクション大賞の巡回対象からこのサーバーを削除しました。');
    },
  },
  update: {
    description: '設定を変更します。',
    options: [
      {
        name: 'channel',
        description: '報告させたいチャンネル',
        type: ApplicationCommandOptionType.Channel,
        channelTypes: [ChannelType.GuildAnnouncement, ChannelType.GuildText],
      },
      {
        name: 'weekday',
        description: '報告する週',
        type: ApplicationCommandOptionType.Integer,
        choices: ([SUNDAY, MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY] as const)
          .map(n => ({ name: jpString(n), value: n })),
        minValue: SUNDAY,
        maxValue: SATURDAY,
      },
      {
        name: 'hour',
        description: '報告する時間',
        type: ApplicationCommandOptionType.Integer,
        minValue: 0,
        maxValue: 23,
      },
      {
        name: 'minute',
        description: '報告する分',
        type: ApplicationCommandOptionType.Integer,
        minValue: 0,
        maxValue: 59,
      },
    ],
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guild == null || guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }

      const configRecord = db.config.get(guildId);
      const timeRecord = db.times.get(guildId);
      if (configRecord == null || timeRecord == null) {
        interaction.reply({ content: 'このサーバーはまだ登録されていません。', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel') ?? await guild.channels.fetch(configRecord.channelId);
      const weekday = fromNumber(interaction.options.getInteger('weekday') ?? timeRecord.weekday);
      const hour = interaction.options.getInteger('hour') ?? timeRecord.hour;
      const minute = interaction.options.getInteger('minute') ?? timeRecord.minute;

      if (channel == null) {
        interaction.reply({ content: '指定されたチャンネルは見つかりません。', ephemeral: true });
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
      log('register weeklyAward:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.config.register(guildId, guildName, channel.id, channel.name);
      await db.times.set(guildId, weekday, hour, minute);
      await stopAward(guildId);
      await startAward(guildId);

      const hourString = String(hour).padStart(2, '0');
      const minuteString = String(minute).padStart(2, '0');
      response.edit(`週の報告を ${jpString(weekday)}の ${hourString}:${minuteString} に ${channel} で行うよう設定しました。`);
    },
  },
  status: {
    description: '現在のこのサーバーの登録状況を確認します。',
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const { guildId, guild } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '確認したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('peek status weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.config.get(guildId);
      const timeRecord = db.times.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        if (timeRecord == null) {
          interaction.reply({ content: 'DBデータ不整合です。 `/weeklyaward register` し直してください。', ephemeral: true });
          return;
        }

        const { weekday, hour, minute } = timeRecord;
        const hourString = String(hour).padStart(2, '0');
        const minuteString = String(minute).padStart(2, '0');

        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: '報告チャンネル', value: `<#${configRecord.channelId}>`, inline: true },
          { name: '報告時間', value: `${jpString(weekday)}の ${hourString}:${minuteString}`, inline: true },
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
