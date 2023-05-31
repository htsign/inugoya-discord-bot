import { Events } from 'discord.js';
import { addHandler } from 'bot/listeners';
import { log } from '@lib/log';
import type { ChatInputCommandCollection } from 'types/bot'

import { commands as hageCommands } from './hage/commands';
import { commands as shortenUrlCommands } from './shortenUrl/commands';
import { commands as weeklyAwardsCommands } from './weeklyAwards/commands';
import { commands as earthquakeCommands } from './earthquake/commands';
import { commands as regionalIndicatorsCommands } from './regionalIndicators/commands';
import { commands as vcAttentionCommands } from './vcAttention/commands';

const commands: ChatInputCommandCollection<any, {}> = {
  ...hageCommands,
  ...shortenUrlCommands,
  ...weeklyAwardsCommands,
  ...earthquakeCommands,
  ...regionalIndicatorsCommands,
  ...vcAttentionCommands,
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
