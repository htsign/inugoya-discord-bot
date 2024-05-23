import { log } from '@lib/log';
import { DATETIME_FORMAT } from '@lib/util';
import {
  type APIEmbedField,
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Obj } from 'types';
import type { ChatInputCommandCollection } from 'types/bot';
import { startAward, stopAward } from '.';
import { db } from './db';
import { Weekday, jpString } from './weekday';

const DEFAULT_SHOWS_COUNT = 3;
const DEFAULT_MIN_REACTED = 5;
const DEFAULT_WEEKDAY = Weekday.SUNDAY;
const DEFAULT_HOUR = 12;
const DEFAULT_MINUTE = 0;

const subCommands: ChatInputCommandCollection<void, Obj, 'cached' | 'raw'> = {
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
        name: 'showsrankcount',
        description: `何位まで表彰するか（デフォルト: ${DEFAULT_SHOWS_COUNT}）`,
        type: ApplicationCommandOptionType.Integer,
        minValue: 1,
        maxValue: 100,
      },
      {
        name: 'minreacted',
        description: `最低何件のリアクションから表彰するか（デフォルト: ${DEFAULT_MIN_REACTED}）`,
        type: ApplicationCommandOptionType.Integer,
        minValue: 1,
        maxValue: 100,
      },
      {
        name: 'weekday',
        description: `報告する週（デフォルト: ${jpString(DEFAULT_WEEKDAY)}）`,
        type: ApplicationCommandOptionType.Integer,
        choices: ([
          Weekday.SUNDAY,
          Weekday.MONDAY,
          Weekday.TUESDAY,
          Weekday.WEDNESDAY,
          Weekday.THURSDAY,
          Weekday.FRIDAY,
          Weekday.SATURDAY,
        ] as const)
          .map(n => ({ name: jpString(n), value: n })),
        minValue: Weekday.SUNDAY,
        maxValue: Weekday.SATURDAY,
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
      const showsRankCount = interaction.options.getInteger('showsrankcount') ?? DEFAULT_SHOWS_COUNT;
      const minReacted = interaction.options.getInteger('minreacted') ?? DEFAULT_MIN_REACTED;
      const weekday = interaction.options.getInteger('weekday') ?? DEFAULT_WEEKDAY;
      const hour = interaction.options.getInteger('hour') ?? DEFAULT_HOUR;
      const minute = interaction.options.getInteger('minute') ?? DEFAULT_MINUTE;

      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      log('register weeklyAward:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await Promise.all([
        db.config.register(guildId, guildName, channel.id, channel.name, showsRankCount, minReacted),
        db.times.set(guildId, weekday, hour, minute),
      ]);
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
      await Promise.all([
        db.times.delete(guildId),
        db.config.unregister(guildId),
      ]);

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
        name: 'showsrankcount',
        description: '何位まで表彰するか',
        type: ApplicationCommandOptionType.Integer,
        minValue: 1,
        maxValue: 100,
      },
      {
        name: 'minreacted',
        description: '最低何件のリアクションから表彰するか',
        type: ApplicationCommandOptionType.Integer,
        minValue: 1,
        maxValue: 100,
      },
      {
        name: 'weekday',
        description: '報告する週',
        type: ApplicationCommandOptionType.Integer,
        choices: ([
          Weekday.SUNDAY,
          Weekday.MONDAY,
          Weekday.TUESDAY,
          Weekday.WEDNESDAY,
          Weekday.THURSDAY,
          Weekday.FRIDAY,
          Weekday.SATURDAY,
        ] as const)
          .map(n => ({ name: jpString(n), value: n })),
        minValue: Weekday.SUNDAY,
        maxValue: Weekday.SATURDAY,
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
      const showsRankCount = interaction.options.getInteger('showsrankcount') ?? configRecord.showsRankCount;
      const minReacted = interaction.options.getInteger('minreacted') ?? configRecord.minReacted;
      const weekday = interaction.options.getInteger('weekday') ?? timeRecord.weekday;
      const hour = interaction.options.getInteger('hour') ?? timeRecord.hour;
      const minute = interaction.options.getInteger('minute') ?? timeRecord.minute;

      const isSet = {
        channel: interaction.options.getChannel('channel') != null,
        showsRankCount: interaction.options.getInteger('showsrankcount') != null,
        minReacted: interaction.options.getInteger('minreacted') != null,
        weekday: interaction.options.getInteger('weekday') != null,
        hour: interaction.options.getInteger('hour') != null,
        minute: interaction.options.getInteger('minute') != null,
      };

      if (Object.values(isSet).every(x => !x)) {
        interaction.reply({ content: '最低一つは設定してください。', ephemeral: true });
        return;
      }
      if (channel == null) {
        interaction.reply({ content: '指定されたチャンネルは見つかりません。', ephemeral: true });
        return;
      }
      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      log('update weeklyAward:', user.username, guildName);

      const response = await interaction.deferReply();

      await Promise.all([
        db.config.register(guildId, guildName, channel.id, channel.name, showsRankCount,  minReacted),
        db.times.set(guildId, weekday, hour, minute),
      ]);
      await stopAward(guildId);
      await startAward(guildId);

      const fields: APIEmbedField[] = [];

      if (isSet.channel) {
        fields.push({ name: '報告チャンネル', value: `<#${channel.id}>` });
      }
      if (isSet.weekday || isSet.hour || isSet.minute) {
        const hourString = String(hour).padStart(2, '0');
        const minuteString = String(minute).padStart(2, '0');

        fields.push({ name: '報告時間', value: `${jpString(weekday)}の ${hourString}:${minuteString}` });
      }
      if (isSet.showsRankCount) {
        fields.push({ name: '表彰する限界', value: `${showsRankCount} 位まで` });
      }
      if (isSet.minReacted) {
        fields.push({ name: '表彰に必要なリアクション数', value: `${minReacted} 個` });
      }

      response.edit({ content: 'リアクション大賞の設定を変更しました。', embeds: [{ fields }] });
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

        const { channelId, showsRankCount, minReacted, createdAt, updatedAt } = configRecord;
        const { weekday, hour, minute } = timeRecord;
        const hourString = String(hour).padStart(2, '0');
        const minuteString = String(minute).padStart(2, '0');

        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: '報告チャンネル', value: `<#${channelId}>`, inline: true },
          { name: '報告時間', value: `${jpString(weekday)}の ${hourString}:${minuteString}`, inline: true },
          { name: '表彰する限界', value: `${showsRankCount} 位まで`, inline: true },
          { name: '表彰に必要なリアクション数', value: `${minReacted} 個`, inline: true },
          { name: ' ', value: '----------------' },
          { name: '初回設定日時', value: createdAt.format(DATETIME_FORMAT), inline: true },
          { name: '最終更新日時', value: updatedAt.format(DATETIME_FORMAT), inline: true },
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
  weeklyaward: {
    description: 'リアクション大賞',
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
