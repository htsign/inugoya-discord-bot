const { ApplicationCommandOptionType, ApplicationCommandType, Colors, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { log } = require('../../lib/log');
const { DATETIME_FORMAT, emojiRegex, graphemeSplitter } = require('../../lib/util');
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

/**
 * @param {string} s
 * @returns {boolean}
 */
const isSingleEmoji = s => /^<:\w+?:[0-9]+?>$/.test(s) || (graphemeSplitter.countGraphemes(s) === 1 && emojiRegex.test(s));

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

      const { isNonEmpty } = await import('ts-array-length');

      const configRecord = db.get(guildId);
      const embed = new EmbedBuilder({ title: '登録状況' });

      if (configRecord != null) {
        embed.setDescription('登録済み').setColor(Colors.Green);
        embed.addFields(
          { name: 'テンプレート', value: configRecord.template },
          { name: 'しつこいテンプレート', value: configRecord.moreTemplate },
          { name: 'レアテンプレート', value: configRecord.rareTemplate },
          { name: 'タイムアウト', value: `${configRecord.timeout} 分`, inline: true },
          { name: '累積反応数', value: `${configRecord.stackSize} 回`, inline: true },
          { name: ' ', value: '----------------' },
          { name: '初回設定日時', value: configRecord.createdAt.format(DATETIME_FORMAT), inline: true },
          { name: '最終更新日時', value: configRecord.updatedAt.format(DATETIME_FORMAT), inline: true },
        );

        const keywords = db.keywords.getRecords(guildId);
        const reactions = db.reactionKeywords.getRecords(guildId);
        embed.addFields(
          { name: ' ', value: '----------------' },
          { name: '登録されたキーワード', value: keywords.map(record => `「${record.keyword}」`).join('') },
          { name: '登録されたリアクションキーワード', value: reactions.map(record => record.reaction).join(' ') },
        );

        if (isNonEmpty(keywords)) {
          const [latest] = [...keywords].sort((a, b) => b.updatedAt.unix() - a.updatedAt.unix());
          if (latest == null) throw new Error('invalid state');

          embed.addFields({ name: 'キーワード最終更新日時', value: latest.updatedAt.format(DATETIME_FORMAT), inline: true });
        }
        if (isNonEmpty(reactions)) {
          const [latest] = [...reactions].sort((a, b) => b.updatedAt.unix() - a.updatedAt.unix());
          if (latest == null) throw new Error('invalid state');

          embed.addFields({ name: 'リアクション最終更新日時', value: latest.updatedAt.format(DATETIME_FORMAT), inline: true });
        }
      }
      else {
        embed.setDescription('未登録').setColor(Colors.Red);
      }
      response.edit({ embeds: [embed] });
    },
  },
  initkeywords: {
    description: '予め用意されたキーワード群を追加します。',
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: 'キーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('initialize keywords for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      /** @type {Promise<void>[]} */
      const addKeywordPromises = [];

      const { default: keywords } = await import('./keywords.json', { assert: { type: 'json' } });
      const newKeywords = keywords.filter(keyword => db.keywords.get(guildId, keyword) == null);

      if (newKeywords.length > 0) {
        for (const keyword of newKeywords) {
          addKeywordPromises.push(db.keywords.add(guildId, keyword));
        }
        await Promise.all(addKeywordPromises);

        response.edit(`キーワードに${newKeywords.map(keyword => `「 ${keyword} 」`).join('')}を登録しました。`);
      }
      else {
        response.edit('新たに追加されたキーワードはありません。');
      }
    },
  },
  addkeyword: {
    description: '新しくキーワードを追加します。',
    options: [
      {
        name: 'keyword',
        description: '登録したいキーワード',
        type: ApplicationCommandOptionType.String,
        required: true,
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
        required: true,
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

      await db.keywords.delete(guildId, keyword);

      response.edit(`「 ${keyword} 」をキーワードから削除しました。`);
    },
  },
  initreactions: {
    description: '予め用意されたリアクションキーワード群を追加します。',
    async func(interaction) {
      const { guildId, guild, user } = interaction;
      const guildName = guild?.name;

      if (guildName == null) {
        interaction.reply({ content: 'リアクションキーワードを追加したいサーバーの中で実行してください。', ephemeral: true });
        return;
      }
      log('initialize reaction keywords for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      /** @type {Promise<void>[]} */
      const addReactionPromises = [];

      const { default: reactions } = await import('./keywordReactions.json', { assert: { type: 'json' } });
      const newReactions = reactions.filter(reaction => db.keywords.get(guildId, reaction) == null);

      if (newReactions.length > 0) {
        for (const reaction of newReactions) {
          addReactionPromises.push(db.reactionKeywords.add(guildId, reaction));
        }
        await Promise.all(addReactionPromises);

        response.edit(`リアクションキーワードに${newReactions.map(reaction => `「 ${reaction} 」`).join('')}を登録しました。`);
      }
      else {
        response.edit('新たに追加されたリアクションキーワードはありません。');
      }
    },
  },
  addreaction: {
    description: '新しくリアクションキーワードを追加します。',
    options: [
      {
        name: 'reaction',
        description: '登録したいリアクションキーワード',
        type: ApplicationCommandOptionType.String,
        required: true,
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
      if (!isSingleEmoji(reaction)) {
        interaction.reply({ content: 'reaction には一つの絵文字のみ指定してください。', ephemeral: true });
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
        required: true,
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
      if (!isSingleEmoji(reaction)) {
        interaction.reply({ content: 'reaction には一つの絵文字のみ指定してください。', ephemeral: true });
        return;
      }
      if (db.reactionKeywords.get(guildId, reaction) == null) {
        interaction.reply({ content: 'そのリアクションキーワードは登録されていません。', ephemeral: true });
        return;
      }
      log('remove reaction keyword for hage:', user.username, guildName);

      const response = await interaction.deferReply();

      await db.reactionKeywords.delete(guildId, reaction);

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
