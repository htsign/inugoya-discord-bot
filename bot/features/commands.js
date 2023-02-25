const { Events } = require('discord.js');
const client = require('../client');
const { log } = require('../lib/log');

/**
 * @type {ChatInputCommand<any>}
 */
const commands = {
  ...require('./shortenUrl/commands'),
  ...require('./weeklyAwards/commands'),
  ...require('./regionalIndicators/commands'),
};

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { user, commandName } = interaction;

  log(user.username, 'command kicked:', commandName);

  const command = commands[commandName];
  if (command == null) {
    throw new Error('invalid command name');
  }
  return command.func(interaction);
});

client.once(Events.ClientReady, async () => {
  const app = await client.application?.fetch();

  if (app == null) {
    return log('application fetching is failed.');
  }
  const _commands = Object.entries(commands).map(([name, content]) => ({ ...content, name }));
  app.commands.set(_commands);
});
