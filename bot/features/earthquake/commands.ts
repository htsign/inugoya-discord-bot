import {
  APIEmbedField,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { log } from '@lib/log';
import { DATETIME_FORMAT } from '@lib/util';
import { db } from './db';
import {
  UnexpectedIntensityError,
  intensityFromNumber,
  intensityFromNumberWithException,
} from './earthquake';
import type { ChatInputCommandCollection } from 'types/bot';

const DEFAULT_MIN_INTENSITY = 30;

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
        name: 'minintensity',
        description: `報告する最低の震度（デフォルト: ${intensityFromNumber(DEFAULT_MIN_INTENSITY)}）`,
        type: ApplicationCommandOptionType.Integer,
        choices: [10, 20, 30, 40, 45, 50, 55, 60, 70].map(n => ({ name: intensityFromNumber(n), value: n })),
      },
      {
        name: 'alertthreshold',
        description: `@here をつける最低の震度（デフォルト: ${intensityFromNumber(DEFAULT_MIN_INTENSITY)}）`,
        type: ApplicationCommandOptionType.Integer,
        choices: [10, 20, 30, 40, 45, 50, 55, 60, 70].map(n => ({ name: intensityFromNumber(n), value: n })),
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
      const minIntensity = interaction.options.getInteger('minintensity') ?? DEFAULT_MIN_INTENSITY;
      const alertThreshold = interaction.options.getInteger('alertthreshold') ?? DEFAULT_MIN_INTENSITY;

      if (channel.type !== ChannelType.GuildAnnouncement && channel.type !== ChannelType.GuildText || 'permissions' in channel) {
        interaction.reply({ content: '適用できないチャンネルです。', ephemeral: true });
        return;
      }
      else if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      try {
        if (minIntensity < 10 || 70 < minIntensity) {
          throw new UnexpectedIntensityError(minIntensity);
        }
        intensityFromNumberWithException(minIntensity);
      }
      catch (e) {
        if (e instanceof UnexpectedIntensityError) {
          interaction.reply({ content: `minintensity に不正な値が与えられました。 [${e.intensity}]`, ephemeral: true });
          return;
        }
      }
      try {
        if (alertThreshold < 10 || 70 < alertThreshold) {
          throw new UnexpectedIntensityError(alertThreshold);
        }
        intensityFromNumberWithException(alertThreshold);
      }
      catch (e) {
        if (e instanceof UnexpectedIntensityError) {
          interaction.reply({ content: `alertthreshold に不正の値が与えられました。 [${e.intensity}]`, ephemeral: true });
          return;
        }
      }
      log('register earthquake:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, channel.id, channel.name, minIntensity, alertThreshold),

      response.edit(`${intensityFromNumber(minIntensity)}以上の地震速報をこのサーバーの ${channel} に通知するよう設定しました。`);
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
      log('unregister earthquake:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      await db.unregister(guildId),

      response.edit('地震速報の通知対象からこのサーバーを削除しました。');
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
        name: 'minintensity',
        description: '報告する最低の震度',
        type: ApplicationCommandOptionType.Integer,
        choices: [10, 20, 30, 40, 45, 50, 55, 60, 70].map(n => ({ name: intensityFromNumber(n), value: n })),
      },
      {
        name: 'alertthreshold',
        description: '@here をつける最低の震度',
        type: ApplicationCommandOptionType.Integer,
        choices: [10, 20, 30, 40, 45, 50, 55, 60, 70].map(n => ({ name: intensityFromNumber(n), value: n })),
      },
    ],
    async func(interaction: ChatInputCommandInteraction<'cached' | 'raw'>): Promise<void> {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guild == null || guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }

      const configRecord = db.get(guildId);
      if (configRecord == null) {
        interaction.reply({ content: 'このサーバーはまだ登録されていません。', ephemeral: true });
        return;
      }

      const channel = interaction.options.getChannel('channel') ?? await guild.channels.fetch(configRecord.channelId);
      const minIntensity = interaction.options.getInteger('minintensity') ?? configRecord.minIntensity;
      const alertThreshold = interaction.options.getInteger('alertthreshold') ?? configRecord.alertThreshold;

      const isSet = {
        channel: interaction.options.getChannel('channel') != null,
        minIntensity: interaction.options.getInteger('minintensity') != null,
        alertThreshold: interaction.options.getInteger('alertthreshold') != null,
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
      else if (!interaction.guild?.members.me?.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)) {
        interaction.reply({ content: 'このチャンネルには発言する権限がありません。', ephemeral: true });
        return;
      }
      try {
        if (minIntensity < 10 || 70 < minIntensity) {
          throw new UnexpectedIntensityError(minIntensity);
        }
        intensityFromNumberWithException(minIntensity);
      }
      catch (e) {
        if (e instanceof UnexpectedIntensityError) {
          interaction.reply({ content: `minintensity に不正な値が与えられました。 [${e.intensity}]`, ephemeral: true });
          return;
        }
      }
      try {
        if (alertThreshold < 10 || 70 < alertThreshold) {
          throw new UnexpectedIntensityError(alertThreshold);
        }
        intensityFromNumberWithException(alertThreshold);
      }
      catch (e) {
        if (e instanceof UnexpectedIntensityError) {
          interaction.reply({ content: `alertthreshold に不正の値が与えられました。 [${e.intensity}]`, ephemeral: true });
          return;
        }
      }
      log('register earthquake:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, channel.id, channel.name, minIntensity, alertThreshold);

      const fields: APIEmbedField[] = [];

      if (isSet.channel) {
        fields.push({ name: '通知チャンネル', value: `<#${channel.id}>` });
      }
      if (isSet.minIntensity) {
        fields.push({ name: '報告する最低の震度', value: intensityFromNumber(minIntensity) });
      }
      if (isSet.alertThreshold) {
        fields.push({ name: '\\@here をつける最低の震度', value: intensityFromNumber(alertThreshold) });
      }

      response.edit({ content: '地震速報通知の設定を変更しました。', embeds: [{ fields }] });
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
      log('peek status earthquake:', interaction.user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        const { channelId, minIntensity, alertThreshold, createdAt, updatedAt } = configRecord;

        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: '報告チャンネル', value: `<#${channelId}>`, inline: true },
          { name: '通知する最低の震度', value: intensityFromNumber(minIntensity), inline: true },
          { name: '\\@here をつける最低の震度', value: intensityFromNumber(alertThreshold), inline: true },
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

export const commands: ChatInputCommandCollection<void, {}> = {
  earthquake: {
    description: '地震速報',
    // @ts-ignore
    options: Object.entries(subCommands).map(([name, content]) => ({
      name,
      type: ApplicationCommandType.ChatInput,
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
