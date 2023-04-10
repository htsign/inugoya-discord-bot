const { ApplicationCommandType, PermissionFlagsBits, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');
const { log } = require('../../lib/log');
const { db } = require('./db');

const TEMPLATE = ` 彡⌒ミ
(´･ω･\`)　また髪の話してる・・・`;

const MORE_TEMPLATE = `:彡⌒:|
(´･ω:|　　やっぱり髪の話してる
ヽつ::|
　ヽ :;|
　　　 ＼`;

const RARE_TEMPLATE = `.        (~)
　 ／⌒ヽ
    {jjjjjjjjjjjj}
     (  ´･ω･ )
    ( :::： ::: )
　  し―Ｊ`;

const HAGE_TIMEOUT = 10;

const STACK_SIZE = 5;

/** @type {ChatInputCommand<void, {}, 'cached' | 'raw'>} */
const subCommands = {
  register: {
    description: '初期登録をします。',
    options: [
      {
        name: 'template',
        description: `反応した際のテキスト（デフォルト: ${TEMPLATE}）`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'more_template',
        description: `繰り返し反応した際のテキスト（デフォルト: ${MORE_TEMPLATE}）`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'rare_template',
        description: `反応した際に稀に出現するテキスト（デフォルト: ${RARE_TEMPLATE}）`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'timeout',
        description: `反応してから忘れるまでの時間（単位: 分 / デフォルト: ${HAGE_TIMEOUT}）`,
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'stack_size',
        description: `どれだけ繰り返し反応すれば moreTemplate を表示するかの閾値（デフォルト: ${STACK_SIZE}）`,
        type: ApplicationCommandOptionType.Integer,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;
      const template = interaction.options.getString('template')?.trim() ?? TEMPLATE;
      const moreTemplate = interaction.options.getString('more_template')?.trim() ?? MORE_TEMPLATE;
      const rareTemplate = interaction.options.getString('rare_template')?.trim() ?? RARE_TEMPLATE;
      const timeout = interaction.options.getInteger('timeout') ?? HAGE_TIMEOUT;
      const stackSize = interaction.options.getInteger('stack_size') ?? STACK_SIZE;

      if (guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('register hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, template, moreTemplate, rareTemplate, timeout, stackSize);

      response.edit('このサーバーでキーワードに反応するようになりました。');
    },
  },
  unregister: {
    description: '登録を解除します。',
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '登録解除したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('unregister hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.unregister(guildId);

      response.edit('このサーバーでキーワードに反応しなくなりました。');
    },
  },
  update: {
    description: '設定を変更します。',
    options: [
      {
        name: 'template',
        description: `反応した際のテキスト`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'more_template',
        description: `繰り返し反応した際のテキスト`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'rare_template',
        description: `反応した際に稀に出現するテキスト`,
        type: ApplicationCommandOptionType.String,
      },
      {
        name: 'timeout',
        description: `反応してから忘れるまでの時間（単位: 分）`,
        type: ApplicationCommandOptionType.Integer,
      },
      {
        name: 'stack_size',
        description: `どれだけ繰り返し反応すれば moreTemplate を表示するかの閾値`,
        type: ApplicationCommandOptionType.Integer,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      const configRecord = db.get(guildId);
      if (configRecord == null) {
        interaction.reply({ content: 'このサーバーはまだ登録されていません。', ephemeral: true });
        return;
      }

      const template = interaction.options.getString('template')?.trim() ?? configRecord.template;
      const moreTemplate = interaction.options.getString('more_template')?.trim() ?? configRecord.moreTemplate;
      const rareTemplate = interaction.options.getString('rare_template')?.trim() ?? configRecord.rareTemplate;
      const timeout = interaction.options.getInteger('timeout') ?? configRecord.timeout;
      const stackSize = interaction.options.getInteger('stack_size') ?? configRecord.stackSize;

      if (guildName == null) {
        interaction.reply({ content: '登録したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('update hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.register(guildId, guildName, template, moreTemplate, rareTemplate, timeout, stackSize);

      response.edit('設定を更新しました。現在の設定は `/hage status` で確認できます。');
    },
  },
  status: {
    description: '現在のこのサーバーの登録状況を確認します。',
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: '確認したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('peek status hage:', user.username, guildName);

      const response = await interaction.deferReply();

      const configRecord = db.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        embed.setDescription('登録済み');
        embed.addFields(
          { name: 'テンプレート', value: configRecord.template },
          { name: 'しつこいテンプレート', value: configRecord.moreTemplate },
          { name: 'レアテンプレート', value: configRecord.rareTemplate },
          { name: 'タイムアウト', value: `${configRecord.timeout} 分`, inline: true },
          { name: '累積反応数', value: `${configRecord.stackSize} 回`, inline: true },
        );

        const keywords = db.keywords.getRecords(guildId).map(record => `「${record.keyword}」`);
        const reactions = db.reactionKeywords.getRecords(guildId).map(record => record.reaction);
        embed.addFields(
          { name: '登録されたキーワード', value: keywords.join('') },
          { name: '登録されたリアクションキーワード', value: reactions.join(' ') },
        );
      }
      else {
        embed.setDescription('未登録');
      }
      response.edit({ embeds: [embed] });
    },
  },
  addkeyword: {
    description: '新しくキーワードを追加します。',
    options: [
      {
        name: 'keyword',
        description: '登録したいキーワード',
        type: ApplicationCommandOptionType.String,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;
      const keyword = interaction.options.getString('keyword', true);

      if (guildName == null) {
        interaction.reply({ content: 'キーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      if (db.keywords.get(guildId, keyword) != null) {
        interaction.reply({ content: 'そのキーワードは登録済みです。', ephemeral: true });
        return;
      }
      log('add keyword for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.keywords.add(guildId, keyword);

      response.edit(`キーワードに「 ${keyword} 」を登録しました。`);
    },
  },
  removekeyword: {
    description: 'キーワードを削除します。',
    options: [
      {
        name: 'keyword',
        description: '削除したいキーワード',
        type: ApplicationCommandOptionType.String,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;
      const keyword = interaction.options.getString('keyword', true);

      if (guildName == null) {
        interaction.reply({ content: 'キーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      if (db.keywords.get(guildId, keyword) == null) {
        interaction.reply({ content: 'そのキーワードは登録されていません。', ephemeral: true });
        return;
      }
      log('remove keyword for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.keywords.remove(guildId, keyword);

      response.edit(`「 ${keyword} 」をキーワードから削除しました。`);
    },
  },
  addreaction: {
    description: '新しくリアクションキーワードを追加します。',
    options: [
      {
        name: 'reaction',
        description: '登録したいリアクションキーワード',
        type: ApplicationCommandOptionType.String,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;
      const reaction = interaction.options.getString('reaction', true);

      if (guildName == null) {
        interaction.reply({ content: 'リアクションキーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      if (db.keywords.get(guildId, reaction) != null) {
        interaction.reply({ content: 'そのリアクションキーワードは登録済みです。', ephemeral: true });
        return;
      }
      log('add reaction keyword for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.reactionKeywords.add(guildId, reaction);

      response.edit(`リアクションキーワードに「 ${reaction} 」を登録しました。`);
    },
  },
  removereaction: {
    description: 'リアクションキーワードを削除します。',
    options: [
      {
        name: 'keyword',
        description: '削除したいリアクションキーワード',
        type: ApplicationCommandOptionType.String,
      },
    ],
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;
      const reaction = interaction.options.getString('keyword', true);

      if (guildName == null) {
        interaction.reply({ content: 'リアクションキーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      if (db.reactionKeywords.get(guildId, reaction) == null) {
        interaction.reply({ content: 'そのリアクションキーワードは登録されていません。', ephemeral: true });
        return;
      }
      log('remove reaction keyword for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.reactionKeywords.remove(guildId, reaction);

      response.edit(`「 ${reaction} 」をリアクションキーワードから削除しました。`);
    },
  },
};

/** @type {ChatInputCommand<void>} */
module.exports = {
  hage: {
    description: 'ハゲ',
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
