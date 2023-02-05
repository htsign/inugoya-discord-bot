const { Events, ApplicationCommandOptionType } = require('discord.js');
const client = require('../client.js');
const { log } = require('../lib/log.js');
const { isUrl } = require('../lib/util.js');
const { shortenUrl } = require('./shortenUrl');

/**
 * @type {{ [commandName: string]: Omit<ChatInputApplicationCommandData, 'name'> & { func: ChatInputCommandFunction } }}
 */
const commands = {
  shorten: {
    description: '与えられたURLを省略します。',
    options: [
      {
        name: 'url',
        description: '省略したいURL',
        required: true,
        type: ApplicationCommandOptionType.String,
      },
    ],
    async func(interaction) {
      const url = interaction.options.getString('url', true).trim();

      if (isUrl(url)) {
        await interaction.reply({ content: 'create shorten urls...', ephemeral: true });
        await interaction.editReply(await shortenUrl(url));
      }
      else {
        await interaction.reply({ content: '`http://` または `https://` を付けたものを送ってね', ephemeral: true });
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
