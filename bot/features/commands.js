const { Events } = require('discord.js');
const client = require('../client');
const { log } = require('../lib/log');

/**
 * @type {ChatInputCommand}
 */
const commands = {
  ...require('./shortenUrl/commands'),
  ...require('./weeklyAwards/commands'),
};

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  return commands[interaction.commandName].func(interaction);
});

client.once(Events.ClientReady, async () => {
  const app = await client.application?.fetch();

  if (app == null) {
    return log('application fetching is failed.');
  }
  const _commands = Object.entries(commands).map(([name, content]) => ({ ...content, name }));
  app.commands.set(_commands);
});
