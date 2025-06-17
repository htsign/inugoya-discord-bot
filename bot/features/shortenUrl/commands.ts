import { ApplicationCommandOptionType } from 'discord.js';
import type { ChatInputCommandCollection } from '../../../types/bot/index.ts';
import type { Obj } from '../../../types/index.ts';
import { shortenUrlsOfContent } from './shortenUrl.ts';

export const commands: ChatInputCommandCollection<void, Obj> = {
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
        // I don't know why error occurs by deleting sent message if in DM
        if (interaction.inGuild()) {
          const repliedMessage = await interaction.fetchReply();
          await repliedMessage.delete();
        }
        await interaction.followUp({ content: 'URL が見つからないよ！', ephemeral: true });
      }
    },
  },
};
