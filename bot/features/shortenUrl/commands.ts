import { ApplicationCommandOptionType, ChatInputCommandInteraction } from 'discord.js';
import { shortenUrlsOfContent } from './shortenUrl';
import type { ChatInputCommandCollection } from 'types/bot';

export const commands: ChatInputCommandCollection<{}> = {
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
    async func(interaction: ChatInputCommandInteraction): Promise<void> {
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