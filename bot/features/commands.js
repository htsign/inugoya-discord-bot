const { Events, ApplicationCommandOptionType } = require('discord.js');
const client = require('../client');
const { log } = require('../lib/log');
const { shortenUrlsOfContent } = require('./shortenUrl');

/**
 * @type {{ [commandName: string]: Omit<ChatInputApplicationCommandData, 'name'> & { func: ChatInputCommandFunction } }}
 */
const commands = {
  shorten: {
    description: '与えられたURLを省略します。',
    options: [
      {
        name: 'urls',
        description: '省略したい URL を含んだ文字列（余計な文字は無視されます）',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
    async func(interaction) {
      const content = interaction.options.getString('urls', true);

      await interaction.reply('create shorten urls...');
      const shortenUrls = await shortenUrlsOfContent(content);

      if (shortenUrls.length > 0) {
        await interaction.editReply(shortenUrls.join('\n'));
      }
      else {
        await interaction.reply({ content: 'URL が見つからないよ！', ephemeral: true });
      }
    },
  },
};

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  return commands[interaction.commandName].func(interaction);
});

client.on(Events.ClientReady, async () => {
  const app = await client.application?.fetch();

  if (app == null) {
    return log('application fetching is failed.');
  }
  const _commands = Object.entries(commands).map(([name, content]) => ({ ...content, name }));
  app.commands.set(_commands);
});
