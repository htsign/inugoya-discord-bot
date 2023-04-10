import { Events } from 'discord.js';
import { log } from '@lib/log';
import client from '../client';
import type { ChatInputCommandCollection } from 'types/bot'

import { commands as hageCommands } from './hage/commands';
import { commands as shortenUrlCommands } from './shortenUrl/commands';
import { commands as weeklyAwardsCommands } from './weeklyAwards/commands';
import { commands as regionalIndicatorsCommands } from './regionalIndicators/commands';
import { commands as vcAttentionCommands } from './vcAttention/commands';

const commands: ChatInputCommandCollection<any, {}> = {
  ...hageCommands,
  ...shortenUrlCommands,
  ...weeklyAwardsCommands,
  ...regionalIndicatorsCommands,
  ...vcAttentionCommands,
};

client.on(Events.InteractionCreate, async interaction => {
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

client.once(Events.ClientReady, async () => {
  const app = await client.application?.fetch();

  if (app == null) {
    return log('application fetching is failed.');
  }
  const _commands = Object.entries(commands).map(([name, content]) => ({ ...content, name }));
  app.commands.set(_commands);
});
