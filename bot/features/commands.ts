import { Events } from 'discord.js';
import { log } from '@lib/log';
import client from '../client';
import type { ChatInputCommandCollection } from 'types/bot'

import { commands as shortenUrlCommands } from './shortenUrl/commands';
import { commands as weeklyAwardsCommands } from './weeklyAwards/commands';
import { commands as regionalIndicatorsCommands } from './regionalIndicators/commands';

const commands: ChatInputCommandCollection<any, {}> = {
  ...shortenUrlCommands,
  ...weeklyAwardsCommands,
  ...regionalIndicatorsCommands,
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
