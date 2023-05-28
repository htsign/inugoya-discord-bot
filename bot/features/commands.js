const { Events } = require('discord.js');
const { addHandler } = require('../listeners');
const { log } = require('../lib/log');

/**
 * @type {import('types/bot').ChatInputCommandCollection<any, {}>}
 */
const commands = {
  ...require('./hage/commands'),
  ...require('./shortenUrl/commands'),
  ...require('./weeklyAwards/commands'),
  ...require('./regionalIndicators/commands'),
  ...require('./vcAttention/commands'),
};

addHandler(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { guild, user, commandName } = interaction;

  const insideOf = guild != null ? [guild.name, user.username] : [user.username];
  log(...insideOf, 'command kicked:', commandName);

  const command = commands[commandName];
  if (command == null) {
    throw new Error('invalid command name');
  }
  return command.func(interaction);
});

addHandler(Events.ClientReady, async client => {
  const app = await client.application.fetch();

  const _commands = Object.entries(commands).map(([name, content]) => ({ ...content, name }));
  app.commands.set(_commands);
});
addHandler(Events.GuildCreate, async ({ name }) => {
  log('bot has been added to', name);
});
addHandler(Events.GuildDelete, async guild => {
  const { commands } = guild.client.application;

  for (const command of commands.cache.values()) {
    commands.delete(command);
  }
  log('bot has been kicked out from', guild.name);
});
